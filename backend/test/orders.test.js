// Customer orders + reviews API tests (module 3). Needs a seeded database: npm run db:reset, then npm test.
// New orders are placed by a brand-new customer, so the demo orders stay as they are.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'

let token // a fresh customer
let addressId // their address in Mangga (₱250 delivery fee)
let maria // demo customer (owns orders 1001–1005)

setup(async () => {
  const reg = await call('POST', '/auth/register', {
    full_name: 'Order Tester',
    email: `orders${Date.now()}@test.ph`,
    contact_number: '09171234001',
    password: 'password123',
  })
  token = reg.body.token
  const address = await call('POST', '/addresses', { label: 'Home', barangay_id: 5, street_address: '1 Purok 2', landmark: 'Chapel' }, token)
  addressId = address.body.address_id
  maria = await loginAs('customer@sonic.ph')
})

const place = (body, t = token) =>
  call('POST', '/orders', { address_id: addressId, payment_method: 'cod', lines: [{ item_id: 1, quantity: 2 }], ...body }, t)

async function orderCount() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM customer_orders')
  return rows[0].n
}

describe('order details (demo data)', () => {
  test('a 2-store order: primary store first, items per store, history, payment, rider', async () => {
    const { status, body } = await call('GET', '/orders/1001', null, maria)
    assert.equal(status, 200)
    assert.deepEqual(Object.keys(body).sort(), ['history', 'order', 'payment', 'rider', 'stores'])
    assert.equal(body.order.order_status, 'on_the_way')
    assert.deepEqual(body.stores.map((s) => [s.name, s.is_primary, s.extra_store_fee]), [
      ['Kusina ni Aling Rosa', true, 0],
      ['Sipocot Pearl Milk Tea & Snacks', false, 10],
    ])
    assert.deepEqual(body.stores[0].items.map((i) => i.item_name), ['Tapsilog', 'House Blend Iced Tea'])
    assert.deepEqual(body.stores[1].items.map((i) => i.item_name), ['Brown Sugar Milk Tea'])
    assert.equal(body.stores[0].items[0].unit_price, 95)
    assert.deepEqual(body.history.map((h) => h.status), ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'])
    assert.equal(body.payment.amount, 344)
    assert.deepEqual(body.rider, { user_id: 2, full_name: body.rider.full_name, contact_number: body.rider.contact_number, vehicle_type: 'Motorcycle', plate_number: 'ABC 1234' })
  })

  test('my orders: newest first, each with its reviews', async () => {
    const { body } = await call('GET', '/orders', null, maria)
    const ids = body.map((e) => e.order.order_id)
    assert.ok(ids.includes(1001) && ids.includes(1005))
    const times = body.map((e) => new Date(e.order.placed_at).getTime())
    assert.deepEqual(times, [...times].sort((a, b) => b - a))
    assert.equal(body.find((e) => e.order.order_id === 1005).reviews.length, 1)
    assert.deepEqual(body.find((e) => e.order.order_id === 1004).reviews, [])
  })

  test("someone else's order answers 404", async () => {
    const res = await call('GET', '/orders/1001', null, token)
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'not_found')
    assert.equal((await call('GET', '/orders/1005/reviews', null, token)).status, 404)
    assert.deepEqual((await call('GET', '/orders', null, token)).body, [])
  })
})

describe('placing an order', () => {
  test('2 stores: prices and fees come from the database', async () => {
    const res = await place({
      payment_method: 'cod',
      order_notes: '  Please call  ',
      // the price sent here is ignored on purpose
      lines: [{ item_id: 1, quantity: 2, price: 1 }, { item_id: 13, quantity: 1 }],
    })
    assert.equal(res.status, 201)
    const order = res.body.order
    assert.match(order.order_number, new RegExp(`^SSD-\\d{8}-${order.order_id}$`))
    assert.equal(order.order_status, 'pending')
    assert.equal(order.base_delivery_fee, 250)
    assert.equal(order.dropoff_barangay, 'Mangga')
    assert.equal(order.dropoff_city, 'Sipocot')
    assert.equal(order.order_notes, 'Please call')

    const details = (await call('GET', `/orders/${order.order_id}`, null, token)).body
    assert.deepEqual(details.stores.map((s) => [s.restaurant_id, s.is_primary, s.extra_store_fee]), [[1, true, 0], [3, false, 10]])
    assert.equal(details.stores[0].items[0].unit_price, 95)
    // 2 × 95 + 79 + 250 barangay fee + 10 extra store = 529
    assert.equal(details.payment.amount, 529)
    assert.equal(details.payment.payment_status, 'pending')
    assert.deepEqual(details.history.map((h) => h.status), ['pending'])
    assert.equal(details.rider, null)
  })

  test('sold-out items and closed restaurants are refused, and nothing is saved', async () => {
    const before = await orderCount()
    const soldOut = await place({ lines: [{ item_id: 1, quantity: 1 }, { item_id: 3, quantity: 1 }] })
    assert.equal(soldOut.status, 409)
    assert.equal(soldOut.body.error, 'unavailable')
    assert.equal((await place({ lines: [{ item_id: 22, quantity: 1 }] })).body.error, 'unavailable') // pizzeria is closed
    assert.equal((await place({ lines: [{ item_id: 999, quantity: 1 }] })).body.error, 'unavailable')
    assert.equal(await orderCount(), before)
  })

  test('bad input', async () => {
    assert.equal((await place({ lines: [] })).body.error, 'empty_cart')
    assert.equal((await place({ lines: [{ item_id: 1, quantity: 0 }] })).body.error, 'invalid_quantity')
    assert.equal((await place({ lines: [{ item_id: 1, quantity: 1 }, { item_id: 1, quantity: 2 }] })).body.error, 'duplicate_item')
    assert.equal((await place({ payment_method: 'cash' })).body.error, 'invalid_payment_method')
    assert.equal((await place({ address_id: 1 })).body.error, 'invalid_address') // Maria's address
  })

  test('customers only', async () => {
    assert.equal((await place({}, null)).status, 401) // no login
    assert.equal((await place({}, await loginAs('rider@sonic.ph'))).status, 403)
  })
})

describe('cancelling', () => {
  test('a pending order can be cancelled once, with the reason in the history', async () => {
    const { order } = (await place({})).body
    const res = await call('POST', `/orders/${order.order_id}/cancel`, { reason: 'Changed my mind' }, token)
    assert.equal(res.status, 200)
    assert.equal(res.body.order.order_status, 'cancelled')
    assert.equal(res.body.order.cancellation_reason, 'Changed my mind')
    const details = (await call('GET', `/orders/${order.order_id}`, null, token)).body
    assert.deepEqual(details.history.at(-1).remarks, 'Changed my mind')

    const again = await call('POST', `/orders/${order.order_id}/cancel`, {}, token)
    assert.equal(again.status, 409)
    assert.equal(again.body.error, 'not_cancellable')
  })

  test("not after it was confirmed, and not someone else's order", async () => {
    assert.equal((await call('POST', '/orders/1001/cancel', {}, maria)).body.error, 'not_cancellable')
    assert.equal((await call('POST', '/orders/1004/cancel', {}, token)).status, 404)
    assert.equal((await call('GET', '/orders/1004', null, maria)).body.order.order_status, 'pending')
  })

  test('cancelling a paid online order records a pending refund', async () => {
    const { order } = (await place({ payment_method: 'gcash' })).body
    await pool.query("UPDATE payments SET payment_status = 'paid', paid_at = now() WHERE order_id = $1", [order.order_id])
    await call('POST', `/orders/${order.order_id}/cancel`, { reason: 'Too late' }, token)
    const { rows } = await pool.query(
      'SELECT r.refund_status, r.amount FROM refunds r JOIN payments p USING (payment_id) WHERE p.order_id = $1',
      [order.order_id],
    )
    assert.deepEqual(rows, [{ refund_status: 'pending', amount: 440 }]) // 2 × 95 + 250
  })
})

describe('reviews', () => {
  test('demo reviews of order 1005 and the rider', async () => {
    const { body } = await call('GET', '/orders/1005/reviews', null, maria)
    assert.equal(body.restaurantReviews.length, 1)
    assert.equal(body.riderReview.rating, 5)
    const rider = await call('GET', '/riders/2/reviews', null, maria)
    assert.deepEqual(rider.body.map((r) => r.order_id), [1005])
    assert.equal((await call('GET', '/riders/2/reviews')).status, 401)
  })

  test('rate a delivered order once', async () => {
    const { order } = (await place({ lines: [{ item_id: 1, quantity: 1 }, { item_id: 13, quantity: 1 }] })).body
    const ratings = { restaurantRatings: [{ restaurant_id: 1, rating: 5, comment: 'Sarap!' }, { restaurant_id: 3, rating: 4 }], riderRating: null }

    const early = await call('POST', `/orders/${order.order_id}/reviews`, ratings, token)
    assert.equal(early.status, 409)
    assert.equal(early.body.error, 'not_delivered')

    await pool.query("UPDATE customer_orders SET order_status = 'delivered' WHERE order_id = $1", [order.order_id])
    assert.equal((await call('POST', `/orders/${order.order_id}/reviews`, { ...ratings, riderRating: { rating: 6 } }, token)).body.error, 'invalid')
    const wrongStore = { restaurantRatings: [{ restaurant_id: 2, rating: 5 }] }
    assert.equal((await call('POST', `/orders/${order.order_id}/reviews`, wrongStore, token)).body.error, 'invalid')

    const ok = await call('POST', `/orders/${order.order_id}/reviews`, ratings, token)
    assert.equal(ok.status, 201)
    assert.deepEqual(ok.body, { ok: true })
    const saved = (await call('GET', `/orders/${order.order_id}/reviews`, null, token)).body
    assert.deepEqual(saved.restaurantReviews.map((r) => [r.restaurant_id, r.rating, r.comment]), [[1, 5, 'Sarap!'], [3, 4, null]])
    assert.equal(saved.riderReview, null)

    assert.equal((await call('POST', `/orders/${order.order_id}/reviews`, ratings, token)).body.error, 'already_rated')
    assert.equal((await call('POST', '/orders/1005/reviews', ratings, token)).status, 404) // not my order
  })
})
