import { query } from '../../db.js'
import { gasAllowanceFor } from '../../utils/calc.js'
import { ORDER_DETAILS } from '../orders/orders.service.js'

// Rider pay, shift and delivery logic shared by the rider routes (module 5) and,
// later, the operator's Settlements screen (module 7).

// ---------- Settings in use ----------

// The rate in use now: the latest rate_settings row whose effective_from has arrived.
export async function currentRate(db = { query }) {
  const { rows } = await db.query(
    'SELECT * FROM rate_settings WHERE effective_from <= now() ORDER BY effective_from DESC, setting_id DESC LIMIT 1',
  )
  return rows[0]
}

export async function activeGasTiers(db = { query }) {
  const { rows } = await db.query('SELECT * FROM gas_allowance_tiers WHERE is_active ORDER BY min_delivery_fee')
  return rows
}

// ---------- Rider state ----------

// The rider's open shift (locked when `lock` is true, so two requests can't both use its petty cash).
export async function findOpenShift(db, riderId, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM rider_shifts WHERE rider_id = $1 AND status = 'open'${lock ? ' FOR UPDATE' : ''}`,
    [riderId],
  )
  return rows[0] || null
}

// Sets a rider back to 'available' once they carry no accepted delivery any more.
// Only a 'busy' rider is changed: a rider who went offline stays offline.
export async function freeRiderIfIdle(db, riderId) {
  await db.query(
    `UPDATE rider_profiles SET availability_status = 'available'
      WHERE user_id = $1 AND availability_status = 'busy'
        AND NOT EXISTS (SELECT 1 FROM delivery_assignments
                         WHERE rider_id = $1 AND ended_at IS NULL AND response_status = 'accepted')`,
    [riderId],
  )
}

// ---------- Deductions and earnings (snapshots) ----------

// Charges one deduction to a shift, copying today's amount (later setting changes don't change it).
// A savings deduction is also deposited into the rider's savings ledger.
async function applyDeduction(db, type, shift, earningId) {
  const { rows } = await db.query(
    `INSERT INTO applied_deductions (deduction_type_id, shift_id, earning_id, amount)
     VALUES ($1, $2, $3, $4) RETURNING applied_deduction_id`,
    [type.deduction_type_id, shift.shift_id, earningId, type.amount],
  )
  if (type.is_rider_savings) {
    await db.query(
      `INSERT INTO rider_savings_entries (rider_id, applied_deduction_id, entry_type, amount)
       VALUES ($1, $2, 'deposit', $3)`,
      [shift.rider_id, rows[0].applied_deduction_id, type.amount],
    )
  }
}

// Charges every active deduction of one frequency ('per_shift' or 'per_delivery').
export async function applyDeductions(db, frequency, shift, earningId = null) {
  const { rows: types } = await db.query(
    'SELECT * FROM deduction_types WHERE is_active AND frequency = $1 ORDER BY deduction_type_id',
    [frequency],
  )
  for (const type of types) await applyDeduction(db, type, shift, earningId)
}

// A delivered order's pay snapshot: the gas allowance for its barangay fee and today's rider share %.
// Gross pay is computed from these when read (calc.js deliveryGross), so it is never stored.
export async function recordEarning(db, { deliveryId, shift, baseDeliveryFee }) {
  const [rate, tiers] = await Promise.all([currentRate(db), activeGasTiers(db)])
  const { rows } = await db.query(
    `INSERT INTO delivery_earnings (delivery_id, shift_id, gas_allowance_amount, rider_share_pct)
     VALUES ($1, $2, $3, $4) RETURNING earning_id`,
    [deliveryId, shift.shift_id, gasAllowanceFor(baseDeliveryFee, tiers), rate.rider_share_pct],
  )
  await applyDeductions(db, 'per_delivery', shift, rows[0].earning_id)
}

// ---------- Shift view (rider History, operator Settlements) ----------

// One JSON object per shift, shaped like the mock's shiftView():
//   { shift, runs, deductions, settlement, pettyCash }
//   runs = delivered orders of the shift, newest first: { earning, order, stores, payment, delivered_at, customer_name }
// Used as `SELECT ${SHIFT_VIEW} AS view FROM rider_shifts s ...`.
export const SHIFT_VIEW = `
  jsonb_build_object(
    'shift', to_jsonb(s),
    'runs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'earning', to_jsonb(e),
               'order', x.details -> 'order',
               'stores', x.details -> 'stores',
               'payment', x.details -> 'payment',
               'delivered_at', dv.delivered_at,
               'customer_name', cu.full_name)
             ORDER BY dv.delivered_at DESC, e.earning_id DESC)
        FROM delivery_earnings e
        JOIN deliveries dv ON dv.delivery_id = e.delivery_id
        JOIN customer_orders o ON o.order_id = dv.order_id
        JOIN users cu ON cu.user_id = o.customer_id
        CROSS JOIN LATERAL (SELECT ${ORDER_DETAILS} AS details) x
       WHERE e.shift_id = s.shift_id), '[]'),
    'deductions', COALESCE((
      SELECT jsonb_agg(to_jsonb(ad) || jsonb_build_object('name', dt.name) ORDER BY ad.applied_at, ad.applied_deduction_id)
        FROM applied_deductions ad
        JOIN deduction_types dt ON dt.deduction_type_id = ad.deduction_type_id
       WHERE ad.shift_id = s.shift_id), '[]'),
    'settlement', (SELECT to_jsonb(ss) FROM shift_settlements ss WHERE ss.shift_id = s.shift_id),
    'pettyCash', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at, t.txn_id)
        FROM petty_cash_transactions t WHERE t.shift_id = s.shift_id), '[]')
  )`

// All shifts of a rider, newest first (getRiderHistory).
export async function getShiftViews(riderId) {
  const { rows } = await query(
    `SELECT ${SHIFT_VIEW} AS view FROM rider_shifts s WHERE s.rider_id = $1 ORDER BY s.started_at DESC`,
    [riderId],
  )
  return rows.map((r) => r.view)
}
