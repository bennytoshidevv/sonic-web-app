import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, notFound } from '../../middleware/errors.js'
import { audit } from '../../utils/audit.js'
import { checkBoolean, checkMoney, optionalText, requiredText, toId } from '../../utils/validate.js'

// Operator management, part 2 (module 6): menus. Mounted at /api/staff/menus.
// Operators and the admin only. Edits (especially prices) are written to audit_logs, like the mock.
// A price change only affects new carts: placed orders keep their own copy in order_items.unit_price.
// Items are never deleted: "archive" hides them (is_active = false).

const router = Router()
router.use(requireAuth, requireRole('operator'))

async function lockCategory(db, categoryId) {
  const { rows } = await db.query('SELECT * FROM menu_categories WHERE menu_category_id = $1 FOR UPDATE', [categoryId])
  if (!rows[0]) throw notFound('not_found', 'Category not found')
  return rows[0]
}

async function lockItem(db, itemId) {
  const { rows } = await db.query('SELECT * FROM menu_items WHERE item_id = $1 FOR UPDATE', [itemId])
  if (!rows[0]) throw notFound('not_found', 'Item not found')
  return rows[0]
}

// Category names are unique per restaurant (also in the database).
async function checkCategoryName(db, restaurantId, name, exceptId = 0) {
  const { rows } = await db.query(
    'SELECT 1 FROM menu_categories WHERE restaurant_id = $1 AND lower(category_name) = lower($2) AND menu_category_id <> $3',
    [restaurantId, name, exceptId],
  )
  if (rows[0]) throw conflict('duplicate', 'This restaurant already has a category with that name')
}

// GET /api/staff/menus/:restaurantId -> all categories in display order, each with its active items (getMenuForStaff)
// Archived items are left out; sold-out ones stay (staff switch them back on).
router.get('/:restaurantId', async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
            COALESCE((SELECT json_agg(i ORDER BY i.item_id) FROM menu_items i
                       WHERE i.menu_category_id = c.menu_category_id AND i.is_active), '[]') AS items
       FROM menu_categories c
      WHERE c.restaurant_id = $1
      ORDER BY c.display_order, c.menu_category_id`,
    [toId(req.params.restaurantId, 'restaurant id')],
  )
  res.json(rows)
})

// POST /api/staff/menus/:restaurantId/categories  { category_name } -> { category } (saveMenuCategory, new)
// A new category goes to the end of the menu.
router.post('/:restaurantId/categories', async (req, res) => {
  const restaurantId = toId(req.params.restaurantId, 'restaurant id')
  const name = requiredText(req.body?.category_name, 'Category name', 100)
  const category = await withTransaction(async (db) => {
    const { rows: found } = await db.query('SELECT 1 FROM restaurants WHERE restaurant_id = $1 FOR UPDATE', [restaurantId])
    if (!found[0]) throw notFound('not_found', 'Restaurant not found')
    await checkCategoryName(db, restaurantId, name)
    const { rows } = await db.query(
      `INSERT INTO menu_categories (restaurant_id, category_name, display_order)
       VALUES ($1, $2, (SELECT COALESCE(max(display_order), 0) + 1 FROM menu_categories WHERE restaurant_id = $1))
       RETURNING *`,
      [restaurantId, name],
    )
    await audit(db, { user_id: req.user.user_id, action: 'create_menu_category', target_entity: 'menu_categories', target_id: rows[0].menu_category_id, new_value: rows[0] })
    return rows[0]
  })
  res.status(201).json({ category })
})

// PUT /api/staff/menus/categories/:id  { category_name } -> { category } (saveMenuCategory, rename)
router.put('/categories/:id', async (req, res) => {
  const categoryId = toId(req.params.id, 'category id')
  const name = requiredText(req.body?.category_name, 'Category name', 100)
  const category = await withTransaction(async (db) => {
    const old = await lockCategory(db, categoryId)
    await checkCategoryName(db, old.restaurant_id, name, categoryId)
    const { rows } = await db.query('UPDATE menu_categories SET category_name = $2 WHERE menu_category_id = $1 RETURNING *', [categoryId, name])
    await audit(db, { user_id: req.user.user_id, action: 'rename_menu_category', target_entity: 'menu_categories', target_id: categoryId, old_value: { category_name: old.category_name }, new_value: { category_name: name } })
    return rows[0]
  })
  res.json({ category })
})

// POST /api/staff/menus/categories/:id/move  { direction: -1 (up) | 1 (down) } -> { ok } (moveMenuCategory)
// Swaps display_order with the neighbour; 409 'edge' when it is already first/last.
router.post('/categories/:id/move', async (req, res) => {
  const categoryId = toId(req.params.id, 'category id')
  const direction = req.body?.direction
  if (direction !== -1 && direction !== 1) throw badRequest('invalid', 'direction must be -1 or 1')
  await withTransaction(async (db) => {
    const category = await lockCategory(db, categoryId)
    // Lock the whole menu of the restaurant so two moves at once can't mix up the order.
    const { rows: siblings } = await db.query(
      'SELECT * FROM menu_categories WHERE restaurant_id = $1 ORDER BY display_order, menu_category_id FOR UPDATE',
      [category.restaurant_id],
    )
    const index = siblings.findIndex((c) => c.menu_category_id === categoryId)
    const other = siblings[index + direction]
    if (!other) throw conflict('edge', 'This category is already at the edge')
    await db.query('UPDATE menu_categories SET display_order = $2 WHERE menu_category_id = $1', [categoryId, other.display_order])
    await db.query('UPDATE menu_categories SET display_order = $2 WHERE menu_category_id = $1', [other.menu_category_id, category.display_order])
  })
  res.json({ ok: true })
})

// The item form: { menu_category_id, name, description, price, is_available, photo_url? }.
// photo_url is optional: a URL from POST /api/uploads/menu-items (left out = keep the current photo).
function readItem(body) {
  const name = optionalText(body?.name, 'Name', 150)
  if (!name) throw badRequest('invalid', 'Name is required')
  return {
    menu_category_id: toId(body?.menu_category_id, 'category'),
    name,
    description: optionalText(body?.description, 'Description', 2000),
    price: checkMoney(body?.price, 'Price', { min: 0.01 }),
    is_available: body?.is_available === undefined ? true : checkBoolean(body.is_available, 'is_available'),
    photo_url: body?.photo_url === undefined ? undefined : optionalText(body.photo_url, 'Photo URL', 255),
  }
}

async function checkCategoryExists(db, categoryId) {
  const { rows } = await db.query('SELECT 1 FROM menu_categories WHERE menu_category_id = $1', [categoryId])
  if (!rows[0]) throw badRequest('invalid', 'Unknown category')
}

// POST /api/staff/menus/items -> { item } (saveMenuItem, new)
router.post('/items', async (req, res) => {
  const data = readItem(req.body)
  const item = await withTransaction(async (db) => {
    await checkCategoryExists(db, data.menu_category_id)
    const { rows } = await db.query(
      `INSERT INTO menu_items (menu_category_id, name, description, price, is_available, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.menu_category_id, data.name, data.description, data.price, data.is_available, data.photo_url ?? null],
    )
    await audit(db, { user_id: req.user.user_id, action: 'create_menu_item', target_entity: 'menu_items', target_id: rows[0].item_id, new_value: rows[0] })
    return rows[0]
  })
  res.status(201).json({ item })
})

// PUT /api/staff/menus/items/:id -> { item } (saveMenuItem, edit). The old and new price are both in the audit log.
router.put('/items/:id', async (req, res) => {
  const itemId = toId(req.params.id, 'item id')
  const data = readItem(req.body)
  const item = await withTransaction(async (db) => {
    const old = await lockItem(db, itemId)
    await checkCategoryExists(db, data.menu_category_id)
    const { rows } = await db.query(
      `UPDATE menu_items SET menu_category_id = $2, name = $3, description = $4, price = $5, is_available = $6,
              photo_url = COALESCE($7, photo_url), updated_at = now()
        WHERE item_id = $1 RETURNING *`,
      [itemId, data.menu_category_id, data.name, data.description, data.price, data.is_available, data.photo_url ?? null],
    )
    await audit(db, { user_id: req.user.user_id, action: 'update_menu_item', target_entity: 'menu_items', target_id: itemId, old_value: old, new_value: rows[0] })
    return rows[0]
  })
  res.json({ item })
})

// PUT /api/staff/menus/items/:id/availability  { is_available } -> { ok } (setMenuItemAvailable)
// is_available = false means "sold out": customers see it but can't add it to the cart.
router.put('/items/:id/availability', async (req, res) => {
  const itemId = toId(req.params.id, 'item id')
  const isAvailable = checkBoolean(req.body?.is_available, 'is_available')
  await withTransaction(async (db) => {
    const old = await lockItem(db, itemId)
    await db.query('UPDATE menu_items SET is_available = $2, updated_at = now() WHERE item_id = $1', [itemId, isAvailable])
    await audit(db, { user_id: req.user.user_id, action: 'set_item_availability', target_entity: 'menu_items', target_id: itemId, old_value: { is_available: old.is_available }, new_value: { is_available: isAvailable } })
  })
  res.json({ ok: true })
})

// POST /api/staff/menus/items/:id/archive -> { ok } (archiveMenuItem)
// Soft delete: the item disappears from menus; past orders keep their copy of the name and price.
router.post('/items/:id/archive', async (req, res) => {
  const itemId = toId(req.params.id, 'item id')
  await withTransaction(async (db) => {
    const old = await lockItem(db, itemId)
    if (!old.is_active) return // already archived: nothing to do
    await db.query('UPDATE menu_items SET is_active = false, updated_at = now() WHERE item_id = $1', [itemId])
    await audit(db, { user_id: req.user.user_id, action: 'archive_menu_item', target_entity: 'menu_items', target_id: itemId, old_value: { is_active: true }, new_value: { is_active: false } })
  })
  res.json({ ok: true })
})

export default router
