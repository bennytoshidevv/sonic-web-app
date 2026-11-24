import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, notFound } from '../../middleware/errors.js'
import { pettyCashOnHand } from '../../utils/calc.js'
import { checkMoney, optionalText, toId } from '../../utils/validate.js'
import { SHIFT_VIEW, shiftMoney } from '../rider/rider.service.js'

// Settlements (module 7): the operator's end-of-shift screen. Mounted at /api/staff/shifts.
// Operators and the admin only. The staff member is always the logged-in user (from the token).
//
// At the end of a shift, cash collected (COD) is compared with the rider's net pay:
//   COD > net pay → the rider hands over the difference (cash_received)
//   net pay > COD → Sonic pays the rider the difference (payout_amount, cash or GCash + reference)
// The payout is computed here from the shift's own records (calc.js settlementAmounts), not taken
// from the browser, so it always matches the deliveries and deductions in the database.

const router = Router()
router.use(requireAuth, requireRole('operator'))

const DATE = /^\d{4}-\d{2}-\d{2}$/
// Petty cash entries staff may add. 'purchase' is recorded by the rider app for an order.
const STAFF_TXN_TYPES = ['cash_issued', 'gcash_topup', 'cash_returned', 'adjustment']

// One shift's view (same shape as the rider's History), locked first when changing it, so two
// operators can't settle the same shift or spend its petty cash at the same time.
async function loadShiftView(db, shiftId, { lock = false } = {}) {
  if (lock) {
    const { rows } = await db.query('SELECT 1 FROM rider_shifts WHERE shift_id = $1 FOR UPDATE', [shiftId])
    if (!rows[0]) throw notFound('not_found', 'Shift not found')
  }
  const { rows } = await db.query(`SELECT ${SHIFT_VIEW} AS view FROM rider_shifts s WHERE s.shift_id = $1`, [shiftId])
  if (!rows[0]) throw notFound('not_found', 'Shift not found')
  return rows[0].view
}

// GET /api/staff/shifts?date=YYYY-MM-DD -> shifts that started that day, earliest first (getShiftsOnDate)
//   each: { shift, runs, deductions, settlement, pettyCash, rider, profile }
router.get('/', async (req, res) => {
  const date = String(req.query.date ?? '')
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) throw badRequest('invalid_date', 'Use a date like 2026-11-25')
  const { rows } = await query(
    `SELECT ${SHIFT_VIEW} || jsonb_build_object(
              'rider', jsonb_build_object('user_id', u.user_id, 'full_name', u.full_name, 'email', u.email,
                                          'contact_number', u.contact_number, 'role', u.role, 'account_status', u.account_status,
                                          'created_at', u.created_at, 'updated_at', u.updated_at),
              'profile', to_jsonb(p)) AS view
       FROM rider_shifts s
       JOIN users u ON u.user_id = s.rider_id
       JOIN rider_profiles p ON p.user_id = s.rider_id
      WHERE s.shift_date = $1
      ORDER BY s.started_at`,
    [date],
  )
  res.json(rows.map((r) => r.view))
})

// POST /api/staff/shifts/:id/settlement  { cash_received, payout_method, payout_reference, notes, return_petty_cash } -> { ok } (recordSettlement)
// Once per shift, only after the rider closed it. cash_received is the cash the operator actually counted
// (a shortage stays visible on the page). return_petty_cash also records the unused petty cash as returned.
router.post('/:id/settlement', async (req, res) => {
  const shiftId = toId(req.params.id, 'shift id')
  await withTransaction(async (db) => {
    const view = await loadShiftView(db, shiftId, { lock: true })
    if (view.shift.status !== 'closed') throw conflict('shift_not_closed', 'The rider must end the shift first')
    if (view.settlement) throw conflict('already_settled', 'This shift is already settled')

    const { toRemit, toPayRider, pettyOnHand } = shiftMoney(view)
    const cashReceived = toRemit > 0 ? checkMoney(req.body?.cash_received, 'Cash received') : 0
    let payoutMethod = null
    let payoutReference = null
    if (toPayRider > 0) {
      payoutMethod = req.body?.payout_method
      if (!['cash', 'gcash'].includes(payoutMethod)) throw badRequest('invalid', 'Choose cash or GCash for the payout')
      if (payoutMethod === 'gcash') {
        payoutReference = optionalText(req.body?.payout_reference, 'GCash reference', 100)
        if (!payoutReference) throw badRequest('reference_required', 'Enter the GCash reference number')
      }
    }

    if (req.body?.return_petty_cash === true && pettyOnHand > 0) {
      await db.query(
        `INSERT INTO petty_cash_transactions (shift_id, txn_type, amount, processed_by, note)
         VALUES ($1, 'cash_returned', $2, $3, 'Returned at settlement')`,
        [shiftId, pettyOnHand, req.user.user_id],
      )
    }
    await db.query(
      `INSERT INTO shift_settlements (shift_id, settled_by, cash_received, payout_amount, payout_method, payout_reference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [shiftId, req.user.user_id, cashReceived, toPayRider, payoutMethod, payoutReference, optionalText(req.body?.notes, 'Notes', 500)],
    )
  })
  res.status(201).json({ ok: true })
})

// POST /api/staff/shifts/:id/petty-cash  { txn_type, amount, gcash_reference_id, note } -> { ok } (addPettyCashTransaction)
// For a shift that is not settled yet: cash issued, GCash top-up (needs the reference), cash returned
// (not more than what the rider has), or an adjustment.
router.post('/:id/petty-cash', async (req, res) => {
  const shiftId = toId(req.params.id, 'shift id')
  const type = req.body?.txn_type
  if (!STAFF_TXN_TYPES.includes(type)) throw badRequest('invalid_type', 'Choose cash issued, GCash top-up, cash returned or adjustment')
  const amount = Math.round(Number(req.body?.amount) * 100) / 100
  if (!(amount > 0) || amount >= 100000000) throw badRequest('invalid_amount', 'Enter an amount above ₱0.00')
  const reference = optionalText(req.body?.gcash_reference_id, 'GCash reference', 100)
  if (type === 'gcash_topup' && !reference) throw badRequest('reference_required', 'Enter the GCash reference number')

  await withTransaction(async (db) => {
    const view = await loadShiftView(db, shiftId, { lock: true })
    if (view.settlement) throw conflict('already_settled', 'This shift is already settled')
    if (type === 'cash_returned' && amount > pettyCashOnHand(view.pettyCash)) {
      throw conflict('not_enough', 'The rider does not have that much petty cash')
    }
    await db.query(
      `INSERT INTO petty_cash_transactions (shift_id, txn_type, amount, gcash_reference_id, processed_by, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [shiftId, type, amount, type === 'gcash_topup' ? reference : null, req.user.user_id, optionalText(req.body?.note, 'Note', 300)],
    )
  })
  res.status(201).json({ ok: true })
})

export default router
