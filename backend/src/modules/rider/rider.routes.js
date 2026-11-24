import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, notFound } from '../../middleware/errors.js'
import { pettyCashOnHand } from '../../utils/calc.js'
import { notifyOrderStatus } from '../../utils/notify.js'
import { toId } from '../../utils/validate.js'
import { ORDER_DETAILS, RIDER_ORDER_DETAILS } from '../orders/orders.service.js'
import {
  SHIFT_VIEW,
  activeGasTiers,
  applyDeductions,
  currentRate,
  findOpenShift,
  freeRiderIfIdle,
  getShiftViews,
  recordEarning,
} from './rider.service.js'

// Rider app (module 5): dashboard, shifts, availability, deliveries, petty cash, history and wallet.
// Mounted at /api/rider. Riders only, and always the logged-in rider (from the login token):
// a rider can't see or move an order that isn't assigned to them.
// Responses keep the same shape as the mock functions in frontend/src/mock/mock.js.

const router = Router()
router.use(requireAuth, requireRole('rider'))

// The rider's steps after the store is done (the mock's NEXT_DELIVERY_STATUS).
const NEXT_DELIVERY_STATUS = { ready_for_pickup: 'picked_up', picked_up: 'on_the_way', on_the_way: 'delivered' }
const AVAILABILITY = ['available', 'busy', 'offline']

// The rider's profile row, locked so shift and availability changes of one rider run one at a time.
async function lockProfile(db, riderId) {
  const { rows } = await db.query('SELECT * FROM rider_profiles WHERE user_id = $1 FOR UPDATE', [riderId])
  return rows[0]
}

async function hasAcceptedDelivery(db, riderId) {
  const { rows } = await db.query(
    "SELECT 1 FROM delivery_assignments WHERE rider_id = $1 AND ended_at IS NULL AND response_status = 'accepted'",
    [riderId],
  )
  return rows.length > 0
}

// The rider's current (not ended, accepted) assignment for an order, locked. 404 'not_assigned' when there is none.
async function lockAcceptedAssignment(db, riderId, orderId) {
  const { rows } = await db.query(
    `SELECT a.*, d.order_id
       FROM delivery_assignments a JOIN deliveries d ON d.delivery_id = a.delivery_id
      WHERE d.order_id = $1 AND a.rider_id = $2 AND a.ended_at IS NULL AND a.response_status = 'accepted'
        FOR UPDATE OF a`,
    [orderId, riderId],
  )
  if (!rows[0]) throw notFound('not_assigned', 'This delivery is not assigned to you')
  return rows[0]
}

// A new dispatch of this rider that still waits for an answer, locked. 404 'not_found' otherwise.
async function lockPendingAssignment(db, riderId, assignmentId) {
  const { rows } = await db.query(
    `SELECT * FROM delivery_assignments
      WHERE assignment_id = $1 AND rider_id = $2 AND ended_at IS NULL AND response_status = 'pending'
        FOR UPDATE`,
    [assignmentId, riderId],
  )
  if (!rows[0]) throw notFound('not_found', 'This dispatch is no longer waiting for you')
  return rows[0]
}

// ---------- Dashboard and shifts ----------

// GET /api/rider/dashboard -> { profile, shift, hasShiftToday, deliveries, deductions, pettyCash, activeDelivery } (getRiderDashboard)
//   shift = the open shift, or else the latest one; deliveries = its delivered orders with pay inputs.
router.get('/dashboard', async (req, res) => {
  const riderId = req.user.user_id
  const [profile, shiftRow, today, active] = await Promise.all([
    query('SELECT * FROM rider_profiles WHERE user_id = $1', [riderId]),
    query(
      `SELECT ${SHIFT_VIEW} AS view FROM rider_shifts s WHERE s.rider_id = $1
        ORDER BY (s.status = 'open') DESC, s.started_at DESC LIMIT 1`,
      [riderId],
    ),
    query('SELECT 1 FROM rider_shifts WHERE rider_id = $1 AND shift_date = current_date', [riderId]),
    query(
      `SELECT ${ORDER_DETAILS} AS details
         FROM delivery_assignments a
         JOIN deliveries d ON d.delivery_id = a.delivery_id
         JOIN customer_orders o ON o.order_id = d.order_id
        WHERE a.rider_id = $1 AND a.ended_at IS NULL AND a.response_status = 'accepted'
        ORDER BY a.assignment_id LIMIT 1`,
      [riderId],
    ),
  ])
  const view = shiftRow.rows[0]?.view
  res.json({
    profile: profile.rows[0],
    shift: view?.shift ?? null,
    hasShiftToday: today.rows.length > 0,
    deliveries: view ? view.runs.map(({ earning, order, stores, payment }) => ({ earning, order, stores, payment })) : [],
    deductions: view?.deductions ?? [],
    pettyCash: view?.pettyCash ?? [],
    activeDelivery: active.rows[0]?.details ?? null,
  })
})

// POST /api/rider/shift/start -> { shift } (startShift)
// One shift per rider per day. The per-shift deductions (box rent, savings) are charged now,
// and the rider becomes available for dispatch.
router.post('/shift/start', async (req, res) => {
  const riderId = req.user.user_id
  const shift = await withTransaction(async (db) => {
    await lockProfile(db, riderId)
    if (await findOpenShift(db, riderId)) throw conflict('already_open', 'Your shift is already open')
    const today = await db.query('SELECT 1 FROM rider_shifts WHERE rider_id = $1 AND shift_date = current_date', [riderId])
    if (today.rows.length) throw conflict('already_today', 'You already had a shift today')

    const { rows } = await db.query(
      "INSERT INTO rider_shifts (rider_id, shift_date, status) VALUES ($1, current_date, 'open') RETURNING *",
      [riderId],
    )
    await applyDeductions(db, 'per_shift', rows[0])
    await db.query("UPDATE rider_profiles SET availability_status = 'available' WHERE user_id = $1", [riderId])
    return rows[0]
  })
  res.status(201).json({ shift })
})

// POST /api/rider/shift/end -> { shift } (endShift)
// Not allowed while a delivery is in progress. The rider goes offline; the operator settles the shift later.
router.post('/shift/end', async (req, res) => {
  const riderId = req.user.user_id
  const shift = await withTransaction(async (db) => {
    await lockProfile(db, riderId)
    const open = await findOpenShift(db, riderId, { lock: true })
    if (!open) throw conflict('no_open_shift', 'You have no open shift')
    if (await hasAcceptedDelivery(db, riderId)) throw conflict('delivery_in_progress', 'Finish your delivery first')
    const { rows } = await db.query(
      "UPDATE rider_shifts SET status = 'closed', ended_at = now() WHERE shift_id = $1 RETURNING *",
      [open.shift_id],
    )
    await db.query("UPDATE rider_profiles SET availability_status = 'offline' WHERE user_id = $1", [riderId])
    return rows[0]
  })
  res.json({ shift })
})

// PUT /api/rider/availability  { availability_status } -> { ok } (setRiderAvailability)
// Only during an open shift.
router.put('/availability', async (req, res) => {
  const status = req.body?.availability_status
  if (!AVAILABILITY.includes(status)) throw badRequest('invalid_status', 'Choose available, busy or offline')
  await withTransaction(async (db) => {
    await lockProfile(db, req.user.user_id)
    if (!(await findOpenShift(db, req.user.user_id))) throw conflict('no_open_shift', 'Start your shift first')
    await db.query('UPDATE rider_profiles SET availability_status = $2 WHERE user_id = $1', [req.user.user_id, status])
  })
  res.json({ ok: true })
})

// ---------- Deliveries ----------

// GET /api/rider/deliveries -> { pending, active, shiftIsOpen, availability, tiers, rate } (getRiderDeliveries)
//   pending = new dispatches waiting for Accept/Reject; active = accepted, not delivered yet.
//   Each entry = the order (with store addresses and the customer's name and number) + its assignment.
//   tiers and rate are for the pay preview on the page (calc.js).
router.get('/deliveries', async (req, res) => {
  const riderId = req.user.user_id
  const [entries, shift, profile, tiers, rate] = await Promise.all([
    query(
      `SELECT ${RIDER_ORDER_DETAILS} || jsonb_build_object('assignment', to_jsonb(asg)) AS entry
         FROM delivery_assignments asg
         JOIN deliveries dl ON dl.delivery_id = asg.delivery_id
         JOIN customer_orders o ON o.order_id = dl.order_id
        WHERE asg.rider_id = $1 AND asg.ended_at IS NULL
        ORDER BY asg.assignment_id`,
      [riderId],
    ),
    findOpenShift({ query }, riderId),
    query('SELECT availability_status FROM rider_profiles WHERE user_id = $1', [riderId]),
    activeGasTiers(),
    currentRate(),
  ])
  const list = entries.rows.map((r) => r.entry)
  res.json({
    pending: list.filter((x) => x.assignment.response_status === 'pending'),
    active: list.filter((x) => x.assignment.response_status === 'accepted'),
    shiftIsOpen: Boolean(shift),
    availability: profile.rows[0].availability_status,
    tiers,
    rate,
  })
})

// POST /api/rider/assignments/:id/accept -> { ok } (acceptAssignment)
// Needs an open shift. The rider becomes busy.
router.post('/assignments/:id/accept', async (req, res) => {
  const assignmentId = toId(req.params.id, 'assignment id')
  await withTransaction(async (db) => {
    await lockPendingAssignment(db, req.user.user_id, assignmentId)
    if (!(await findOpenShift(db, req.user.user_id))) throw conflict('no_open_shift', 'Start your shift first')
    await db.query(
      "UPDATE delivery_assignments SET response_status = 'accepted', responded_at = now() WHERE assignment_id = $1",
      [assignmentId],
    )
    await db.query("UPDATE rider_profiles SET availability_status = 'busy' WHERE user_id = $1", [req.user.user_id])
  })
  res.json({ ok: true })
})

// POST /api/rider/assignments/:id/reject -> { ok } (rejectAssignment)
// The assignment ends; the operator sees it in Live orders and assigns another rider.
router.post('/assignments/:id/reject', async (req, res) => {
  const assignmentId = toId(req.params.id, 'assignment id')
  await withTransaction(async (db) => {
    await lockPendingAssignment(db, req.user.user_id, assignmentId)
    await db.query(
      `UPDATE delivery_assignments
          SET response_status = 'rejected', responded_at = now(), ended_at = now(), end_reason = 'rejected'
        WHERE assignment_id = $1`,
      [assignmentId],
    )
  })
  res.json({ ok: true })
})

// POST /api/rider/deliveries/:orderId/advance -> { order } (advanceDelivery)
// The rider's one main button: ready_for_pickup → picked_up → on_the_way → delivered.
// On delivered, in the same transaction: COD becomes paid (the rider collected the cash), the pay snapshot
// and per-delivery deductions are saved in the open shift, the assignment ends as completed, and the rider
// is available again if they carry nothing else.
router.post('/deliveries/:orderId/advance', async (req, res) => {
  const orderId = toId(req.params.orderId, 'order id')
  const riderId = req.user.user_id
  const order = await withTransaction(async (db) => {
    const { rows: orderRows } = await db.query('SELECT * FROM customer_orders WHERE order_id = $1 FOR UPDATE', [orderId])
    if (!orderRows[0]) throw notFound('not_assigned', 'This delivery is not assigned to you')
    const assignment = await lockAcceptedAssignment(db, riderId, orderId)
    const next = NEXT_DELIVERY_STATUS[orderRows[0].order_status]
    if (!next) throw conflict('not_ready', 'The store has not marked this order ready yet')
    const shift = await findOpenShift(db, riderId)
    if (!shift) throw conflict('no_open_shift', 'Start your shift first')

    const { rows } = await db.query('UPDATE customer_orders SET order_status = $2 WHERE order_id = $1 RETURNING *', [orderId, next])
    await db.query('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, $2, $3)', [orderId, next, riderId])
    await db.query(
      `UPDATE deliveries SET delivery_status = $2::delivery_status,
              picked_up_at = CASE WHEN $2::delivery_status = 'picked_up' THEN now() ELSE picked_up_at END,
              delivered_at = CASE WHEN $2::delivery_status = 'delivered' THEN now() ELSE delivered_at END
        WHERE delivery_id = $1`,
      [assignment.delivery_id, next],
    )
    await notifyOrderStatus(db, rows[0], next)

    if (next === 'delivered') {
      await db.query("UPDATE delivery_assignments SET ended_at = now(), end_reason = 'completed' WHERE assignment_id = $1", [
        assignment.assignment_id,
      ])
      await db.query(
        `UPDATE payments SET payment_status = 'paid', paid_at = now()
          WHERE payment_id = (SELECT payment_id FROM payments WHERE order_id = $1 ORDER BY payment_id DESC LIMIT 1)
            AND payment_method = 'cod' AND payment_status = 'pending'`,
        [orderId],
      )
      await recordEarning(db, { deliveryId: assignment.delivery_id, shift, baseDeliveryFee: rows[0].base_delivery_fee })
      await freeRiderIfIdle(db, riderId)
    }
    return rows[0]
  })
  res.json({ order })
})

// GET /api/rider/deliveries/:orderId -> one delivery of mine (getRiderDeliveryDetails):
//   the order (rider view) + { assignment, earning, shiftPettyCash, orderPurchases, shiftIsOpen, tiers, rate }
// Works for a new, active or completed delivery of this rider; anything else answers 404.
router.get('/deliveries/:orderId', async (req, res) => {
  const orderId = toId(req.params.orderId, 'order id')
  const riderId = req.user.user_id
  const { rows } = await query(
    `SELECT ${RIDER_ORDER_DETAILS} || jsonb_build_object(
              'assignment', to_jsonb(asg),
              'earning', (SELECT to_jsonb(e) FROM delivery_earnings e WHERE e.delivery_id = dl.delivery_id),
              'orderPurchases', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.txn_id) FROM petty_cash_transactions t
                                           WHERE t.order_id = o.order_id AND t.txn_type = 'purchase'), '[]')) AS entry
       FROM deliveries dl
       JOIN delivery_assignments asg ON asg.delivery_id = dl.delivery_id
       JOIN customer_orders o ON o.order_id = dl.order_id
      WHERE dl.order_id = $1 AND asg.rider_id = $2 AND (asg.ended_at IS NULL OR asg.end_reason = 'completed')
      ORDER BY (asg.ended_at IS NULL) DESC
      LIMIT 1`,
    [orderId, riderId],
  )
  if (!rows[0]) throw notFound('not_found', 'Delivery not found')

  const shift = await findOpenShift({ query }, riderId)
  const [pettyCash, tiers, rate] = await Promise.all([
    shift ? query('SELECT * FROM petty_cash_transactions WHERE shift_id = $1 ORDER BY created_at, txn_id', [shift.shift_id]) : { rows: [] },
    activeGasTiers(),
    currentRate(),
  ])
  res.json({ ...rows[0].entry, shiftPettyCash: pettyCash.rows, shiftIsOpen: Boolean(shift), tiers, rate })
})

// POST /api/rider/deliveries/:orderId/purchases  { amount } -> { ok } (recordPettyPurchase)
// Store advance ("pabili"): the rider paid the store with petty cash for this order. Needs the order in
// progress and an open shift, and the amount can't be more than the petty cash on hand (calc.js).
router.post('/deliveries/:orderId/purchases', async (req, res) => {
  const orderId = toId(req.params.orderId, 'order id')
  const riderId = req.user.user_id
  await withTransaction(async (db) => {
    await lockAcceptedAssignment(db, riderId, orderId)
    // Locking the shift makes two purchases at the same time count one after the other.
    const shift = await findOpenShift(db, riderId, { lock: true })
    if (!shift) throw conflict('no_open_shift', 'Start your shift first')
    const amount = Math.round(Number(req.body?.amount) * 100) / 100
    if (!(amount > 0)) throw badRequest('invalid_amount', 'Enter an amount above ₱0.00')
    const { rows: ledger } = await db.query('SELECT * FROM petty_cash_transactions WHERE shift_id = $1', [shift.shift_id])
    if (amount > pettyCashOnHand(ledger)) throw conflict('not_enough', 'Not enough petty cash on hand')

    await db.query(
      `INSERT INTO petty_cash_transactions (shift_id, order_id, txn_type, amount, processed_by, note)
       VALUES ($1, $2, 'purchase', $3, $4, 'Store advance (pabili)')`,
      [shift.shift_id, orderId, amount, riderId],
    )
  })
  res.status(201).json({ ok: true })
})

// ---------- History and wallet ----------

// GET /api/rider/history -> all my shifts, newest first: [{ shift, runs, deductions, settlement, pettyCash }] (getRiderHistory)
router.get('/history', async (req, res) => {
  res.json(await getShiftViews(req.user.user_id))
})

// GET /api/rider/wallet -> { shift, pettyCash, savings, savingsPerShift } (getRiderWallet)
//   pettyCash = the open (or latest) shift's ledger, purchases with their order number
//   savings   = my savings ledger, newest first, deposits with the date of their shift
router.get('/wallet', async (req, res) => {
  const riderId = req.user.user_id
  const { rows: shifts } = await query(
    "SELECT * FROM rider_shifts WHERE rider_id = $1 ORDER BY (status = 'open') DESC, started_at DESC LIMIT 1",
    [riderId],
  )
  const shift = shifts[0] || null
  const [pettyCash, savings, savingsType] = await Promise.all([
    shift
      ? query(
          `SELECT t.*, o.order_number FROM petty_cash_transactions t
             LEFT JOIN customer_orders o ON o.order_id = t.order_id
            WHERE t.shift_id = $1 ORDER BY t.created_at, t.txn_id`,
          [shift.shift_id],
        )
      : { rows: [] },
    query(
      `SELECT e.*, s.shift_date FROM rider_savings_entries e
         LEFT JOIN applied_deductions ad ON ad.applied_deduction_id = e.applied_deduction_id
         LEFT JOIN rider_shifts s ON s.shift_id = ad.shift_id
        WHERE e.rider_id = $1 ORDER BY e.created_at DESC, e.entry_id DESC`,
      [riderId],
    ),
    query('SELECT amount FROM deduction_types WHERE is_rider_savings AND is_active ORDER BY deduction_type_id LIMIT 1'),
  ])
  res.json({ shift, pettyCash: pettyCash.rows, savings: savings.rows, savingsPerShift: savingsType.rows[0]?.amount ?? 0 })
})

export default router
