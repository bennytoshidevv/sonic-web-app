import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, notFound } from '../../middleware/errors.js'
import { audit } from '../../utils/audit.js'
import { checkBoolean, optionalText, toId } from '../../utils/validate.js'
import { RESTAURANT_WITH_DETAILS } from '../catalog/catalog.routes.js'

// Operator management, part 1 (module 6): restaurants. Mounted at /api/staff/restaurants.
// Operators and the admin only. Every change is written to audit_logs in the same transaction,
// with the same action names as the mock's audit(...) calls.
// Restaurants are never deleted: "disable" hides them from customers and past orders stay intact.

const router = Router()
router.use(requireAuth, requireRole('operator'))

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

// The restaurant form: { name, description, address, contact_number, cuisine_ids: [], hours: [...], logo_url? }.
// hours = [{ day_of_week: 0-6 (0 = Sunday), open_time: 'HH:MM', close_time: 'HH:MM' }]; closed days are left out.
// logo_url is optional: a URL from POST /api/uploads/restaurants (left out = keep the current logo).
function readRestaurant(body) {
  const name = optionalText(body?.name, 'Name', 150)
  const address = optionalText(body?.address, 'Address', 255)
  if (!name || !address) throw badRequest('invalid', 'Name and address are required')
  const cuisineIds = Array.isArray(body?.cuisine_ids) ? body.cuisine_ids.map((id) => toId(id, 'cuisine')) : []
  const hours = Array.isArray(body?.hours) ? body.hours : []
  for (const h of hours) {
    if (!Number.isInteger(h?.day_of_week) || h.day_of_week < 0 || h.day_of_week > 6 || !TIME.test(h.open_time) || !TIME.test(h.close_time)) {
      throw badRequest('invalid', 'Each opening hour needs a day (0-6) and times like 08:00')
    }
  }
  const days = hours.map((h) => h.day_of_week)
  if (new Set(days).size !== days.length) throw badRequest('invalid', 'Each day can appear only once')
  return {
    name,
    address,
    description: optionalText(body?.description, 'Description', 2000),
    contact_number: optionalText(body?.contact_number, 'Contact number', 20),
    logo_url: body?.logo_url === undefined ? undefined : optionalText(body.logo_url, 'Logo URL', 255),
    cuisineIds: [...new Set(cuisineIds)],
    hours,
  }
}

async function lockRestaurant(db, restaurantId) {
  const { rows } = await db.query('SELECT * FROM restaurants WHERE restaurant_id = $1 FOR UPDATE', [restaurantId])
  if (!rows[0]) throw notFound('not_found', 'Restaurant not found')
  return rows[0]
}

// Cuisines and weekly hours are replaced as a whole (they are details of the restaurant, not history).
async function saveCuisinesAndHours(db, restaurantId, data) {
  const known = await db.query('SELECT cuisine_id FROM cuisine_types WHERE cuisine_id = ANY($1::int[])', [data.cuisineIds])
  if (known.rows.length !== data.cuisineIds.length) throw badRequest('invalid', 'Unknown cuisine')
  await db.query('DELETE FROM restaurant_cuisines WHERE restaurant_id = $1', [restaurantId])
  for (const cuisineId of data.cuisineIds) {
    await db.query('INSERT INTO restaurant_cuisines (restaurant_id, cuisine_id) VALUES ($1, $2)', [restaurantId, cuisineId])
  }
  await db.query('DELETE FROM restaurant_hours WHERE restaurant_id = $1', [restaurantId])
  for (const h of data.hours) {
    await db.query('INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time) VALUES ($1, $2, $3, $4)', [
      restaurantId,
      h.day_of_week,
      h.open_time,
      h.close_time,
    ])
  }
}

async function restaurantWithDetails(restaurantId) {
  const { rows } = await query(`${RESTAURANT_WITH_DETAILS} WHERE r.restaurant_id = $1`, [restaurantId])
  return rows[0]
}

// GET /api/staff/restaurants -> every restaurant (disabled ones too) with cuisines, cuisine_ids and hours (getRestaurantsForStaff)
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT x.*, COALESCE((SELECT json_agg(rc.cuisine_id ORDER BY rc.cuisine_id) FROM restaurant_cuisines rc
                            WHERE rc.restaurant_id = x.restaurant_id), '[]') AS cuisine_ids
       FROM (${RESTAURANT_WITH_DETAILS}) x
      ORDER BY x.restaurant_id`,
  )
  res.json(rows)
})

// POST /api/staff/restaurants -> { restaurant } (saveRestaurant, new)
// A new restaurant starts closed, so it can't take orders before staff open it.
router.post('/', async (req, res) => {
  const data = readRestaurant(req.body)
  const restaurantId = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO restaurants (name, description, address, contact_number, logo_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.description, data.address, data.contact_number, data.logo_url ?? null],
    )
    await saveCuisinesAndHours(db, rows[0].restaurant_id, data)
    await audit(db, { user_id: req.user.user_id, action: 'create_restaurant', target_entity: 'restaurants', target_id: rows[0].restaurant_id, new_value: rows[0] })
    return rows[0].restaurant_id
  })
  res.status(201).json({ restaurant: await restaurantWithDetails(restaurantId) })
})

// PUT /api/staff/restaurants/:id -> { restaurant } (saveRestaurant, edit)
router.put('/:id', async (req, res) => {
  const restaurantId = toId(req.params.id, 'restaurant id')
  const data = readRestaurant(req.body)
  await withTransaction(async (db) => {
    const old = await lockRestaurant(db, restaurantId)
    const { rows } = await db.query(
      `UPDATE restaurants SET name = $2, description = $3, address = $4, contact_number = $5,
              logo_url = COALESCE($6, logo_url), updated_at = now()
        WHERE restaurant_id = $1 RETURNING *`,
      [restaurantId, data.name, data.description, data.address, data.contact_number, data.logo_url ?? null],
    )
    await saveCuisinesAndHours(db, restaurantId, data)
    await audit(db, { user_id: req.user.user_id, action: 'update_restaurant', target_entity: 'restaurants', target_id: restaurantId, old_value: old, new_value: rows[0] })
  })
  res.json({ restaurant: await restaurantWithDetails(restaurantId) })
})

// PUT /api/staff/restaurants/:id/open-status  { open_status: 'open'|'closed' } -> { ok } (setRestaurantOpenStatus)
router.put('/:id/open-status', async (req, res) => {
  const restaurantId = toId(req.params.id, 'restaurant id')
  const status = req.body?.open_status
  if (!['open', 'closed'].includes(status)) throw badRequest('invalid', 'open_status must be open or closed')
  await withTransaction(async (db) => {
    const old = await lockRestaurant(db, restaurantId)
    await db.query('UPDATE restaurants SET open_status = $2, updated_at = now() WHERE restaurant_id = $1', [restaurantId, status])
    await audit(db, { user_id: req.user.user_id, action: 'set_open_status', target_entity: 'restaurants', target_id: restaurantId, old_value: { open_status: old.open_status }, new_value: { open_status: status } })
  })
  res.json({ ok: true })
})

// PUT /api/staff/restaurants/:id/active  { is_active } -> { ok } (setRestaurantActive)
// Disable = hidden from customers (soft delete); it is also closed so it can't take orders.
router.put('/:id/active', async (req, res) => {
  const restaurantId = toId(req.params.id, 'restaurant id')
  const isActive = checkBoolean(req.body?.is_active, 'is_active')
  await withTransaction(async (db) => {
    const old = await lockRestaurant(db, restaurantId)
    await db.query(
      `UPDATE restaurants SET is_active = $2, open_status = CASE WHEN $2 THEN open_status ELSE 'closed' END, updated_at = now()
        WHERE restaurant_id = $1`,
      [restaurantId, isActive],
    )
    await audit(db, {
      user_id: req.user.user_id,
      action: isActive ? 'enable_restaurant' : 'disable_restaurant',
      target_entity: 'restaurants',
      target_id: restaurantId,
      old_value: { is_active: old.is_active },
      new_value: { is_active: isActive },
    })
  })
  res.json({ ok: true })
})

export default router
