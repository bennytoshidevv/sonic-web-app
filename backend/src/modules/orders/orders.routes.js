import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, notFound } from '../../middleware/errors.js'
import { optionalText, toId } from '../../utils/validate.js'
import { PAYMENT_METHODS, getCustomerOrders, getOrderDetails, placeOrder, readLines } from './orders.service.js'

// Customer orders and reviews (module 3). Mounted at /api.
// A customer only ever sees their own orders: the customer id comes from the login token, and
// someone else's order answers 404 (as if it did not exist), so order ids can't be probed.
// Responses keep the same shape as the mock functions in frontend/src/mock/mock.js.

const router = Router()
const customerOnly = [requireAuth, requireRole('customer')]

// Loads one of my orders (the row only), locked for the rest of the transaction so two
// requests can't change it at the same time. 404 when it isn't mine.
async function lockOwnOrder(db, orderId, customerId) {
  const { rows } = await db.query('SELECT * FROM customer_orders WHERE order_id = $1 AND customer_id = $2 FOR UPDATE', [
    orderId,
    customerId,
  ])
  if (!rows[0]) throw notFound('not_found', 'Order not found')
  return rows[0]
}

// POST /api/orders  { address_id, lines: [{ item_id, quantity }], payment_method, order_notes } -> { order } (placeOrder)
// The browser sends only ids and quantities: prices, fees and the total are computed here from the
// database, so a changed price in the browser can't change what the customer pays.
router.post('/orders', ...customerOnly, async (req, res) => {
  const paymentMethod = req.body?.payment_method ?? 'cod'
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw badRequest('invalid_payment_method', 'Choose a payment method')
  const order = await placeOrder({
    customerId: req.user.user_id,
    addressId: toId(req.body?.address_id, 'address'),
    lines: readLines(req.body?.lines),
    paymentMethod,
    orderNotes: optionalText(req.body?.order_notes, 'Order notes', 300),
  })
  res.status(201).json({ order })
})

// GET /api/orders -> my orders, newest first, each { order, stores, history, payment, rider, reviews } (getCustomerOrders)
router.get('/orders', ...customerOnly, async (req, res) => {
  res.json(await getCustomerOrders(req.user.user_id))
})

// GET /api/orders/:id -> { order, stores, history, payment, rider } (getOrderDetails)
router.get('/orders/:id', ...customerOnly, async (req, res) => {
  const details = await getOrderDetails(toId(req.params.id, 'order id'), req.user.user_id)
  if (!details) throw notFound('not_found', 'Order not found')
  res.json(details)
})

// POST /api/orders/:id/cancel  { reason } -> { order } (cancelOrder)
// Customers may cancel only while the order is still pending (before the operator confirms it).
// If an online payment was already paid, a pending refund is recorded for staff to process
// (same rule as when staff reject a paid order).
router.post('/orders/:id/cancel', ...customerOnly, async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  const reason = optionalText(req.body?.reason, 'Reason', 300)
  const order = await withTransaction(async (db) => {
    const current = await lockOwnOrder(db, orderId, req.user.user_id)
    if (current.order_status !== 'pending') throw conflict('not_cancellable', 'Only pending orders can be cancelled')

    const { rows } = await db.query(
      `UPDATE customer_orders SET order_status = 'cancelled', cancellation_reason = $2 WHERE order_id = $1 RETURNING *`,
      [orderId, reason],
    )
    await db.query(
      "INSERT INTO order_status_history (order_id, status, changed_by, remarks) VALUES ($1, 'cancelled', $2, $3)",
      [orderId, req.user.user_id, reason],
    )
    await db.query(
      `INSERT INTO refunds (payment_id, amount, reason)
       SELECT payment_id, amount, 'Order cancelled by the customer'
         FROM payments WHERE order_id = $1 AND payment_status = 'paid'`,
      [orderId],
    )
    return rows[0]
  })
  res.json({ order })
})

// ---------- Reviews ----------

// GET /api/orders/:id/reviews -> { restaurantReviews, riderReview } (getOrderReviews)
router.get('/orders/:id/reviews', ...customerOnly, async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  const own = await query('SELECT 1 FROM customer_orders WHERE order_id = $1 AND customer_id = $2', [orderId, req.user.user_id])
  if (!own.rows[0]) throw notFound('not_found', 'Order not found')
  const [restaurantReviews, riderReview] = await Promise.all([
    query('SELECT * FROM restaurant_reviews WHERE order_id = $1 ORDER BY review_id', [orderId]),
    query('SELECT * FROM rider_reviews WHERE order_id = $1', [orderId]),
  ])
  res.json({ restaurantReviews: restaurantReviews.rows, riderReview: riderReview.rows[0] || null })
})

// One rating from the form: { rating: 1-5, comment }. Anything else gives the mock's 'invalid' error.
function readRating(entry) {
  if (!Number.isInteger(entry?.rating) || entry.rating < 1 || entry.rating > 5) {
    throw badRequest('invalid', 'Ratings must be whole stars from 1 to 5')
  }
  return { rating: entry.rating, comment: optionalText(entry.comment, 'Comment', 500) }
}

// POST /api/orders/:id/reviews  { restaurantRatings: [{ restaurant_id, rating, comment }], riderRating } -> { ok } (submitOrderReviews)
// Only for my own delivered orders, and only once (one review per store per order + one rider review).
router.post('/orders/:id/reviews', ...customerOnly, async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  const restaurantRatings = req.body?.restaurantRatings
  if (!Array.isArray(restaurantRatings)) throw badRequest('invalid', 'restaurantRatings must be a list')
  const storeRatings = restaurantRatings.map((r) => ({ restaurant_id: toId(r?.restaurant_id, 'restaurant'), ...readRating(r) }))
  const riderRating = req.body?.riderRating ? readRating(req.body.riderRating) : null

  await withTransaction(async (db) => {
    const order = await lockOwnOrder(db, orderId, req.user.user_id)
    if (order.order_status !== 'delivered') throw conflict('not_delivered', 'You can rate an order after it is delivered')
    const { rows: existing } = await db.query(
      `SELECT 1 FROM restaurant_reviews WHERE order_id = $1 UNION ALL SELECT 1 FROM rider_reviews WHERE order_id = $1`,
      [orderId],
    )
    if (existing.length) throw conflict('already_rated', 'This order was already rated')

    // Each rated store must be one of the order's stores, rated once.
    const { rows: stores } = await db.query('SELECT restaurant_id FROM order_restaurants WHERE order_id = $1', [orderId])
    const storeIds = new Set(stores.map((s) => s.restaurant_id))
    const ratedIds = storeRatings.map((r) => r.restaurant_id)
    if (ratedIds.some((id) => !storeIds.has(id)) || new Set(ratedIds).size !== ratedIds.length) {
      throw badRequest('invalid', 'Rate each store of this order once')
    }

    for (const r of storeRatings) {
      await db.query('INSERT INTO restaurant_reviews (order_id, restaurant_id, rating, comment) VALUES ($1, $2, $3, $4)', [
        orderId,
        r.restaurant_id,
        r.rating,
        r.comment,
      ])
    }
    if (riderRating) {
      await db.query('INSERT INTO rider_reviews (order_id, rating, comment) VALUES ($1, $2, $3)', [
        orderId,
        riderRating.rating,
        riderRating.comment,
      ])
    }
  })
  res.status(201).json({ ok: true })
})

// GET /api/riders/:id/reviews -> all reviews of one rider (getRiderReviews)
// Found through the deliveries the rider completed. Used to show a rider's average rating,
// so any logged-in user may read it (the reviews hold no customer names).
router.get('/riders/:id/reviews', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT rv.*
       FROM rider_reviews rv
       JOIN deliveries d ON d.order_id = rv.order_id
       JOIN delivery_assignments a ON a.delivery_id = d.delivery_id
      WHERE a.rider_id = $1 AND a.end_reason = 'completed'
      ORDER BY rv.review_id`,
    [toId(req.params.id, 'rider id')],
  )
  res.json(rows)
})

export default router
