import { Router } from 'express'
import { withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, notFound } from '../../middleware/errors.js'
import { notify, notifyOrderStatus } from '../../utils/notify.js'
import { optionalText, toId } from '../../utils/validate.js'
import { getStaffOrder, getStaffOrders } from '../orders/orders.service.js'
import { closeCheckout } from '../payments/payments.service.js'
import { freeRiderIfIdle, getRidersOverview } from '../rider/rider.service.js'

// Operator orders and riders (module 4): live orders, order details, moving an order forward,
// rejecting it, the riders overview and assigning a rider. Mounted at /api/staff.
// Operators and the admin only. The staff member doing the change always comes from the login token.
// Responses keep the same shape as the mock functions in frontend/src/mock/mock.js.

const router = Router()
router.use(requireAuth, requireRole('operator')) // the admin passes too

// Operator steps before the rider takes over (the mock's STAFF_NEXT_STATUS).
const STAFF_NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready_for_pickup' }
// Staff may reject an order until the rider picks it up.
const REJECTABLE = ['pending', 'confirmed', 'preparing', 'ready_for_pickup']
// A rider can be assigned once the store confirmed the order, until it is picked up.
const ASSIGNABLE = ['confirmed', 'preparing', 'ready_for_pickup']

// Loads an order and locks it until the transaction ends, so two operators clicking at the same
// time are handled one after the other (the second one sees the first one's change).
async function lockOrder(db, orderId) {
  const { rows } = await db.query('SELECT * FROM customer_orders WHERE order_id = $1 FOR UPDATE', [orderId])
  if (!rows[0]) throw notFound('not_found', 'Order not found')
  return rows[0]
}

async function addHistory(db, orderId, status, changedBy, remarks = null) {
  await db.query('INSERT INTO order_status_history (order_id, status, changed_by, remarks) VALUES ($1, $2, $3, $4)', [
    orderId,
    status,
    changedBy,
    remarks,
  ])
}

// Ends the delivery's current assignment(s) and frees each rider again, unless they still carry
// another order they accepted. Returns the riders whose assignment ended.
async function endActiveAssignments(db, deliveryId, endReason) {
  const { rows } = await db.query(
    `UPDATE delivery_assignments SET ended_at = now(), end_reason = $2
      WHERE delivery_id = $1 AND ended_at IS NULL
      RETURNING rider_id`,
    [deliveryId, endReason],
  )
  for (const { rider_id } of rows) await freeRiderIfIdle(db, rider_id)
  return rows.map((r) => r.rider_id)
}

// GET /api/staff/orders -> every order, newest first (getLiveOrders)
router.get('/orders', async (req, res) => {
  res.json(await getStaffOrders())
})

// GET /api/staff/orders/:id -> one order with customer, delivery and assignments (getOrderForStaff)
router.get('/orders/:id', async (req, res) => {
  const order = await getStaffOrder(toId(req.params.id, 'order id'))
  if (!order) throw notFound('not_found', 'Order not found')
  res.json(order)
})

async function checkOnlinePaid(db, orderId) {
  const { rows } = await db.query('SELECT payment_method, payment_status FROM payments WHERE order_id = $1 ORDER BY payment_id DESC LIMIT 1', [orderId])
  if (rows[0] && rows[0].payment_method !== 'cod' && rows[0].payment_status !== 'paid') {
    throw conflict('payment_required', 'Waiting for online payment')
  }
}

// POST /api/staff/orders/:id/advance -> { order } (advanceOrderByStaff)
// pending → confirmed → preparing → ready_for_pickup. Later steps belong to the rider.
// An online order can't be confirmed until it is paid, so food never goes out unpaid. COD is paid on delivery.
router.post('/orders/:id/advance', async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  const order = await withTransaction(async (db) => {
    const current = await lockOrder(db, orderId)
    const next = STAFF_NEXT_STATUS[current.order_status]
    if (!next) throw conflict('not_allowed', `An order that is ${current.order_status} can't be moved by staff`)
    if (current.order_status === 'pending') await checkOnlinePaid(db, orderId)
    const { rows } = await db.query('UPDATE customer_orders SET order_status = $2 WHERE order_id = $1 RETURNING *', [orderId, next])
    await addHistory(db, orderId, next, req.user.user_id)
    await notifyOrderStatus(db, rows[0], next)
    return rows[0]
  })
  res.json({ order })
})

// POST /api/staff/orders/:id/reject  { reason } -> { order } (rejectOrderByStaff)
// Cancels the order before pickup. The reason is required because the customer sees it.
// The rider's assignment ends (rider freed), and a paid online payment gets a pending refund (team decision).
router.post('/orders/:id/reject', async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  const reason = optionalText(req.body?.reason, 'Reason', 300)
  const order = await withTransaction(async (db) => {
    const current = await lockOrder(db, orderId)
    if (!REJECTABLE.includes(current.order_status)) throw conflict('not_allowed', 'Orders can only be rejected before pickup')
    if (!reason) throw badRequest('reason_required', 'Write the reason for the customer')

    const { rows } = await db.query(
      "UPDATE customer_orders SET order_status = 'cancelled', cancellation_reason = $2 WHERE order_id = $1 RETURNING *",
      [orderId, reason],
    )
    await addHistory(db, orderId, 'cancelled', req.user.user_id, reason)
    await notifyOrderStatus(db, rows[0], 'cancelled')

    const { rows: deliveries } = await db.query(
      "UPDATE deliveries SET delivery_status = 'cancelled' WHERE order_id = $1 RETURNING delivery_id",
      [orderId],
    )
    if (deliveries[0]) {
      const riders = await endActiveAssignments(db, deliveries[0].delivery_id, 'cancelled')
      for (const riderId of riders) {
        await notify(db, { user_id: riderId, order_id: orderId, type: 'order_status', message: `${current.order_number} was cancelled by Sonic.` })
      }
    }
    await db.query(
      `INSERT INTO refunds (payment_id, amount, reason)
       SELECT payment_id, amount, $2 FROM payments WHERE order_id = $1 AND payment_status = 'paid'`,
      [orderId, `Order rejected: ${reason}`],
    )
    return rows[0]
  })
  closeCheckout(orderId) // not awaited: staff shouldn't wait for PayMongo (it never throws)
  res.json({ order })
})

// POST /api/staff/orders/:id/assign  { rider_id } -> { ok } (assignRider)
// Assigns or reassigns a rider. The order must be confirmed and not picked up yet; the rider must be
// an active rider on an open shift and available. The rider then accepts or rejects in the rider app.
router.post('/orders/:id/assign', async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  const riderId = toId(req.body?.rider_id, 'rider')
  await withTransaction(async (db) => {
    const order = await lockOrder(db, orderId)
    if (!ASSIGNABLE.includes(order.order_status)) throw conflict('not_assignable', 'This order cannot get a rider now')

    // Lock the rider too, so two operators can't both grab the same rider for different orders unnoticed.
    const { rows: riders } = await db.query(
      `SELECT p.availability_status
         FROM users u JOIN rider_profiles p ON p.user_id = u.user_id
        WHERE u.user_id = $1 AND u.role = 'rider' AND u.account_status = 'active'
          AND EXISTS (SELECT 1 FROM rider_shifts s WHERE s.rider_id = u.user_id AND s.status = 'open')
          FOR UPDATE OF p`,
      [riderId],
    )
    if (riders[0]?.availability_status !== 'available') throw conflict('rider_unavailable', 'This rider is not available')

    // One delivery per order: create it on the first assignment, reuse it when reassigning.
    const { rows: deliveryRows } = await db.query(
      `INSERT INTO deliveries (order_id, delivery_status) VALUES ($1, 'assigned')
       ON CONFLICT (order_id) DO UPDATE SET delivery_status = 'assigned'
       RETURNING delivery_id`,
      [orderId],
    )
    const deliveryId = deliveryRows[0].delivery_id
    await endActiveAssignments(db, deliveryId, 'reassigned')
    await db.query('INSERT INTO delivery_assignments (delivery_id, rider_id, assigned_by) VALUES ($1, $2, $3)', [
      deliveryId,
      riderId,
      req.user.user_id,
    ])
    await notify(db, {
      user_id: riderId,
      order_id: orderId,
      type: 'rider_assignment',
      message: `New delivery: ${order.order_number} to ${order.dropoff_barangay}. Please accept or reject it.`,
    })
  })
  res.json({ ok: true })
})

// GET /api/staff/riders -> riders with what dispatch needs (getRidersOverview):
//   { user, profile, openShift, deliveriesThisShift, pettyCash, jobs, reviews }
router.get('/riders', async (req, res) => {
  res.json(await getRidersOverview())
})

export default router
