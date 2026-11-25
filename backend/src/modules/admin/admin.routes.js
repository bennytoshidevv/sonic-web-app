import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, notFound } from '../../middleware/errors.js'
import { audit } from '../../utils/audit.js'
import { savingsBalance } from '../../utils/calc.js'
import { checkBoolean, checkMoney, optionalText, requiredText, tierRangeProblem, toId } from '../../utils/validate.js'
import { getStaffOrders } from '../orders/orders.service.js'
import { getRidersOverview } from '../rider/rider.service.js'
import { getReportSummary } from './reports.service.js'

// Admin (module 8): reports, settings and rider savings. Mounted at /api/admin. The admin only.
// Settings changes only affect new orders, deliveries and shifts: placed orders and recorded earnings
// keep the amounts copied into them. Every change is written to audit_logs (same actions as the mock).

const router = Router()
router.use(requireAuth, requireRole('admin'))

// ---------- A01 Reports ----------

// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD -> { orders, riders, deductions, summary } (getReportData)
//   orders     = every order (staff view) + its delivery_earnings row (null if not delivered by a rider)
//   riders     = the riders overview (with reviews)
//   deductions = every applied deduction with its type
//   summary    = only when from/to are given: the report totals for that range computed in SQL
//                (sales, orders per restaurant, top items, rider performance, payment methods; reports.service.js)
// The first three are the mock's shape, so the current Reports page (which computes with calc.js) keeps working.
const DATE = /^\d{4}-\d{2}-\d{2}$/
router.get('/reports', async (req, res) => {
  const { from, to } = req.query
  if ((from || to) && !(DATE.test(from) && DATE.test(to) && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to)) && from <= to)) {
    throw badRequest('invalid_date', 'Use from and to dates like 2026-11-25, with from on or before to')
  }
  const [orders, earnings, riders, deductions] = await Promise.all([
    getStaffOrders(),
    query('SELECT e.*, d.order_id FROM delivery_earnings e JOIN deliveries d ON d.delivery_id = e.delivery_id'),
    getRidersOverview(),
    query(
      `SELECT ad.*, to_jsonb(dt) AS type
         FROM applied_deductions ad JOIN deduction_types dt ON dt.deduction_type_id = ad.deduction_type_id
        ORDER BY ad.applied_at, ad.applied_deduction_id`,
    ),
  ])
  const earningByOrder = new Map(earnings.rows.map(({ order_id, ...earning }) => [order_id, earning]))
  res.json({
    orders: orders.map((entry) => ({ ...entry, earning: earningByOrder.get(entry.order.order_id) ?? null })),
    riders,
    deductions: deductions.rows,
    ...(from && { summary: await getReportSummary(from, to) }),
  })
})

// ---------- A02 Settings ----------

// GET /api/admin/settings -> { barangays, tiers, deductionTypes, rates } (getSettingsData)
//   rates = newest first, each with created_by_name and state: 'upcoming' (starts later),
//   'active' (the one in use now) or 'superseded' (replaced by a newer one).
router.get('/settings', async (req, res) => {
  const [barangays, tiers, deductionTypes, rates] = await Promise.all([
    query('SELECT * FROM barangays ORDER BY barangay_id'),
    query('SELECT * FROM gas_allowance_tiers WHERE is_active ORDER BY min_delivery_fee'),
    query('SELECT * FROM deduction_types ORDER BY deduction_type_id'),
    query(`
      SELECT r.*, COALESCE(u.full_name, 'System') AS created_by_name,
             CASE WHEN r.effective_from > now() THEN 'upcoming'
                  WHEN r.setting_id = (SELECT setting_id FROM rate_settings WHERE effective_from <= now()
                                        ORDER BY effective_from DESC, setting_id DESC LIMIT 1) THEN 'active'
                  ELSE 'superseded' END AS state
        FROM rate_settings r
        LEFT JOIN users u ON u.user_id = r.created_by
       ORDER BY r.effective_from DESC, r.setting_id DESC`),
  ])
  res.json({ barangays: barangays.rows, tiers: tiers.rows, deductionTypes: deductionTypes.rows, rates: rates.rows })
})

// The barangay form: { barangay_name, city_municipality, delivery_fee, is_active }.
function readBarangay(body) {
  const name = optionalText(body?.barangay_name, 'Barangay', 100)
  const city = optionalText(body?.city_municipality, 'Municipality', 100)
  if (!name || !city) throw badRequest('invalid', 'Barangay and municipality are required')
  return { name, city, fee: checkMoney(body?.delivery_fee, 'Delivery fee'), isActive: body?.is_active !== false }
}

async function checkBarangayName(db, { name, city }, exceptId = 0) {
  const { rows } = await db.query(
    `SELECT 1 FROM barangays WHERE lower(barangay_name) = lower($1) AND lower(city_municipality) = lower($2) AND barangay_id <> $3`,
    [name, city, exceptId],
  )
  if (rows[0]) throw conflict('duplicate', 'This barangay is already listed')
}

// POST /api/admin/barangays -> { barangay } (saveBarangay, new)
router.post('/barangays', async (req, res) => {
  const data = readBarangay(req.body)
  const barangay = await withTransaction(async (db) => {
    await checkBarangayName(db, data)
    const { rows } = await db.query(
      'INSERT INTO barangays (barangay_name, city_municipality, delivery_fee, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.name, data.city, data.fee, data.isActive],
    )
    await audit(db, { user_id: req.user.user_id, action: 'create_barangay', target_entity: 'barangays', target_id: rows[0].barangay_id, new_value: rows[0] })
    return rows[0]
  })
  res.status(201).json({ barangay })
})

// PUT /api/admin/barangays/:id -> { barangay } (saveBarangay, edit)
// A new fee only affects new orders: placed orders keep base_delivery_fee.
router.put('/barangays/:id', async (req, res) => {
  const barangayId = toId(req.params.id, 'barangay id')
  const data = readBarangay(req.body)
  const barangay = await withTransaction(async (db) => {
    const { rows: found } = await db.query('SELECT * FROM barangays WHERE barangay_id = $1 FOR UPDATE', [barangayId])
    if (!found[0]) throw notFound('not_found', 'Barangay not found')
    await checkBarangayName(db, data, barangayId)
    const { rows } = await db.query(
      `UPDATE barangays SET barangay_name = $2, city_municipality = $3, delivery_fee = $4, is_active = $5
        WHERE barangay_id = $1 RETURNING *`,
      [barangayId, data.name, data.city, data.fee, data.isActive],
    )
    await audit(db, { user_id: req.user.user_id, action: 'update_barangay', target_entity: 'barangays', target_id: barangayId, old_value: found[0], new_value: rows[0] })
    return rows[0]
  })
  res.json({ barangay })
})

// PUT /api/admin/gas-tiers  { tiers: [{ min_delivery_fee, max_delivery_fee (null = no limit), allowance_amount }] } -> { ok } (saveGasTiers)
// All tiers are replaced in ONE transaction: the old ones are kept as history (is_active = false) and the
// new ones are inserted, so there is never a moment with no tiers or with a gap.
router.put('/gas-tiers', async (req, res) => {
  if (!Array.isArray(req.body?.tiers)) throw badRequest('invalid_tiers', 'Send a list of tiers')
  const tiers = req.body.tiers.map((t) => ({
    min_delivery_fee: checkMoney(t?.min_delivery_fee, 'Fee from'),
    max_delivery_fee: t?.max_delivery_fee === null || t?.max_delivery_fee === undefined || t?.max_delivery_fee === '' ? null : checkMoney(t.max_delivery_fee, 'Fee to'),
    allowance_amount: checkMoney(t?.allowance_amount, 'Allowance'),
  }))
  const problem = tierRangeProblem(tiers)
  if (problem) throw badRequest('invalid_tiers', problem)

  await withTransaction(async (db) => {
    // Lock the tier table so two admins saving at once can't leave two sets of active tiers.
    await db.query('LOCK TABLE gas_allowance_tiers IN EXCLUSIVE MODE')
    const { rows: old } = await db.query('UPDATE gas_allowance_tiers SET is_active = false WHERE is_active RETURNING *')
    for (const t of [...tiers].sort((a, b) => a.min_delivery_fee - b.min_delivery_fee)) {
      await db.query('INSERT INTO gas_allowance_tiers (min_delivery_fee, max_delivery_fee, allowance_amount) VALUES ($1, $2, $3)', [
        t.min_delivery_fee,
        t.max_delivery_fee,
        t.allowance_amount,
      ])
    }
    await audit(db, { user_id: req.user.user_id, action: 'update_gas_tiers', target_entity: 'gas_allowance_tiers', target_id: 0, old_value: old, new_value: tiers })
  })
  res.json({ ok: true })
})

// The deduction form: { name, amount, frequency: 'per_delivery'|'per_shift', is_rider_savings, is_active }.
function readDeduction(body) {
  const frequency = body?.frequency
  if (!['per_delivery', 'per_shift'].includes(frequency)) throw badRequest('invalid', 'Choose per delivery or per shift')
  return {
    name: requiredText(body?.name, 'Name', 100),
    amount: checkMoney(body?.amount, 'Amount'),
    frequency,
    isRiderSavings: body?.is_rider_savings === undefined ? false : checkBoolean(body.is_rider_savings, 'is_rider_savings'),
    isActive: body?.is_active !== false,
  }
}

async function checkDeductionName(db, name, exceptId = 0) {
  const { rows } = await db.query('SELECT 1 FROM deduction_types WHERE lower(name) = lower($1) AND deduction_type_id <> $2', [name, exceptId])
  if (rows[0]) throw conflict('duplicate', 'A deduction with this name already exists')
}

// POST /api/admin/deduction-types -> { deductionType } (saveDeductionType, new)
router.post('/deduction-types', async (req, res) => {
  const data = readDeduction(req.body)
  const deductionType = await withTransaction(async (db) => {
    await checkDeductionName(db, data.name)
    const { rows } = await db.query(
      `INSERT INTO deduction_types (name, amount, frequency, is_rider_savings, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.amount, data.frequency, data.isRiderSavings, data.isActive],
    )
    await audit(db, { user_id: req.user.user_id, action: 'create_deduction_type', target_entity: 'deduction_types', target_id: rows[0].deduction_type_id, new_value: rows[0] })
    return rows[0]
  })
  res.status(201).json({ deductionType })
})

// PUT /api/admin/deduction-types/:id -> { deductionType } (saveDeductionType, edit)
// Applies to new shifts and deliveries only: deductions already charged keep their amount.
router.put('/deduction-types/:id', async (req, res) => {
  const typeId = toId(req.params.id, 'deduction type id')
  const data = readDeduction(req.body)
  const deductionType = await withTransaction(async (db) => {
    const { rows: found } = await db.query('SELECT * FROM deduction_types WHERE deduction_type_id = $1 FOR UPDATE', [typeId])
    if (!found[0]) throw notFound('not_found', 'Deduction type not found')
    await checkDeductionName(db, data.name, typeId)
    const { rows } = await db.query(
      `UPDATE deduction_types SET name = $2, amount = $3, frequency = $4, is_rider_savings = $5, is_active = $6
        WHERE deduction_type_id = $1 RETURNING *`,
      [typeId, data.name, data.amount, data.frequency, data.isRiderSavings, data.isActive],
    )
    await audit(db, { user_id: req.user.user_id, action: 'update_deduction_type', target_entity: 'deduction_types', target_id: typeId, old_value: found[0], new_value: rows[0] })
    return rows[0]
  })
  res.json({ deductionType })
})

// POST /api/admin/rate-settings  { extra_store_fee, rider_share_pct, effective_from } -> { rate } (addRateSetting)
// Always a NEW row (history is kept). effective_from in the future = scheduled ("upcoming").
// effective_from is a local Philippine date-time like '2026-12-01T00:00:00'.
router.post('/rate-settings', async (req, res) => {
  const fee = checkMoney(req.body?.extra_store_fee, 'Extra-store fee')
  const pct = Math.round(Number(req.body?.rider_share_pct) * 100) / 100
  if (!(pct > 0 && pct <= 100)) throw badRequest('invalid', 'Rider share must be more than 0 and at most 100%')
  const effectiveFrom = String(req.body?.effective_from ?? '')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(effectiveFrom) || Number.isNaN(Date.parse(effectiveFrom))) {
    throw badRequest('invalid', 'Choose when the new rates start')
  }
  const rate = await withTransaction(async (db) => {
    // The rate in use before this change, kept in the audit log as the "old value".
    const { rows: before } = await db.query(
      'SELECT * FROM rate_settings WHERE effective_from <= now() ORDER BY effective_from DESC, setting_id DESC LIMIT 1',
    )
    // A time without a zone is read in the connection's zone (Asia/Manila).
    const { rows } = await db.query(
      `INSERT INTO rate_settings (extra_store_fee, rider_share_pct, effective_from, created_by)
       VALUES ($1, $2, $3::timestamp, $4) RETURNING *`,
      [fee, pct, effectiveFrom, req.user.user_id],
    )
    await audit(db, { user_id: req.user.user_id, action: 'create_rate_setting', target_entity: 'rate_settings', target_id: rows[0].setting_id, old_value: before[0] ?? null, new_value: rows[0] })
    return rows[0]
  })
  res.status(201).json({ rate })
})

// ---------- A03 Rider savings ----------

// GET /api/admin/savings -> every rider: { user, profile, entries, lastShift } (getSavingsOverview)
//   entries = savings ledger, newest first, with shift_date (for shift deposits) and processed_by_name
//   ('Automatic' for deposits made by the system). The page computes balances with calc.js.
router.get('/savings', async (req, res) => {
  const { rows } = await query(`
    SELECT jsonb_build_object(
      'user', jsonb_build_object('user_id', u.user_id, 'full_name', u.full_name, 'email', u.email,
                                 'contact_number', u.contact_number, 'role', u.role, 'account_status', u.account_status,
                                 'created_at', u.created_at, 'updated_at', u.updated_at),
      'profile', to_jsonb(p),
      'entries', COALESCE((
        SELECT jsonb_agg(to_jsonb(e) || jsonb_build_object('shift_date', s.shift_date,
                                                         'processed_by_name', COALESCE(pu.full_name, 'Automatic'))
                         ORDER BY e.created_at DESC, e.entry_id DESC)
          FROM rider_savings_entries e
          LEFT JOIN applied_deductions ad ON ad.applied_deduction_id = e.applied_deduction_id
          LEFT JOIN rider_shifts s ON s.shift_id = ad.shift_id
          LEFT JOIN users pu ON pu.user_id = e.processed_by
         WHERE e.rider_id = u.user_id), '[]'),
      'lastShift', (SELECT to_jsonb(ls) FROM rider_shifts ls WHERE ls.rider_id = u.user_id ORDER BY ls.started_at DESC LIMIT 1)
    ) AS rider
    FROM users u
    LEFT JOIN rider_profiles p ON p.user_id = u.user_id
    WHERE u.role = 'rider'
    ORDER BY u.user_id`)
  res.json(rows.map((r) => r.rider))
})

// POST /api/admin/savings/:riderId/withdrawals  { amount, note } -> { entry } (recordSavingsWithdrawal)
// Pays out part of a rider's savings. Never more than the balance (calc.js savingsBalance), and the note
// (what it is for) is required. The rider's profile row is locked so two withdrawals can't both pass the check.
router.post('/savings/:riderId/withdrawals', async (req, res) => {
  const riderId = toId(req.params.riderId, 'rider id')
  const amount = Math.round(Number(req.body?.amount) * 100) / 100
  if (!(amount > 0) || amount >= 100000000) throw badRequest('invalid_amount', 'Enter an amount above ₱0.00')
  const note = optionalText(req.body?.note, 'Note', 300)
  if (!note) throw badRequest('note_required', 'Write what the withdrawal is for')

  const entry = await withTransaction(async (db) => {
    const { rows: rider } = await db.query('SELECT 1 FROM rider_profiles WHERE user_id = $1 FOR UPDATE', [riderId])
    if (!rider[0]) throw notFound('not_found', 'Rider not found')
    const { rows: ledger } = await db.query('SELECT entry_type, amount FROM rider_savings_entries WHERE rider_id = $1', [riderId])
    const balance = savingsBalance(ledger)
    if (amount > balance) throw conflict('not_enough', 'Not enough savings for that amount')
    const { rows } = await db.query(
      `INSERT INTO rider_savings_entries (rider_id, entry_type, amount, processed_by, note)
       VALUES ($1, 'withdrawal', $2, $3, $4) RETURNING *`,
      [riderId, amount, req.user.user_id, note],
    )
    // Old and new value = the rider's balance before and after, plus the new ledger row.
    await audit(db, {
      user_id: req.user.user_id,
      action: 'savings_withdrawal',
      target_entity: 'rider_savings_entries',
      target_id: rows[0].entry_id,
      old_value: { balance },
      new_value: { ...rows[0], balance: Math.round((balance - amount) * 100) / 100 },
    })
    return rows[0]
  })
  res.status(201).json({ entry })
})

export default router
