import { Router } from 'express'
import { query } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, notFound } from '../../middleware/errors.js'
import { toId } from '../../utils/validate.js'

// Catalog (customer side): barangays, cuisines, restaurants, menus, reviews, current rates,
// favorites and the cart's item details. Mounted at /api.
//
// Reading the catalog needs no login (like a printed menu on the counter).
// Favorites belong to a customer, so those routes need a customer login and always use the
// logged-in user's id (never an id sent by the browser).
// Responses keep the same shape as the matching functions in frontend/src/mock/mock.js.

const router = Router()

// A restaurant row plus its cuisine names and weekly hours, like the mock's withDetails().
// Sub-queries with json_agg build the two lists inside the same query (no extra round trips).
// Cuisines have no order column, so they are sorted by name to always come back the same way.
export const RESTAURANT_WITH_DETAILS = `
  SELECT r.*,
         COALESCE((SELECT json_agg(ct.cuisine_name ORDER BY ct.cuisine_name)
                     FROM restaurant_cuisines rc
                     JOIN cuisine_types ct ON ct.cuisine_id = rc.cuisine_id
                    WHERE rc.restaurant_id = r.restaurant_id), '[]') AS cuisines,
         COALESCE((SELECT json_agg(h ORDER BY h.day_of_week, h.open_time)
                     FROM restaurant_hours h
                    WHERE h.restaurant_id = r.restaurant_id), '[]') AS hours
    FROM restaurants r`

// Only active restaurants can be opened or liked by customers (disabled = hidden).
async function findActiveRestaurant(restaurantId) {
  const { rows } = await query(`${RESTAURANT_WITH_DETAILS} WHERE r.restaurant_id = $1 AND r.is_active`, [restaurantId])
  return rows[0] || null
}

// GET /api/barangays -> active barangays (getBarangays)
// Hidden barangays can't be chosen for new addresses.
router.get('/barangays', async (req, res) => {
  const { rows } = await query('SELECT * FROM barangays WHERE is_active ORDER BY barangay_id')
  res.json(rows)
})

// GET /api/cuisine-types -> [{ cuisine_id, cuisine_name }] (getCuisineTypes)
router.get('/cuisine-types', async (req, res) => {
  const { rows } = await query('SELECT * FROM cuisine_types ORDER BY cuisine_id')
  res.json(rows)
})

// GET /api/restaurants -> active restaurants with cuisines and hours (getRestaurants)
router.get('/restaurants', async (req, res) => {
  const { rows } = await query(`${RESTAURANT_WITH_DETAILS} WHERE r.is_active ORDER BY r.restaurant_id`)
  res.json(rows)
})

// GET /api/restaurants/:id -> one active restaurant (getRestaurant)
// The mock returns null for a missing or disabled restaurant; the API answers 404.
router.get('/restaurants/:id', async (req, res) => {
  const restaurant = await findActiveRestaurant(toId(req.params.id, 'restaurant id'))
  if (!restaurant) throw notFound('not_found', 'Restaurant not found')
  res.json(restaurant)
})

// GET /api/restaurants/:id/menu -> active categories in display order, each with its active items (getMenu)
// Sold-out items (is_available = false) stay in the list so the page can show them as "Sold out".
router.get('/restaurants/:id/menu', async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
            COALESCE((SELECT json_agg(i ORDER BY i.item_id)
                        FROM menu_items i
                       WHERE i.menu_category_id = c.menu_category_id AND i.is_active), '[]') AS items
       FROM menu_categories c
      WHERE c.restaurant_id = $1 AND c.is_active
      ORDER BY c.display_order, c.menu_category_id`,
    [toId(req.params.id, 'restaurant id')],
  )
  res.json(rows)
})

// GET /api/restaurants/:id/reviews -> review rows (getRestaurantReviews)
// The page computes the average rating from these (calc.js averageRating), so it is not stored.
router.get('/restaurants/:id/reviews', async (req, res) => {
  const { rows } = await query('SELECT * FROM restaurant_reviews WHERE restaurant_id = $1 ORDER BY review_id', [
    toId(req.params.id, 'restaurant id'),
  ])
  res.json(rows)
})

// GET /api/rate-settings/current -> the rate in use now (getRateSettings)
// = the latest row whose effective_from has arrived. A row dated in the future is only scheduled,
// so it must not change today's fees or rider pay.
router.get('/rate-settings/current', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM rate_settings WHERE effective_from <= now() ORDER BY effective_from DESC, setting_id DESC LIMIT 1',
  )
  if (!rows[0]) throw notFound('not_found', 'No rate settings in effect')
  res.json(rows[0])
})

// GET /api/menu-items?ids=1,2,3 -> current data for the items in a cart (getCartItemDetails)
// Each item comes with its restaurant's status. Disabled items and restaurants are included
// (flagged by is_active) so the cart can tell the customer to remove them.
const MAX_CART_ITEMS = 100
router.get('/menu-items', async (req, res) => {
  const text = String(req.query.ids ?? '').trim()
  const ids = text === '' ? [] : text.split(',').map((id) => toId(id, 'item id'))
  if (ids.length > MAX_CART_ITEMS) throw badRequest('too_many_items', `At most ${MAX_CART_ITEMS} items at a time`)
  if (ids.length === 0) return res.json([])

  const { rows } = await query(
    `SELECT i.*,
            json_build_object('restaurant_id', r.restaurant_id, 'name', r.name, 'description', r.description,
                              'open_status', r.open_status, 'is_active', r.is_active) AS restaurant
       FROM menu_items i
       JOIN menu_categories c ON c.menu_category_id = i.menu_category_id
       JOIN restaurants r ON r.restaurant_id = c.restaurant_id
      WHERE i.item_id = ANY($1::int[])
      ORDER BY i.item_id`,
    [ids],
  )
  res.json(rows)
})

// ---------- Favorites (customers only) ----------

// GET /api/restaurants/:id/favorite -> { favorite: true|false } (isFavoriteRestaurant)
router.get('/restaurants/:id/favorite', requireAuth, requireRole('customer'), async (req, res) => {
  const { rows } = await query('SELECT 1 FROM favorite_restaurants WHERE user_id = $1 AND restaurant_id = $2', [
    req.user.user_id,
    toId(req.params.id, 'restaurant id'),
  ])
  res.json({ favorite: rows.length > 0 })
})

// PUT /api/restaurants/:id/favorite  { liked: true|false } -> { ok: true } (setFavoriteRestaurant)
// Liking twice or unliking something not liked is fine (nothing changes), so a double tap can't fail.
router.put('/restaurants/:id/favorite', requireAuth, requireRole('customer'), async (req, res) => {
  const restaurantId = toId(req.params.id, 'restaurant id')
  const liked = req.body?.liked
  if (typeof liked !== 'boolean') throw badRequest('invalid_liked', 'Send { liked: true } or { liked: false }')

  if (liked) {
    if (!(await findActiveRestaurant(restaurantId))) throw notFound('not_found', 'Restaurant not found')
    await query(
      `INSERT INTO favorite_restaurants (user_id, restaurant_id) VALUES ($1, $2)
       ON CONFLICT (user_id, restaurant_id) DO NOTHING`,
      [req.user.user_id, restaurantId],
    )
  } else {
    // A favorite is just a "like", not business history, so it may be deleted.
    await query('DELETE FROM favorite_restaurants WHERE user_id = $1 AND restaurant_id = $2', [req.user.user_id, restaurantId])
  }
  res.json({ ok: true })
})

export default router
