// Settlements API tests (module 7). Needs a seeded database: npm run db:reset, then npm test.
// Carlo's shift of yesterday (seeded: closed, 2 COD deliveries, ₱500 petty cash, not settled) is settled here:
//   COD ₱575.00 − net pay ₱188.00 → the rider hands over ₱387.00.
// A new rider then delivers a GCash order, so Sonic owes the rider (payout).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'

let operator
let carloYesterday // { shift_id, shift_date }
let carloToday

setup(async () => {
  operator = await loginAs('operator@sonic.ph')
  const { rows } = await pool.query("SELECT shift_id, shift_date, status FROM rider_shifts WHERE rider_id = 8 ORDER BY started_at")
  carloYesterday = rows.find((s) => s.status === 'closed')
  carloToday = rows.find((s) => s.status === 'open')
})

const staff = (method, path, body) => call(method, `/staff/shifts${path}`, body, operator)

describe('shifts on a date', () => {
  test("yesterday: Carlo's closed shift with rider, runs, deductions and petty cash", async () => {
    const { status, body } = await staff('GET', `?date=${carloYesterday.shift_date}`)
    assert.equal(status, 200)
    const view = body.find((v) => v.shift.shift_id === carloYesterday.shift_id)
    assert.equal(view.rider.full_name, 'Carlo Santos')
    assert.equal(view.rider.password_hash, undefined)
    assert.equal(view.profile.plate_number, 'NQ 8921')
    assert.equal(view.runs.length, 2)
    assert.equal(view.settlement, null)
    assert.deepEqual(view.pettyCash.map((t) => [t.txn_type, t.amount]), [['cash_issued', 500]])
    // calculated by the API with calc.js (not stored): ₱575 COD, ₱188 net pay → the rider remits ₱387
    // gross ₱228 = ₱28 (North Centro ₱40 fee: no allowance, 70% share) + ₱200 (Mangga ₱250 + 1 extra store)
    // deductions ₱40 = box rent + savings + 2 operator fees
    assert.deepEqual(view.money, { gross: 228, deductions: 40, net: 188, cod: 575, toRemit: 387, toPayRider: 0, pettyOnHand: 500 })
  })

  test('bad date', async () => {
    assert.equal((await staff('GET', '?date=yesterday')).body.error, 'invalid_date')
    assert.equal((await staff('GET', '')).status, 400)
  })
})

describe('petty cash entries', () => {
  test('rules: type, amount, GCash reference, not more than on hand', async () => {
    const id = carloYesterday.shift_id
    assert.equal((await staff('POST', `/${id}/petty-cash`, { txn_type: 'purchase', amount: 10 })).body.error, 'invalid_type')
    assert.equal((await staff('POST', `/${id}/petty-cash`, { txn_type: 'cash_issued', amount: 0 })).body.error, 'invalid_amount')
    assert.equal((await staff('POST', `/${id}/petty-cash`, { txn_type: 'gcash_topup', amount: 100 })).body.error, 'reference_required')
    assert.equal((await staff('POST', `/${id}/petty-cash`, { txn_type: 'cash_returned', amount: 600 })).body.error, 'not_enough')
    assert.equal((await staff('POST', '/99999/petty-cash', { txn_type: 'cash_issued', amount: 10 })).status, 404)

    const ok = await staff('POST', `/${id}/petty-cash`, { txn_type: 'gcash_topup', amount: 100, gcash_reference_id: ' 1234567890 ', note: 'Top-up' })
    assert.equal(ok.status, 201)
    const { rows } = await pool.query("SELECT gcash_reference_id, processed_by FROM petty_cash_transactions WHERE shift_id = $1 AND txn_type = 'gcash_topup'", [id])
    assert.deepEqual(rows, [{ gcash_reference_id: '1234567890', processed_by: 3 }])
  })
})

describe('settling', () => {
  test('an open shift cannot be settled', async () => {
    const res = await staff('POST', `/${carloToday.shift_id}/settlement`, { cash_received: 0 })
    assert.equal(res.status, 409)
    assert.equal(res.body.error, 'shift_not_closed')
  })

  test('the rider hands over COD minus net pay; unused petty cash returned; only once', async () => {
    const id = carloYesterday.shift_id
    assert.equal((await staff('POST', `/${id}/settlement`, {})).body.error, 'invalid') // cash count missing

    const res = await staff('POST', `/${id}/settlement`, { cash_received: 380, payout_amount: 9999, notes: 'Short ₱7', return_petty_cash: true })
    assert.equal(res.status, 201)
    assert.deepEqual(res.body, { ok: true })

    const view = (await staff('GET', `?date=${carloYesterday.shift_date}`)).body.find((v) => v.shift.shift_id === id)
    assert.equal(view.settlement.cash_received, 380) // what was counted (₱7 short of ₱387)
    assert.equal(view.settlement.payout_amount, 0) // computed by the API, not the ₱9,999 sent
    assert.equal(view.settlement.payout_method, null)
    assert.equal(view.settlement.settled_by, 3)
    assert.equal(view.settlement.notes, 'Short ₱7')
    const returned = view.pettyCash.find((t) => t.txn_type === 'cash_returned')
    assert.equal(returned.amount, 600) // ₱500 issued + ₱100 top-up

    assert.equal((await staff('POST', `/${id}/settlement`, { cash_received: 387 })).body.error, 'already_settled')
    assert.equal((await staff('POST', `/${id}/petty-cash`, { txn_type: 'adjustment', amount: 5 })).body.error, 'already_settled')

    const history = (await call('GET', '/rider/history', null, await loginAs('carlo@sonic.ph'))).body
    assert.equal(history.find((h) => h.shift.shift_id === id).settlement.cash_received, 380)
  })

  test('Sonic pays the rider when net pay is more than the cash collected (GCash needs a reference)', async () => {
    const stamp = Date.now()
    const email = `payrider${stamp}@test.ph`
    const created = await call('POST', '/staff/users/riders', { full_name: 'Payout Rider', email, contact_number: '09181230000', password: 'temp12345', vehicle_type: 'Motorcycle' }, operator)
    const riderId = created.body.user.user_id
    const rider = (await call('POST', '/auth/login', { email, password: 'temp12345' })).body.token
    await call('POST', '/rider/shift/start', null, rider)

    const reg = await call('POST', '/auth/register', { full_name: 'GCash Customer', email: `gc${stamp}@test.ph`, contact_number: '09171230000', password: 'password123' })
    const address = await call('POST', '/addresses', { barangay_id: 5, street_address: 'Zone 4' }, reg.body.token)
    const placed = await call('POST', '/orders', { address_id: address.body.address_id, payment_method: 'gcash', lines: [{ item_id: 9, quantity: 1 }] }, reg.body.token)
    const orderId = placed.body.order.order_id
    // Online orders must be paid before the operator can confirm them.
    await pool.query("UPDATE payments SET payment_status = 'paid', paid_at = now() WHERE order_id = $1", [orderId])
    await call('POST', `/staff/orders/${orderId}/advance`, null, operator)
    await call('POST', `/staff/orders/${orderId}/assign`, { rider_id: riderId }, operator)
    const pending = (await call('GET', '/rider/deliveries', null, rider)).body.pending[0]
    await call('POST', `/rider/assignments/${pending.assignment.assignment_id}/accept`, null, rider)

    // Petty cash: issue ₱500 + GCash top-up ₱100, the rider buys the order's food (₱320) → ₱280 on hand
    const today = (await pool.query("SELECT shift_id, shift_date FROM rider_shifts WHERE rider_id = $1 AND status = 'open'", [riderId])).rows[0]
    await staff('POST', `/${today.shift_id}/petty-cash`, { txn_type: 'cash_issued', amount: 500 })
    await staff('POST', `/${today.shift_id}/petty-cash`, { txn_type: 'gcash_topup', amount: 100, gcash_reference_id: 'GC-111' })
    assert.equal((await call('POST', `/rider/deliveries/${orderId}/purchases`, { amount: 320 }, rider)).status, 201)
    const onHand = async () => (await staff('GET', `?date=${today.shift_date}`)).body.find((v) => v.shift.shift_id === today.shift_id).money.pettyOnHand
    assert.equal(await onHand(), 280)
    await call('POST', `/staff/orders/${orderId}/advance`, null, operator)
    await call('POST', `/staff/orders/${orderId}/advance`, null, operator)
    for (let i = 0; i < 3; i++) await call('POST', `/rider/deliveries/${orderId}/advance`, null, rider)
    const ended = await call('POST', '/rider/shift/end', null, rider)
    const shiftId = ended.body.shift.shift_id

    // The rider gives back ₱80 → ₱200 still on hand (500 + 100 − 320 − 80)
    await staff('POST', `/${shiftId}/petty-cash`, { txn_type: 'cash_returned', amount: 80 })
    assert.equal(await onHand(), 200)
    const money = (await staff('GET', `?date=${today.shift_date}`)).body.find((v) => v.shift.shift_id === shiftId).money
    assert.deepEqual([money.net, money.cod, money.toRemit, money.toPayRider], [160, 0, 0, 160])

    // Net pay = ₱50 allowance + ₱140 share − ₱30 deductions = ₱160; no cash collected (GCash order)
    assert.equal((await staff('POST', `/${shiftId}/settlement`, { payout_method: 'gcash' })).body.error, 'reference_required')
    assert.equal((await staff('POST', `/${shiftId}/settlement`, { payout_method: 'bank' })).body.error, 'invalid')
    assert.equal((await staff('POST', `/${shiftId}/settlement`, { payout_method: 'gcash', payout_reference: 'GC-998877' })).status, 201)
    const { rows } = await pool.query('SELECT cash_received, payout_amount, payout_method, payout_reference FROM shift_settlements WHERE shift_id = $1', [shiftId])
    assert.deepEqual(rows[0], { cash_received: 0, payout_amount: 160, payout_method: 'gcash', payout_reference: 'GC-998877' })
  })
})

describe('access', () => {
  test('operators and the admin only', async () => {
    assert.equal((await call('GET', '/staff/shifts?date=2026-11-20')).status, 401)
    assert.equal((await call('GET', '/staff/shifts?date=2026-11-20', null, await loginAs('rider@sonic.ph'))).status, 403)
    assert.equal((await call('GET', '/staff/shifts?date=2026-11-20', null, await loginAs('admin@sonic.ph'))).status, 200)
  })
})
