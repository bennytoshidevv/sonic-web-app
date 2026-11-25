// PayMongo tests (module 10). Needs a seeded database: npm run db:reset, then npm test.
// A small fake PayMongo server runs inside this file, so no keys and no internet are needed.
import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import http from 'node:http'
import { config } from '../src/config.js'
import { call, loginAs, pool, setup } from './helpers.js'
import { createApp } from '../src/app.js'

const SECRET = 'whsk_test_secret'
const sessions = new Map() // the fake PayMongo's sessions
let requests = [] // what our API sent to it
let failNext = false
let fake
let hook // a second copy of the API, to post raw webhook bodies to
let me
let other
let addressId
let counter = 0

async function newCustomer(tag) {
  const { body } = await call('POST', '/auth/register', {
    full_name: 'Payment Tester', email: `pay${tag}${Date.now()}@test.ph`, contact_number: '09171234000', password: 'password123',
  })
  return body.token
}

setup(async () => {
  me = await newCustomer('a')
  other = await newCustomer('b')
  const address = await call('POST', '/addresses', { label: 'Home', barangay_id: 5, street_address: '1 Test St', landmark: '', is_default: true }, me)
  addressId = address.body.address_id
})

before(async () => {
  fake = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      const body = raw ? JSON.parse(raw).data.attributes : null
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body })
      const send = (status, json) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json))
      if (failNext) { failNext = false; return send(400, { errors: [{ code: 'x', detail: 'secret detail' }] }) }
      const [, id, action] = req.url.match(/checkout_sessions(?:\/([^/]+))?(?:\/(expire))?$/)
      if (!id) {
        const session = { id: `cs_${process.pid}_${Date.now()}_${++counter}`, type: 'checkout_session', attributes: { ...body, status: 'active', payments: [], checkout_url: `https://checkout.test/${counter}` } }
        sessions.set(session.id, session)
        return send(200, { data: session })
      }
      const session = sessions.get(id)
      if (!session) return send(404, { errors: [] })
      if (action) session.attributes.status = 'expired'
      send(200, { data: session })
    })
  })
  await new Promise((r) => fake.listen(0, r))
  hook = createApp().listen(0)
  await new Promise((r) => hook.once('listening', r))
})

after(() => {
  fake.close()
  fake.closeAllConnections()
  hook.close()
  hook.closeAllConnections()
})

beforeEach(() => {
  requests = []
  failNext = false
  Object.assign(config, {
    paymongoSecretKey: 'sk_test_abc', paymongoWebhookSecret: SECRET,
    paymongoApiUrl: `http://localhost:${fake.address().port}`, frontendUrl: 'http://shop.test',
  })
})

// Tapsilog-style order from 2 stores, to barangay Mangga (delivery fee 250) + one extra store (10)
async function place(payment_method = 'gcash') {
  const res = await call('POST', '/orders', { address_id: addressId, payment_method, lines: [{ item_id: 1, quantity: 2 }, { item_id: 13, quantity: 1 }] }, me)
  assert.equal(res.status, 201)
  return res.body.order
}
const pay = (orderId, token = me) => call('POST', `/payments/orders/${orderId}/checkout`, {}, token)
const paymentOf = async (orderId) => (await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId])).rows[0]
const rowsOf = async (sql, ...params) => (await pool.query(sql, params)).rows

async function checkout(method) {
  const order = await place(method)
  const res = await pay(order.order_id)
  assert.equal(res.status, 200)
  const payment = await paymentOf(order.order_id)
  return { order, payment, session: sessions.get(payment.provider_reference_id) }
}
const paidBy = (session, centavos) =>
  ({ ...session, attributes: { ...session.attributes, payments: [{ id: 'pay_1', attributes: { amount: centavos, currency: 'PHP', status: 'paid' } }] } })
const paidEvent = (session, centavos, id = `evt_${process.pid}_${Date.now()}_${++counter}`, type = 'checkout_session.payment.paid') =>
  ({ data: { id, type: 'event', attributes: { type, livemode: false, data: paidBy(session, centavos) } } })

// Signs like PayMongo does: HMAC-SHA256 of "<t>.<raw body>".
const sign = (raw, { secret = SECRET, field = 'te' } = {}) => {
  const hmac = createHmac('sha256', secret).update(`1700000000.${raw}`).digest('hex')
  return field === 'te' ? `t=1700000000,te=${hmac},li=` : `t=1700000000,te=,li=${hmac}`
}
async function webhook(event, { raw = JSON.stringify(event), signature = sign(raw) } = {}) {
  const res = await fetch(`http://localhost:${hook.address().port}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(signature && { 'paymongo-signature': signature }) },
    body: raw,
  })
  return { status: res.status, body: await res.json() }
}

describe('checkout session', () => {
  test('sends the right method, centavos and lines that add up to the payment', async () => {
    const expected = { gcash: 'gcash', maya: 'paymaya', qr_ph: 'qrph', card: 'card' }
    for (const [method, name] of Object.entries(expected)) {
      requests = []
      const { order, payment, session } = await checkout(method)
      const sent = requests[0]
      assert.equal(sent.url, '/v1/checkout_sessions')
      assert.equal(sent.auth, `Basic ${Buffer.from('sk_test_abc:').toString('base64')}`)
      assert.deepEqual(sent.body.payment_method_types, [name])
      assert.equal(sent.body.reference_number, order.order_number)
      assert.equal(sent.body.success_url, `http://shop.test/customer/orders/${order.order_id}`)
      const total = sent.body.line_items.reduce((s, l) => s + l.amount * l.quantity, 0)
      assert.equal(total, Math.round(payment.amount * 100))
      assert.ok(sent.body.line_items.some((l) => l.name === 'Delivery fee' && l.amount === 25000))
      assert.ok(sent.body.line_items.some((l) => l.name === 'Extra-store fee' && l.amount === 1000))
      assert.equal(payment.payment_status, 'pending') // opening the page is not paying
      assert.ok(session)
    }
  })

  test('paying again reuses the open session; an expired one is replaced', async () => {
    const { order, payment, session } = await checkout('gcash')
    assert.equal((await pay(order.order_id)).body.checkout_url, session.attributes.checkout_url)
    assert.equal((await paymentOf(order.order_id)).provider_reference_id, payment.provider_reference_id)
    session.attributes.status = 'expired'
    assert.equal((await pay(order.order_id)).status, 200)
    assert.notEqual((await paymentOf(order.order_id)).provider_reference_id, payment.provider_reference_id)
  })

  test('two clicks at once create only one session', async () => {
    const order = await place()
    requests = []
    const [a, b] = await Promise.all([pay(order.order_id), pay(order.order_id)])
    assert.equal(a.body.checkout_url, b.body.checkout_url)
    assert.equal(requests.filter((r) => r.method === 'POST').length, 1)
  })

  test('COD, cancelled, someone else, wrong role, bad id', async () => {
    const cod = await place('cod')
    assert.equal((await pay(cod.order_id)).body.error, 'not_online')
    const order = await place()
    const theirs = await pay(order.order_id, other)
    assert.equal(theirs.status, 404)
    assert.equal((await pay(order.order_id, await loginAs('operator@sonic.ph'))).status, 403)
    assert.equal((await call('POST', `/payments/orders/${order.order_id}/checkout`, {})).status, 401)
    assert.equal((await pay('abc')).body.error, 'invalid_id')
    await call('POST', `/orders/${order.order_id}/cancel`, { reason: 'x' }, me)
    assert.equal((await pay(order.order_id)).body.error, 'not_payable')
  })

  test('a PayMongo error gives 502 without its details and saves nothing', async () => {
    const order = await place()
    failNext = true
    const res = await pay(order.order_id)
    assert.equal(res.status, 502)
    assert.equal(res.body.error, 'payment_provider_error')
    assert.doesNotMatch(JSON.stringify(res.body), /secret detail/)
    assert.equal((await paymentOf(order.order_id)).provider_reference_id, null)
  })

  test('a missed webhook is caught: PayMongo says paid, so the payment becomes paid', async () => {
    const { order, payment, session } = await checkout('gcash')
    session.attributes.payments = paidBy(session, payment.amount * 100).attributes.payments
    assert.equal((await pay(order.order_id)).body.error, 'already_paid')
    assert.equal((await paymentOf(order.order_id)).payment_status, 'paid')
  })

  test('cancelling closes the checkout page', async () => {
    const { order, session } = await checkout('card')
    await call('POST', `/orders/${order.order_id}/cancel`, { reason: 'x' }, me)
    for (let i = 0; i < 50 && session.attributes.status !== 'expired'; i++) await new Promise((r) => setTimeout(r, 20))
    assert.equal(session.attributes.status, 'expired')
  })

  test('a staff rejection closes it too', async () => {
    const { order, session } = await checkout('card')
    await call('POST', `/staff/orders/${order.order_id}/reject`, { reason: 'x' }, await loginAs('operator@sonic.ph'))
    for (let i = 0; i < 50 && session.attributes.status !== 'expired'; i++) await new Promise((r) => setTimeout(r, 20))
    assert.equal(session.attributes.status, 'expired')
  })
})

describe('webhook', () => {
  test('paid: payment, history, notification and raw event are saved; the order waits for the operator', async () => {
    const { order, payment, session } = await checkout('maya')
    const event = paidEvent(session, payment.amount * 100)
    assert.deepEqual(await webhook(event), { status: 200, body: { ok: true } })

    const after = await paymentOf(order.order_id)
    assert.equal(after.payment_status, 'paid')
    assert.ok(after.paid_at)
    const details = (await call('GET', `/orders/${order.order_id}`, null, me)).body
    assert.equal(details.order.order_status, 'pending')
    assert.equal(details.history.at(-1).remarks, 'Online payment received (Maya)')
    assert.equal(details.history.at(-1).changed_by, null)
    const [note] = await rowsOf("SELECT * FROM notifications WHERE order_id = $1 AND type = 'payment'", order.order_id)
    assert.match(note.message, /received your online payment/)
    const [saved] = await rowsOf('SELECT * FROM payment_webhook_events WHERE provider_event_id = $1', event.data.id)
    assert.deepEqual(saved.raw_payload, event)
    assert.equal(saved.payment_id, payment.payment_id)
    assert.ok(saved.processed_at)
    assert.equal((await pay(order.order_id)).body.error, 'already_paid')
  })

  test('the same event, sent again and 5 times at once, is processed once', async () => {
    const { order, payment, session } = await checkout('gcash')
    const event = paidEvent(session, payment.amount * 100)
    const results = await Promise.all(Array.from({ length: 5 }, () => webhook(event)))
    assert.ok(results.every((r) => r.status === 200))
    assert.equal((await webhook(event)).status, 200)
    // A different event about the same session changes nothing either.
    assert.equal((await webhook(paidEvent(session, payment.amount * 100))).status, 200)
    assert.equal((await rowsOf('SELECT 1 FROM payment_webhook_events WHERE provider_event_id = $1', event.data.id)).length, 1)
    assert.equal((await rowsOf("SELECT 1 FROM order_status_history WHERE order_id = $1 AND remarks LIKE 'Online payment%'", order.order_id)).length, 1)
    assert.equal((await rowsOf("SELECT 1 FROM notifications WHERE order_id = $1 AND type = 'payment'", order.order_id)).length, 1)
  })

  test('an event that failed halfway is processed on the retry', async () => {
    const { order, payment, session } = await checkout('gcash')
    const event = paidEvent(session, payment.amount * 100)
    // As if the first try saved the raw event and then crashed.
    await pool.query('INSERT INTO payment_webhook_events (provider_event_id, event_type, raw_payload) VALUES ($1, $2, $3)', [event.data.id, 'checkout_session.payment.paid', JSON.stringify(event)])
    await webhook(event)
    assert.equal((await paymentOf(order.order_id)).payment_status, 'paid')
  })

  test('bad signatures are refused and nothing is stored', async () => {
    const { order, payment, session } = await checkout('gcash')
    const event = paidEvent(session, payment.amount * 100)
    const raw = JSON.stringify(event)
    const bad = [
      { signature: null },
      { signature: 'nonsense' },
      { signature: 't=1,te=zz,li=' },
      { signature: sign(raw, { secret: 'wrong' }) },
      { signature: sign(raw, { field: 'li' }) }, // a live signature while we use a test key
      { signature: sign(raw), raw: raw.replace('"paid"', '"paid" ') }, // the body was changed after signing
    ]
    for (const options of bad) {
      const res = await webhook(event, { raw, ...options })
      assert.equal(res.status, 401)
      assert.equal(res.body.error, 'invalid_signature')
    }
    assert.equal((await paymentOf(order.order_id)).payment_status, 'pending')
    assert.equal((await rowsOf('SELECT 1 FROM payment_webhook_events WHERE provider_event_id = $1', event.data.id)).length, 0)
  })

  test('with a live key only the live signature counts', async () => {
    const { order, payment, session } = await checkout('gcash')
    const event = paidEvent(session, payment.amount * 100)
    const raw = JSON.stringify(event)
    config.paymongoSecretKey = 'sk_live_abc'
    assert.equal((await webhook(event)).status, 401)
    assert.equal((await webhook(event, { signature: sign(raw, { field: 'li' }) })).status, 200)
    assert.equal((await paymentOf(order.order_id)).payment_status, 'paid')
  })

  test('a wrong amount is stored but not marked as paid', async () => {
    const { order, session } = await checkout('gcash')
    assert.equal((await webhook(paidEvent(session, 100))).status, 200)
    assert.equal((await paymentOf(order.order_id)).payment_status, 'pending')
  })

  test('other events and unknown sessions are stored and answered 200', async () => {
    const { order, payment, session } = await checkout('gcash')
    const failed = paidEvent(session, payment.amount * 100, undefined, 'payment.failed')
    assert.equal((await webhook(failed)).status, 200)
    assert.equal((await paymentOf(order.order_id)).payment_status, 'pending') // they may try again
    const unknown = paidEvent({ id: 'cs_unknown', attributes: {} }, 100)
    assert.equal((await webhook(unknown)).status, 200)
    for (const e of [failed, unknown]) {
      const [row] = await rowsOf('SELECT * FROM payment_webhook_events WHERE provider_event_id = $1', e.data.id)
      assert.equal(row.payment_id, null)
      assert.ok(row.processed_at)
    }
  })

  test('paid after the order was cancelled: a pending refund', async () => {
    const { order, payment, session } = await checkout('gcash')
    await call('POST', `/orders/${order.order_id}/cancel`, { reason: 'x' }, me)
    await webhook(paidEvent(session, payment.amount * 100))
    const refunds = await rowsOf('SELECT * FROM refunds WHERE payment_id = $1', payment.payment_id)
    assert.equal(refunds.length, 1)
    assert.equal(refunds[0].refund_status, 'pending')
    assert.equal(refunds[0].amount, payment.amount)
  })

  test('signed but not JSON, or not an event: 400', async () => {
    assert.equal((await webhook(null, { raw: 'hello' })).status, 400)
    assert.equal((await webhook({ data: {} })).body.error, 'invalid')
  })
})

describe('without PayMongo keys', () => {
  beforeEach(() => Object.assign(config, { paymongoSecretKey: '', paymongoWebhookSecret: '' }))

  test('COD still works; checkout and webhook answer 503', async () => {
    const order = await place('cod')
    assert.equal((await paymentOf(order.order_id)).payment_status, 'pending')
    const cancelled = await call('POST', `/orders/${order.order_id}/cancel`, { reason: 'x' }, me)
    assert.equal(cancelled.status, 200)
    const online = await place('gcash')
    const res = await pay(online.order_id)
    assert.equal(res.status, 503)
    assert.equal(res.body.error, 'payments_unavailable')
    assert.equal((await webhook({ data: {} })).status, 503)
    assert.equal(requests.length, 0)
    await call('POST', `/orders/${online.order_id}/cancel`, { reason: 'x' }, me)
  })
})

// Leave no live test orders behind for the other test files.
after(() => pool.query("UPDATE customer_orders SET order_status = 'cancelled' WHERE dropoff_street = '1 Test St' AND order_status = 'pending'").catch(() => {}))
