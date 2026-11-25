// Notification API tests. Needs a seeded database: npm run db:reset, then npm test.
// Uses two brand-new customers, so the demo accounts' notifications are not touched.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { call, loginAs, pool, setup } from './helpers.js'
import { notify } from '../src/utils/notify.js'

let me // { token, id }
let other

async function newCustomer(name) {
  const { body } = await call('POST', '/auth/register', {
    full_name: name,
    email: `${name.toLowerCase()}${Date.now()}@test.ph`,
    contact_number: '09171234000',
    password: 'password123',
  })
  return { token: body.token, id: body.user.user_id }
}

const list = async (user, search = '') => (await call('GET', `/notifications${search}`, null, user.token)).body
const count = async (user) => (await call('GET', '/notifications/unread-count', null, user.token)).body
const markRead = (user, id) => call('PUT', `/notifications/${id}/read`, null, user.token)

setup(async () => {
  me = await newCustomer('Notifyme')
  other = await newCustomer('Notifyother')
})

describe('no notifications yet', () => {
  test('empty list, count 0, read-all changes nothing', async () => {
    assert.deepEqual(await list(me), [])
    assert.deepEqual(await count(me), { count: 0 })
    assert.deepEqual((await call('PUT', '/notifications/read-all', null, me.token)).body, { ok: true, updated: 0 })
  })
})

describe('list, count and mark as read', () => {
  test('newest first, with the order number, and only my own', async () => {
    await notify(pool, { user_id: me.id, order_id: 1001, type: 'order_status', message: 'first' })
    await notify(pool, { user_id: me.id, type: 'order_status', message: 'second' }) // no order
    await notify(pool, { user_id: me.id, type: 'order_status', message: 'third' })
    await notify(pool, { user_id: other.id, type: 'order_status', message: 'not yours' })

    const rows = await list(me)
    assert.deepEqual(rows.map((n) => n.message), ['third', 'second', 'first'])
    assert.match(rows[2].order_number, /^SSD-\d{8}-1001$/)
    assert.equal(rows[1].order_number, null)
    assert.equal(rows[0].is_read, false)
    assert.equal(rows[0].read_at, null)
    assert.equal(rows[0].user_id, undefined)
    assert.deepEqual(await count(me), { count: 3 })
    assert.deepEqual(await count(other), { count: 1 })
  })

  test('mark one as read; repeating it keeps the first read time', async () => {
    const [third] = await list(me)
    const res = await markRead(me, third.notification_id)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { ok: true })
    const [first] = await list(me)
    assert.equal(first.is_read, true)
    assert.ok(first.read_at)
    assert.deepEqual(await count(me), { count: 2 })

    assert.equal((await markRead(me, third.notification_id)).status, 200)
    assert.equal((await list(me))[0].read_at, first.read_at)
  })

  test('unread filter', async () => {
    assert.deepEqual((await list(me, '?unread=true')).map((n) => n.message), ['second', 'first'])
    assert.equal((await list(me, '?unread=false')).length, 3) // false = no filter
    const bad = await call('GET', '/notifications?unread=maybe', null, me.token)
    assert.equal(bad.status, 400)
    assert.equal(bad.body.error, 'invalid')
  })

  test("someone else's notification answers 404 and stays unread", async () => {
    const [theirs] = await list(other)
    const res = await markRead(me, theirs.notification_id)
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'not_found')
    assert.deepEqual(await count(other), { count: 1 })
  })

  test('unknown id gives 404, a bad id gives 400', async () => {
    assert.equal((await markRead(me, 99999999)).status, 404)
    const bad = await markRead(me, 'abc')
    assert.equal(bad.status, 400)
    assert.equal(bad.body.error, 'invalid_id')
  })

  test('read-all marks only mine and keeps earlier read times', async () => {
    const before = (await list(me))[0].read_at
    assert.deepEqual((await call('PUT', '/notifications/read-all', null, me.token)).body, { ok: true, updated: 2 })
    assert.deepEqual(await count(me), { count: 0 })
    assert.equal((await list(me))[0].read_at, before)
    assert.deepEqual(await count(other), { count: 1 })
  })

  test('the list stops at 50, the count does not', async () => {
    await pool.query(
      "INSERT INTO notifications (user_id, type, message) SELECT $1, 'order_status', 'n' || g FROM generate_series(1, 55) g",
      [other.id],
    )
    assert.equal((await list(other)).length, 50)
    assert.deepEqual(await count(other), { count: 56 })
  })
})

describe('real order flow', () => {
  test('confirming an order notifies its customer and nobody else', async () => {
    const address = (await call('POST', '/addresses', { label: 'Home', barangay_id: 1, street_address: '1 Test St', landmark: '', is_default: true }, me.token)).body
    const { order } = (await call('POST', '/orders', { address_id: address.address_id, lines: [{ item_id: 1, quantity: 1 }], payment_method: 'cod' }, me.token)).body
    const beforeOther = await count(other)

    const operator = { token: await loginAs('operator@sonic.ph') }
    const res = await call('POST', `/staff/orders/${order.order_id}/advance`, {}, operator.token)
    assert.equal(res.status, 200)

    const [latest] = await list(me, '?unread=true')
    assert.equal(latest.order_id, order.order_id)
    assert.equal(latest.order_number, order.order_number)
    assert.match(latest.message, /confirmed your order/)
    assert.deepEqual(await count(other), beforeOther)

    // Leave no live test order behind.
    await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: 'Test order' }, operator.token)
  })
})

describe('who may use it', () => {
  test('every role can open their own list', async () => {
    for (const role of ['customer', 'rider', 'operator', 'admin']) {
      const token = await loginAs(`${role}@sonic.ph`)
      const res = await call('GET', '/notifications', null, token)
      assert.equal(res.status, 200)
      assert.ok(Array.isArray(res.body))
    }
  })

  test('not logged in gives 401 on every route', async () => {
    const routes = [
      ['GET', '/notifications'],
      ['GET', '/notifications/unread-count'],
      ['PUT', '/notifications/read-all'],
      ['PUT', '/notifications/1/read'],
    ]
    for (const [method, path] of routes) {
      const res = await call(method, path)
      assert.equal(res.status, 401)
      assert.equal(res.body.error, 'no_token')
    }
  })
})
