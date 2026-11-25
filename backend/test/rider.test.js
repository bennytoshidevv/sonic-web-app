// Rider API tests (module 5). Needs a seeded database: npm run db:reset, then npm test.
// One brand-new rider does a whole shift: start → accept → pick up → store purchase → deliver → end.
// The tests in this file run in order and build on each other.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'
import { deliveryGross, gasAllowanceFor, orderExtraStoreFees } from '../src/utils/calc.js'

let rider // token of the new rider
let riderId
let customer
let customerId
let operator
let orderId // the order this rider delivers
let assignmentId

setup(async () => {
  const stamp = Date.now()
  const email = `rider${stamp}@test.ph`
  await call('POST', '/auth/apply', {
    role: 'rider', full_name: 'Test Rider', email, contact_number: '09181234003', password: 'password123',
    vehicle_type: 'Motorcycle', plate_number: 'TST 123',
  })
  // Approving applications is module 6; here the account is switched on directly.
  const { rows } = await pool.query("UPDATE users SET account_status = 'active' WHERE email = $1 RETURNING user_id", [email])
  riderId = rows[0].user_id
  rider = (await call('POST', '/auth/login', { email, password: 'password123' })).body.token

  const reg = await call('POST', '/auth/register', {
    full_name: 'Rider Test Customer', email: `ridercust${stamp}@test.ph`, contact_number: '09171234004', password: 'password123',
  })
  customer = reg.body.token
  customerId = reg.body.user.user_id
  operator = await loginAs('operator@sonic.ph')
})

const r = (method, path, body) => call(method, `/rider${path}`, body, rider)
const staff = (path, body) => call('POST', `/staff/orders/${orderId}${path}`, body, operator)

async function placeAndConfirm(token = customer) {
  const address = await call('POST', '/addresses', { barangay_id: 5, street_address: 'Zone 3' }, token) // ₱250 fee
  const placed = await call('POST', '/orders', {
    address_id: address.body.address_id, payment_method: 'cod', lines: [{ item_id: 1, quantity: 1 }, { item_id: 13, quantity: 1 }],
  }, token)
  const id = placed.body.order.order_id
  await call('POST', `/staff/orders/${id}/advance`, null, operator) // confirmed
  return id
}

describe('a full shift', () => {
  test('before the shift: empty dashboard, availability needs a shift', async () => {
    const { status, body } = await r('GET', '/dashboard')
    assert.equal(status, 200)
    assert.equal(body.profile.availability_status, 'offline')
    assert.equal(body.shift, null)
    assert.equal(body.hasShiftToday, false)
    assert.deepEqual(body.deliveries, [])
    assert.equal(body.activeDelivery, null)
    assert.equal((await r('PUT', '/availability', { availability_status: 'available' })).body.error, 'no_open_shift')
    assert.equal((await r('PUT', '/availability', { availability_status: 'sleeping' })).body.error, 'invalid_status')
  })

  test('start shift: per-shift deductions are charged and savings deposited', async () => {
    const res = await r('POST', '/shift/start')
    assert.equal(res.status, 201)
    assert.equal(res.body.shift.status, 'open')
    assert.equal((await r('POST', '/shift/start')).body.error, 'already_open')

    const dash = (await r('GET', '/dashboard')).body
    assert.equal(dash.profile.availability_status, 'available')
    assert.equal(dash.hasShiftToday, true)
    assert.deepEqual(dash.deductions.map((d) => [d.name, d.amount]), [['Box rent', 10], ['Rider savings', 10]])
    const wallet = (await r('GET', '/wallet')).body
    assert.deepEqual(wallet.savings.map((e) => [e.entry_type, e.amount, e.shift_date]), [['deposit', 10, dash.shift.shift_date]])
    assert.equal(wallet.savingsPerShift, 10)
  })

  test('a new dispatch shows with the customer, store addresses and pay preview data', async () => {
    orderId = await placeAndConfirm()
    assert.deepEqual((await staff('/assign', { rider_id: riderId })).body, { ok: true })

    const { body } = await r('GET', '/deliveries')
    assert.equal(body.pending.length, 1)
    assert.deepEqual(body.active, [])
    const entry = body.pending[0]
    assignmentId = entry.assignment.assignment_id
    assert.equal(entry.order.order_id, orderId)
    assert.deepEqual(entry.customer, { full_name: 'Rider Test Customer', contact_number: '09171234004' })
    assert.equal(entry.stores[0].address, 'Rizal St., North Centro, Sipocot')
    assert.equal(body.shiftIsOpen, true)
    assert.equal(body.rate.rider_share_pct, 70)
    assert.equal(body.tiers.length, 5)
  })

  test('accept: the rider becomes busy; the dispatch can no longer be rejected', async () => {
    assert.equal((await r('POST', `/deliveries/${orderId}/advance`)).body.error, 'not_assigned') // not accepted yet
    assert.deepEqual((await r('POST', `/assignments/${assignmentId}/accept`)).body, { ok: true })
    assert.equal((await r('POST', `/assignments/${assignmentId}/reject`)).status, 404)
    const { body } = await r('GET', '/deliveries')
    assert.equal(body.active.length, 1)
    assert.equal(body.availability, 'busy')
    assert.equal((await r('POST', '/shift/end')).body.error, 'delivery_in_progress')
  })

  test('pick up only once the store marked it ready', async () => {
    const early = await r('POST', `/deliveries/${orderId}/advance`)
    assert.equal(early.status, 409)
    assert.equal(early.body.error, 'not_ready')
    await staff('/advance') // preparing
    await staff('/advance') // ready_for_pickup
    assert.equal((await r('POST', `/deliveries/${orderId}/advance`)).body.order.order_status, 'picked_up')
  })

  test('store purchase with petty cash, up to what is on hand', async () => {
    assert.equal((await r('POST', `/deliveries/${orderId}/purchases`, { amount: 50 })).body.error, 'not_enough') // nothing issued yet
    const { rows } = await pool.query("SELECT shift_id FROM rider_shifts WHERE rider_id = $1 AND status = 'open'", [riderId])
    await pool.query(
      "INSERT INTO petty_cash_transactions (shift_id, txn_type, amount, processed_by) VALUES ($1, 'cash_issued', 500, 3)",
      [rows[0].shift_id],
    )
    assert.equal((await r('POST', `/deliveries/${orderId}/purchases`, { amount: -5 })).body.error, 'invalid_amount')
    assert.equal((await r('POST', `/deliveries/${orderId}/purchases`, { amount: 600 })).body.error, 'not_enough')
    assert.equal((await r('POST', `/deliveries/${orderId}/purchases`, { amount: 174 })).status, 201)

    const details = (await r('GET', `/deliveries/${orderId}`)).body
    assert.deepEqual(details.orderPurchases.map((t) => t.amount), [174])
    assert.deepEqual(details.shiftPettyCash.map((t) => t.txn_type), ['cash_issued', 'purchase'])
    assert.equal(details.shiftIsOpen, true)
    assert.equal(details.earning, null)
  })

  test('delivered: COD paid, pay snapshot, per-delivery deduction, rider free again', async () => {
    assert.equal((await r('POST', `/deliveries/${orderId}/advance`)).body.order.order_status, 'on_the_way')
    const done = await r('POST', `/deliveries/${orderId}/advance`)
    assert.equal(done.body.order.order_status, 'delivered')
    assert.equal((await r('POST', `/deliveries/${orderId}/advance`)).status, 404) // assignment completed

    const order = (await call('GET', `/orders/${orderId}`, null, customer)).body
    assert.equal(order.payment.payment_status, 'paid')
    assert.deepEqual(order.history.slice(-3).map((h) => h.status), ['picked_up', 'on_the_way', 'delivered'])
    assert.equal(order.rider.user_id, riderId)

    const details = (await r('GET', `/deliveries/${orderId}`)).body
    assert.equal(details.assignment.end_reason, 'completed')
    assert.equal(details.earning.gas_allowance_amount, 50) // ₱250 fee → ₱50 tier
    assert.equal(details.earning.rider_share_pct, 70)

    const dash = (await r('GET', '/dashboard')).body
    assert.equal(dash.profile.availability_status, 'available')
    assert.equal(dash.activeDelivery, null)
    assert.equal(dash.deliveries.length, 1)
    const run = dash.deliveries[0]
    // ₱50 allowance + ₱140 share + ₱10 extra store = ₱200
    assert.equal(deliveryGross(run.order.base_delivery_fee, run.earning.gas_allowance_amount, run.earning.rider_share_pct, orderExtraStoreFees(run.stores)), 200)
    assert.deepEqual(dash.deductions.map((d) => d.name), ['Box rent', 'Rider savings', 'Operator fee'])

    const { rows } = await pool.query("SELECT message FROM notifications WHERE user_id = $1 AND order_id = $2 ORDER BY notification_id", [customerId, orderId])
    assert.match(rows.at(-1).message, /delivered/)
  })

  test('history and wallet', async () => {
    const history = (await r('GET', '/history')).body
    assert.equal(history.length, 1)
    assert.equal(history[0].runs[0].customer_name, 'Rider Test Customer')
    assert.equal(history[0].settlement, null)
    assert.equal(history[0].deductions.length, 3)
    const wallet = (await r('GET', '/wallet')).body
    assert.equal(wallet.shift.status, 'open')
    assert.equal(wallet.pettyCash.find((t) => t.txn_type === 'purchase').order_number, order_number_of(history))
  })

  test('end the shift; no second shift on the same day', async () => {
    const res = await r('POST', '/shift/end')
    assert.equal(res.body.shift.status, 'closed')
    assert.equal((await r('GET', '/dashboard')).body.profile.availability_status, 'offline')
    assert.equal((await r('POST', '/shift/end')).body.error, 'no_open_shift')
    assert.equal((await r('POST', '/shift/start')).body.error, 'already_today')
  })
})

function order_number_of(history) {
  return history[0].runs[0].order.order_number
}

describe('pay rule and the open-shift rule', () => {
  test('pay examples with the tiers and rate the API uses: ₱250 → ₱190, +₱10 per extra store', async () => {
    const marcelo = await loginAs('rider@sonic.ph')
    const { tiers, rate } = (await call('GET', '/rider/deliveries', null, marcelo)).body
    const allowance = gasAllowanceFor(250, tiers) // from the BARANGAY fee only
    assert.equal(allowance, 50)
    assert.equal(deliveryGross(250, allowance, rate.rider_share_pct, 0), 190) // ₱50 + ₱140
    assert.equal(deliveryGross(250, allowance, rate.rider_share_pct, 10), 200) // 1 extra store
    assert.equal(deliveryGross(250, allowance, rate.rider_share_pct, 20), 210) // 2 extra stores
  })

  test('a delivery cannot be moved without an open shift', async () => {
    // Carlo (8) has an open shift today. He accepts a delivery, then his shift is closed behind his back
    // (the rider app itself blocks "end shift" during a delivery, so this can only happen in the database).
    orderId = await placeAndConfirm()
    await staff('/assign', { rider_id: 8 })
    const carlo = await loginAs('carlo@sonic.ph')
    const pending = (await call('GET', '/rider/deliveries', null, carlo)).body.pending.find((e) => e.order.order_id === orderId)
    await call('POST', `/rider/assignments/${pending.assignment.assignment_id}/accept`, null, carlo)
    await staff('/advance') // preparing
    await staff('/advance') // ready_for_pickup

    const { rows } = await pool.query("UPDATE rider_shifts SET status = 'closed', ended_at = now() WHERE rider_id = 8 AND status = 'open' RETURNING shift_id", [])
    try {
      const res = await call('POST', `/rider/deliveries/${orderId}/advance`, null, carlo)
      assert.equal(res.status, 409)
      assert.equal(res.body.error, 'no_open_shift')
      assert.equal((await call('GET', `/orders/${orderId}`, null, customer)).body.order.order_status, 'ready_for_pickup') // unchanged
    } finally {
      await pool.query("UPDATE rider_shifts SET status = 'open', ended_at = NULL WHERE shift_id = $1", [rows[0].shift_id])
    }
    // With the shift open again, Carlo finishes the delivery (so the demo state stays clean)
    for (let i = 0; i < 3; i++) await call('POST', `/rider/deliveries/${orderId}/advance`, null, carlo)
    assert.equal((await call('GET', `/orders/${orderId}`, null, customer)).body.order.order_status, 'delivered')
  })
})

describe('rejecting a dispatch and privacy', () => {
  test('Carlo rejects a dispatch: it ends and the operator can reassign', async () => {
    orderId = await placeAndConfirm()
    await staff('/assign', { rider_id: 8 })
    const carlo = await loginAs('carlo@sonic.ph')
    const pending = (await call('GET', '/rider/deliveries', null, carlo)).body.pending.find((e) => e.order.order_id === orderId)
    assert.deepEqual((await call('POST', `/rider/assignments/${pending.assignment.assignment_id}/reject`, null, carlo)).body, { ok: true })
    const order = (await call('GET', `/staff/orders/${orderId}`, null, operator)).body
    assert.equal(order.assignments[0].end_reason, 'rejected')
    assert.equal(order.currentAssignment, null)
  })

  test("another rider's delivery answers 404", async () => {
    const marcelo = await loginAs('rider@sonic.ph')
    assert.equal((await call('GET', `/rider/deliveries/${orderId}`, null, marcelo)).status, 404)
    assert.equal((await call('POST', '/rider/deliveries/1001/advance', null, rider)).body.error, 'not_assigned')
    assert.equal((await call('GET', '/rider/deliveries/1001', null, marcelo)).body.order.order_id, 1001)
  })

  test('riders only', async () => {
    assert.equal((await call('GET', '/rider/dashboard')).status, 401)
    assert.equal((await call('GET', '/rider/dashboard', null, customer)).status, 403)
    assert.equal((await call('GET', '/rider/dashboard', null, operator)).status, 403)
  })
})
