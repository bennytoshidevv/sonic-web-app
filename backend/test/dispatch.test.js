// Operator orders + riders API tests (module 4). Needs a seeded database: npm run db:reset, then npm test.
// Orders are placed by a brand-new customer, so the demo orders stay as they are.
// Demo riders: 2 Marcelo (busy, open shift), 5 Pedro (suspended), 8 Carlo (available, open shift).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'

let customer // fresh customer token
let customerId
let addressId
let operator
let admin

setup(async () => {
  const reg = await call('POST', '/auth/register', {
    full_name: 'Dispatch Tester',
    email: `dispatch${Date.now()}@test.ph`,
    contact_number: '09171234002',
    password: 'password123',
  })
  customer = reg.body.token
  customerId = reg.body.user.user_id
  addressId = (await call('POST', '/addresses', { barangay_id: 3, street_address: 'Purok 1' }, customer)).body.address_id
  operator = await loginAs('operator@sonic.ph')
  admin = await loginAs('admin@sonic.ph')
})

async function newOrder(paymentMethod = 'cod') {
  const res = await call('POST', '/orders', { address_id: addressId, payment_method: paymentMethod, lines: [{ item_id: 9, quantity: 1 }] }, customer)
  return res.body.order
}
const advance = (id, t = operator) => call('POST', `/staff/orders/${id}/advance`, null, t)
const assign = (id, riderId) => call('POST', `/staff/orders/${id}/assign`, { rider_id: riderId }, operator)
const staffOrder = async (id) => (await call('GET', `/staff/orders/${id}`, null, operator)).body

async function notifications(userId, orderId) {
  const { rows } = await pool.query('SELECT type, message FROM notifications WHERE user_id = $1 AND order_id = $2 ORDER BY notification_id', [userId, orderId])
  return rows
}

describe('live orders and order details', () => {
  test('staff see every order, newest first, with customer, stores, history names and assignments', async () => {
    const order = await newOrder()
    const { status, body } = await call('GET', '/staff/orders', null, operator)
    assert.equal(status, 200)
    // newest first (demo orders dated "today" may be later than now, so check the order, not the position)
    const times = body.map((e) => new Date(e.order.placed_at).getTime())
    assert.deepEqual(times, [...times].sort((x, y) => y - x))
    const entry = body.find((e) => e.order.order_id === order.order_id)
    assert.deepEqual(entry.customer, {
      user_id: customerId, full_name: 'Dispatch Tester', email: entry.customer.email, contact_number: '09171234002', order_count: 1,
    })
    assert.equal(entry.stores[0].address, 'Maharlika Hwy., South Centro, Sipocot') // where the rider buys the food
    assert.equal(entry.history[0].changed_by_name, 'Dispatch Tester')
    assert.equal(entry.delivery, null)
    assert.deepEqual(entry.assignments, [])
    assert.equal(entry.currentAssignment, null)
    assert.ok(body.some((e) => e.order.order_id === 1001))
  })

  test('one order; missing order is 404', async () => {
    const order = await staffOrder(1001)
    assert.equal(order.currentAssignment.rider_name, 'Marcelo Reyes')
    assert.equal(order.delivery.delivery_status, 'on_the_way')
    assert.equal((await call('GET', '/staff/orders/99999', null, operator)).status, 404)
  })
})

describe('moving an order forward', () => {
  test('pending → confirmed → preparing → ready_for_pickup, then the rider takes over', async () => {
    const order = await newOrder()
    for (const next of ['confirmed', 'preparing', 'ready_for_pickup']) {
      const res = await advance(order.order_id)
      assert.equal(res.status, 200)
      assert.equal(res.body.order.order_status, next)
    }
    const stuck = await advance(order.order_id)
    assert.equal(stuck.status, 409)
    assert.equal(stuck.body.error, 'not_allowed')

    const details = await staffOrder(order.order_id)
    assert.deepEqual(details.history.map((h) => h.status), ['pending', 'confirmed', 'preparing', 'ready_for_pickup'])
    assert.ok(details.history.slice(1).every((h) => h.changed_by_name === 'Ana Villanueva'))
    const sent = await notifications(customerId, order.order_id)
    assert.equal(sent.length, 3)
    assert.match(sent[0].message, /The store confirmed your order\.$/)
  })

  test('the admin can do it too', async () => {
    const order = await newOrder()
    assert.equal((await advance(order.order_id, admin)).body.order.order_status, 'confirmed')
  })
})

describe('assigning riders', () => {
  test('only confirmed orders, only available riders on shift', async () => {
    const order = await newOrder()
    assert.equal((await assign(order.order_id, 8)).body.error, 'not_assignable') // still pending
    await advance(order.order_id)
    assert.equal((await assign(order.order_id, 5)).body.error, 'rider_unavailable') // suspended
    assert.equal((await assign(order.order_id, 2)).body.error, 'rider_unavailable') // busy
    assert.equal((await assign(order.order_id, 1)).body.error, 'rider_unavailable') // a customer, not a rider
    assert.equal((await assign(order.order_id, 99999)).status, 409)

    const ok = await assign(order.order_id, 8)
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.body, { ok: true })
    const details = await staffOrder(order.order_id)
    assert.equal(details.delivery.delivery_status, 'assigned')
    assert.equal(details.currentAssignment.rider_name, 'Carlo Santos')
    assert.equal(details.currentAssignment.response_status, 'pending')
    assert.equal((await notifications(8, order.order_id))[0].type, 'rider_assignment')
  })

  test('an active rider who is offline is refused (no shift, or on shift but set to offline)', async () => {
    const order = await newOrder()
    await advance(order.order_id)
    const email = `offline${Date.now()}@test.ph`
    const created = await call('POST', '/staff/users/riders', { full_name: 'Offline Rider', email, contact_number: '09181239876', password: 'temp12345', vehicle_type: 'Motorcycle' }, operator)
    const riderId = created.body.user.user_id

    // Active account, but no shift yet (offline)
    assert.equal((await assign(order.order_id, riderId)).body.error, 'rider_unavailable')

    // On shift, then switches to offline
    const rider = (await call('POST', '/auth/login', { email, password: 'temp12345' })).body.token
    await call('POST', '/rider/shift/start', null, rider)
    await call('PUT', '/rider/availability', { availability_status: 'offline' }, rider)
    const res = await assign(order.order_id, riderId)
    assert.equal(res.status, 409)
    assert.equal(res.body.error, 'rider_unavailable')
    assert.equal((await staffOrder(order.order_id)).currentAssignment, null) // nothing was assigned

    // Back to available: now it works
    await call('PUT', '/rider/availability', { availability_status: 'available' }, rider)
    assert.equal((await assign(order.order_id, riderId)).status, 200)
  })

  test('reassigning ends the old assignment', async () => {
    const order = await newOrder()
    await advance(order.order_id)
    await assign(order.order_id, 8)
    await assign(order.order_id, 8)
    const details = await staffOrder(order.order_id)
    assert.deepEqual(details.assignments.map((a) => a.end_reason), ['reassigned', null])
    assert.equal(details.currentAssignment.assignment_id, details.assignments[1].assignment_id)
  })
})

describe('rejecting', () => {
  test('needs a reason; ends the assignment and frees the rider', async () => {
    const order = await newOrder()
    await advance(order.order_id)
    await assign(order.order_id, 8)
    // Carlo accepts (module 5 will do this through the rider app)
    await pool.query(
      `UPDATE delivery_assignments SET response_status = 'accepted', responded_at = now()
        WHERE rider_id = 8 AND ended_at IS NULL AND delivery_id = (SELECT delivery_id FROM deliveries WHERE order_id = $1)`,
      [order.order_id],
    )
    await pool.query("UPDATE rider_profiles SET availability_status = 'busy' WHERE user_id = 8")

    const noReason = await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: '  ' }, operator)
    assert.equal(noReason.status, 400)
    assert.equal(noReason.body.error, 'reason_required')

    const res = await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: 'Store ran out of chicken' }, operator)
    assert.equal(res.status, 200)
    assert.equal(res.body.order.order_status, 'cancelled')
    assert.equal(res.body.order.cancellation_reason, 'Store ran out of chicken')

    const details = await staffOrder(order.order_id)
    assert.equal(details.delivery.delivery_status, 'cancelled')
    assert.equal(details.assignments[0].end_reason, 'cancelled')
    assert.equal(details.currentAssignment, null)
    assert.equal(details.history.at(-1).remarks, 'Store ran out of chicken')
    const { rows } = await pool.query('SELECT availability_status FROM rider_profiles WHERE user_id = 8')
    assert.equal(rows[0].availability_status, 'available')
    assert.ok((await notifications(customerId, order.order_id)).some((n) => /cancelled/.test(n.message)))
    assert.ok((await notifications(8, order.order_id)).some((n) => /cancelled by Sonic/.test(n.message)))
  })

  test('a paid online order gets a pending refund', async () => {
    const order = await newOrder('gcash')
    await pool.query("UPDATE payments SET payment_status = 'paid', paid_at = now() WHERE order_id = $1", [order.order_id])
    await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: 'Store closed early' }, operator)
    const { rows } = await pool.query(
      'SELECT r.refund_status, r.reason FROM refunds r JOIN payments p USING (payment_id) WHERE p.order_id = $1',
      [order.order_id],
    )
    assert.deepEqual(rows, [{ refund_status: 'pending', reason: 'Order rejected: Store closed early' }])
  })

  test('not after pickup', async () => {
    assert.equal((await call('POST', '/staff/orders/1001/reject', { reason: 'x' }, operator)).body.error, 'not_allowed')
    assert.equal((await call('POST', '/staff/orders/1002/reject', { reason: 'x' }, operator)).status, 409)
  })
})

describe('online orders must be paid before they are confirmed', () => {
  test('unpaid: refused and unchanged; paid: confirmed', async () => {
    for (const method of ['gcash', 'maya', 'qr_ph', 'card']) {
      const order = await newOrder(method)
      const refused = await advance(order.order_id)
      assert.equal(refused.status, 409)
      assert.equal(refused.body.error, 'payment_required')
      assert.equal((await staffOrder(order.order_id)).order.order_status, 'pending')
      assert.equal((await advance(order.order_id, admin)).status, 409) // the admin too

      await pool.query("UPDATE payments SET payment_status = 'paid', paid_at = now() WHERE order_id = $1", [order.order_id])
      assert.equal((await advance(order.order_id)).body.order.order_status, 'confirmed')
      await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: 'Test order' }, operator)
    }
  })

  test('an unpaid online order can still be rejected, without a refund', async () => {
    const order = await newOrder('gcash')
    assert.equal((await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: 'Never paid' }, operator)).status, 200)
    const { rows } = await pool.query('SELECT 1 FROM refunds r JOIN payments p USING (payment_id) WHERE p.order_id = $1', [order.order_id])
    assert.equal(rows.length, 0)
  })
})

describe('riders overview', () => {
  test('shift, jobs, petty cash and reviews per rider (no password hash)', async () => {
    const { status, body } = await call('GET', '/staff/riders', null, operator)
    assert.equal(status, 200)
    const marcelo = body.find((r) => r.user.user_id === 2)
    assert.equal(marcelo.user.password_hash, undefined)
    assert.equal(marcelo.profile.plate_number, 'ABC 1234')
    assert.equal(marcelo.openShift.status, 'open')
    assert.ok(marcelo.jobs.some((j) => j.order_id === 1001 && j.response_status === 'accepted'))
    assert.ok(marcelo.jobs.some((j) => j.order_id === 1009 && j.response_status === 'pending'))
    assert.deepEqual(marcelo.reviews.map((r) => r.order_id), [1005])

    const carlo = body.find((r) => r.user.user_id === 8)
    assert.equal(carlo.deliveriesThisShift, 0)
    assert.deepEqual(carlo.pettyCash.map((t) => [t.txn_type, t.amount]), [['cash_issued', 500]])

    const pedro = body.find((r) => r.user.user_id === 5)
    assert.equal(pedro.openShift, null)
    assert.deepEqual(pedro.jobs, [])
  })
})

describe('access', () => {
  test('operators and the admin only', async () => {
    assert.equal((await call('GET', '/staff/orders')).status, 401)
    const asCustomer = await call('GET', '/staff/orders', null, customer)
    assert.equal(asCustomer.status, 403)
    assert.equal(asCustomer.body.error, 'wrong_role')
    assert.equal((await call('GET', '/staff/riders', null, await loginAs('rider@sonic.ph'))).status, 403)
    assert.equal((await call('GET', '/staff/riders', null, admin)).status, 200)
  })
})
