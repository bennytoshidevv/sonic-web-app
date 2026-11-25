// Admin API tests (module 8): reports, settings, rider savings. Needs a seeded database: npm run db:reset, then npm test.
// Settings are shared by every other test file, so each test here puts back what it changed.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'
import { orderExtraStoreFees, orderItemsSubtotal, orderTotal } from '../src/utils/calc.js'

let admin
let adminId
let operator

setup(async () => {
  const res = await call('POST', '/auth/login', { email: 'admin@sonic.ph', password: 'sonic1234' })
  admin = res.body.token
  adminId = res.body.user.user_id
  operator = await loginAs('operator@sonic.ph')
})

const a = (method, path, body, token = admin) => call(method, `/admin${path}`, body, token)

async function lastAudit(entity) {
  const { rows } = await pool.query('SELECT user_id, action, old_value, new_value FROM audit_logs WHERE target_entity = $1 ORDER BY audit_id DESC LIMIT 1', [entity])
  return rows[0]
}

describe('reports', () => {
  test('every order with its earning, the riders and the applied deductions', async () => {
    const { status, body } = await a('GET', '/reports')
    assert.equal(status, 200)
    const tara = body.orders.find((e) => e.order.order_id === 1006) // delivered to Tara (₱150 fee)
    assert.equal(tara.earning.gas_allowance_amount, 20)
    assert.equal(tara.earning.rider_share_pct, 70)
    assert.equal(tara.customer.full_name, 'Liza Bautista')
    assert.equal(body.orders.find((e) => e.order.order_id === 1004).earning, null) // pending
    assert.ok(body.riders.find((r) => r.user.user_id === 2).reviews.length >= 1)
    const d = body.deductions[0]
    assert.ok(['Operator fee', 'Box rent', 'Rider savings'].includes(d.type.name))
    assert.equal(typeof d.type.is_rider_savings, 'boolean')
  })
})

describe('report totals (SQL)', () => {
  // Nov 20, 2026 in the seed: order 1002 (Maria: Half Lechon + 2 Java Rice, North Centro ₱40, COD) and
  // order 1010 (Liza: Whole Lechon, Tara ₱150, COD), both from Golden Roast Express, both delivered by Marcelo.
  test('one day of seed data: totals, restaurants, items, riders, payments, Sonic income', async () => {
    const { status, body } = await a('GET', '/reports?from=2026-11-20&to=2026-11-20')
    assert.equal(status, 200)
    const s = body.summary
    // sales = (165 + 2×25 + 40) + (320 + 150) = 255 + 470 = 725; delivery fees = 40 + 150 = 190
    assert.deepEqual([s.totals.orders, s.totals.delivered, s.totals.cancelled, s.totals.sales, s.totals.delivery_fees], [2, 2, 0, 725, 190])
    assert.deepEqual(s.perRestaurant.map((r) => [r.name, r.orders]), [['Golden Roast Express', 2]])
    assert.deepEqual(s.topItems.map((i) => [i.name, i.quantity, i.sales]), [['Whole Lechon Manok', 1, 320], ['Half Lechon Manok', 1, 165], ['Java Rice', 2, 50]])
    // Marcelo: 1002 → ₱0 allowance + ₱28 share; 1010 → ₱20 allowance + ₱91 share = ₱139
    const marcelo = s.riders.find((r) => r.user_id === 2)
    assert.deepEqual([marcelo.delivered, marcelo.gross_pay, marcelo.rating], [2, 139, 5])
    assert.equal(s.riders.find((r) => r.user_id === 8).delivered, 0)
    assert.deepEqual(s.payments.map((p) => [p.payment_method, p.orders, p.amount]).find((p) => p[0] === 'cod'), ['cod', 2, 725])
    assert.equal(s.payments.length, 5) // every method listed
    // Sonic: fee share (40 − 0 − 28) + (150 − 20 − 91) = 51, plus box rent ₱10 + 2 operator fees = ₱30 → ₱81
    assert.deepEqual([s.totals.fee_share, s.totals.rider_fees, s.totals.sonic_income], [51, 30, 81])
  })

  test('SQL totals equal the calc.js totals the page computes from the raw orders', async () => {
    const { body } = await a('GET', '/reports?from=2026-11-15&to=2026-11-20')
    const inRange = body.orders.filter((e) => {
      const day = new Date(e.order.placed_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      return day >= '2026-11-15' && day <= '2026-11-20'
    })
    const delivered = inRange.filter((e) => e.order.order_status === 'delivered')
    const sales = delivered.reduce((sum, e) => sum + orderTotal(orderItemsSubtotal(e.stores.flatMap((st) => st.items)), e.order.base_delivery_fee, orderExtraStoreFees(e.stores)), 0)
    assert.equal(body.summary.totals.sales, sales)
    assert.equal(body.summary.totals.orders, inRange.length)
    assert.equal(body.summary.totals.cancelled, 1) // 1003 on Nov 19
  })

  test('bad dates', async () => {
    assert.equal((await a('GET', '/reports?from=2026-11-20')).body.error, 'invalid_date')
    assert.equal((await a('GET', '/reports?from=2026-11-21&to=2026-11-20')).body.error, 'invalid_date')
    assert.equal((await a('GET', '/reports')).body.summary, undefined) // no range: raw data only, like the mock
  })
})

describe('settings', () => {
  test('settings data: barangays, active tiers, deductions, rate history with state', async () => {
    const { body } = await a('GET', '/settings')
    assert.equal(body.barangays.length, 5)
    assert.deepEqual(body.tiers.map((t) => t.allowance_amount), [10, 20, 50, 80, 120])
    assert.equal(body.deductionTypes.length, 3)
    assert.deepEqual(body.rates.map((r) => [r.rider_share_pct, r.state, r.created_by_name]), [[70, 'active', body.rates[0].created_by_name]])
  })

  test('barangays: add, edit (audited), no duplicates', async () => {
    const add = await a('POST', '/barangays', { barangay_name: 'Anib', city_municipality: 'Sipocot', delivery_fee: '120', is_active: true })
    assert.equal(add.status, 201)
    const id = add.body.barangay.barangay_id
    try {
      assert.equal(add.body.barangay.delivery_fee, 120)
      assert.equal((await a('POST', '/barangays', { barangay_name: 'tara', city_municipality: 'SIPOCOT', delivery_fee: 1 })).body.error, 'duplicate')
      const edit = await a('PUT', `/barangays/${id}`, { barangay_name: 'Anib', city_municipality: 'Sipocot', delivery_fee: 125, is_active: false })
      assert.equal(edit.body.barangay.delivery_fee, 125)
      assert.equal(edit.body.barangay.is_active, false)
      const log = await lastAudit('barangays')
      assert.equal(log.action, 'update_barangay')
      assert.deepEqual([log.old_value.delivery_fee, log.new_value.delivery_fee], [120, 125])
      assert.equal((await a('POST', '/barangays', { barangay_name: '', city_municipality: 'Sipocot', delivery_fee: 1 })).body.error, 'invalid')
      assert.equal((await a('PUT', '/barangays/99999', { barangay_name: 'X', city_municipality: 'Y', delivery_fee: 1 })).status, 404)
    } finally {
      await pool.query('DELETE FROM barangays WHERE barangay_id = $1', [id])
    }
  })

  test('a barangay fee change does not change placed orders', async () => {
    const before = (await a('GET', '/reports')).body.orders.find((e) => e.order.order_id === 1001).order.base_delivery_fee
    await a('PUT', '/barangays/1', { barangay_name: 'North Centro', city_municipality: 'Sipocot', delivery_fee: 45 })
    try {
      assert.equal((await a('GET', '/reports')).body.orders.find((e) => e.order.order_id === 1001).order.base_delivery_fee, before)
    } finally {
      await a('PUT', '/barangays/1', { barangay_name: 'North Centro', city_municipality: 'Sipocot', delivery_fee: 40 })
    }
  })

  test('gas tiers: replaced in one go, old ones kept as history, gaps refused', async () => {
    const original = (await a('GET', '/settings')).body.tiers.map(({ min_delivery_fee, max_delivery_fee, allowance_amount }) => ({ min_delivery_fee, max_delivery_fee, allowance_amount }))
    const gap = await a('PUT', '/gas-tiers', { tiers: [{ min_delivery_fee: 0, max_delivery_fee: 100, allowance_amount: 5 }, { min_delivery_fee: 150, max_delivery_fee: null, allowance_amount: 30 }] })
    assert.equal(gap.status, 400)
    assert.equal(gap.body.error, 'invalid_tiers')
    assert.match(gap.body.message, /should start at ₱101/)
    assert.equal((await a('PUT', '/gas-tiers', { tiers: [] })).body.error, 'invalid_tiers')
    const overlap = await a('PUT', '/gas-tiers', { tiers: [{ min_delivery_fee: 0, max_delivery_fee: 100, allowance_amount: 5 }, { min_delivery_fee: 90, max_delivery_fee: null, allowance_amount: 30 }] })
    assert.equal(overlap.body.error, 'invalid_tiers') // ₱90–₱100 would be in two tiers
    assert.match(overlap.body.message, /should start at ₱101/)

    const before = (await pool.query('SELECT count(*)::int AS n FROM gas_allowance_tiers')).rows[0].n
    const ok = await a('PUT', '/gas-tiers', { tiers: [{ min_delivery_fee: 101, max_delivery_fee: '', allowance_amount: 25 }, { min_delivery_fee: 0, max_delivery_fee: 100, allowance_amount: 5 }] })
    try {
      assert.deepEqual(ok.body, { ok: true })
      assert.deepEqual((await a('GET', '/settings')).body.tiers.map((t) => [t.min_delivery_fee, t.max_delivery_fee, t.allowance_amount]), [[0, 100, 5], [101, null, 25]])
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM gas_allowance_tiers')).rows[0].n, before + 2) // nothing deleted
      assert.equal((await lastAudit('gas_allowance_tiers')).action, 'update_gas_tiers')
    } finally {
      assert.deepEqual((await a('PUT', '/gas-tiers', { tiers: original })).body, { ok: true })
    }
  })

  test('deduction types: add, edit, no duplicate names', async () => {
    const add = await a('POST', '/deduction-types', { name: 'Uniform', amount: 5, frequency: 'per_shift', is_rider_savings: false, is_active: false })
    assert.equal(add.status, 201)
    const id = add.body.deductionType.deduction_type_id
    assert.equal((await a('POST', '/deduction-types', { name: 'box rent', amount: 1, frequency: 'per_shift' })).body.error, 'duplicate')
    assert.equal((await a('POST', '/deduction-types', { name: 'X', amount: 1, frequency: 'weekly' })).body.error, 'invalid')
    const edit = await a('PUT', `/deduction-types/${id}`, { name: 'Uniform rent', amount: 7.5, frequency: 'per_shift', is_active: false })
    assert.equal(edit.body.deductionType.amount, 7.5)
    assert.equal((await lastAudit('deduction_types')).action, 'update_deduction_type')
  })

  test('rates: a new row is added; a future one is "upcoming" and does not change the current rate', async () => {
    assert.equal((await a('POST', '/rate-settings', { extra_store_fee: 10, rider_share_pct: 0, effective_from: '2030-01-01T00:00' })).body.error, 'invalid')
    assert.equal((await a('POST', '/rate-settings', { extra_store_fee: 10, rider_share_pct: 72 })).body.error, 'invalid')
    const res = await a('POST', '/rate-settings', { extra_store_fee: 12, rider_share_pct: 72, effective_from: '2030-01-01T00:00' })
    assert.equal(res.status, 201)
    try {
      assert.equal(res.body.rate.created_by, adminId)
      const rates = (await a('GET', '/settings')).body.rates
      assert.deepEqual(rates.map((r) => [r.rider_share_pct, r.state]), [[72, 'upcoming'], [70, 'active']])
      assert.equal((await call('GET', '/rate-settings/current')).body.rider_share_pct, 70)
      assert.equal((await lastAudit('rate_settings')).action, 'create_rate_setting')
    } finally {
      await pool.query('DELETE FROM rate_settings WHERE setting_id = $1', [res.body.rate.setting_id])
    }
  })
})

describe('a new rate only affects new orders', () => {
  test('new orders use the new extra-store fee; an old delivery keeps its old rider share', async () => {
    const { rows: t } = await pool.query(`SELECT to_char(now() - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI') AS since`)
    const res = await a('POST', '/rate-settings', { extra_store_fee: 15, rider_share_pct: 75, effective_from: t[0].since })
    try {
      assert.equal(res.status, 201)
      const log = await lastAudit('rate_settings')
      assert.deepEqual([log.old_value.rider_share_pct, log.new_value.rider_share_pct], [70, 75]) // old and new rate
      assert.equal((await call('GET', '/rate-settings/current')).body.rider_share_pct, 75)

      // A new 2-store order pays the new ₱15 extra-store fee
      const reg = await call('POST', '/auth/register', { full_name: 'Rate Tester', email: `rate${Date.now()}@test.ph`, contact_number: '09171239000', password: 'password123' })
      const address = await call('POST', '/addresses', { barangay_id: 1, street_address: 'Rizal St.' }, reg.body.token)
      const placed = await call('POST', '/orders', { address_id: address.body.address_id, lines: [{ item_id: 1, quantity: 1 }, { item_id: 13, quantity: 1 }] }, reg.body.token)
      const details = (await call('GET', `/orders/${placed.body.order.order_id}`, null, reg.body.token)).body
      assert.equal(details.stores[1].extra_store_fee, 15)
      assert.equal(details.payment.amount, 95 + 79 + 40 + 15)

      // Old order 1001 still has its ₱10 fee, and old delivery 1006 keeps its 70% rider share snapshot
      const reports = (await a('GET', '/reports')).body.orders
      assert.equal(reports.find((e) => e.order.order_id === 1001).stores[1].extra_store_fee, 10)
      assert.equal(reports.find((e) => e.order.order_id === 1006).earning.rider_share_pct, 70)
    } finally {
      await pool.query('DELETE FROM rate_settings WHERE setting_id = $1', [res.body.rate.setting_id])
    }
  })
})

describe('rider savings', () => {
  test('overview: ledger newest first with shift dates and who processed it', async () => {
    const { body } = await a('GET', '/savings')
    const marcelo = body.find((r) => r.user.user_id === 2)
    assert.equal(marcelo.user.password_hash, undefined)
    assert.equal(marcelo.profile.vehicle_type, 'Motorcycle')
    assert.ok(marcelo.lastShift)
    const opening = marcelo.entries.find((e) => e.note === 'Opening balance from old records')
    assert.equal(opening.processed_by_name, 'Jose Dela Cruz')
    const shiftDeposit = marcelo.entries.find((e) => e.applied_deduction_id)
    assert.equal(shiftDeposit.processed_by_name, 'Automatic')
    assert.match(shiftDeposit.shift_date, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('withdrawal: amount up to the balance, note required, audited', async () => {
    // Marcelo: ₱400 opening − ₱100 withdrawn + 3 shift deposits of ₱10 = ₱330
    assert.equal((await a('POST', '/savings/2/withdrawals', { amount: 0, note: 'x' })).body.error, 'invalid_amount')
    assert.equal((await a('POST', '/savings/2/withdrawals', { amount: 50, note: ' ' })).body.error, 'note_required')
    const tooMuch = await a('POST', '/savings/2/withdrawals', { amount: 330.01, note: 'Repair' })
    assert.equal(tooMuch.status, 409)
    assert.equal(tooMuch.body.error, 'not_enough')
    const ok = await a('POST', '/savings/2/withdrawals', { amount: 30, note: 'Motorcycle repair' })
    assert.equal(ok.status, 201)
    assert.equal(ok.body.entry.entry_type, 'withdrawal')
    assert.equal(ok.body.entry.processed_by, adminId)
    const log = await lastAudit('rider_savings_entries')
    assert.equal(log.action, 'savings_withdrawal')
    assert.deepEqual([log.old_value.balance, log.new_value.balance], [330, 300]) // balance before and after
    assert.equal((await a('POST', '/savings/2/withdrawals', { amount: 300.01, note: 'More' })).body.error, 'not_enough')
    assert.equal((await a('POST', '/savings/99999/withdrawals', { amount: 1, note: 'x' })).status, 404)
  })
})

describe('access', () => {
  test('the admin only (operators too are refused)', async () => {
    assert.equal((await call('GET', '/admin/settings')).status, 401)
    const asOperator = await a('GET', '/settings', null, operator)
    assert.equal(asOperator.status, 403)
    assert.equal(asOperator.body.error, 'wrong_role')
    assert.equal((await a('POST', '/savings/2/withdrawals', { amount: 1, note: 'x' }, operator)).status, 403)
  })
})
