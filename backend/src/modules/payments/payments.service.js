import { query, withTransaction } from '../../db.js'
import { conflict, notFound } from '../../middleware/errors.js'
import { notify } from '../../utils/notify.js'
import { createSession, expireSession, isOnlineMethod, isPaymongoReady, paidPaymentOf, retrieveSession, toCentavos } from './paymongo.js'

// Online payments. The checkout session id (cs_...) is kept in payments.provider_reference_id.

const METHOD_NAMES = { gcash: 'GCash', maya: 'Maya', qr_ph: 'QR Ph', card: 'card' }

// What the customer sees on the PayMongo page, from the order's own snapshots: items, delivery fee, extra stores.
async function lineItemsOf(db, order) {
  const { rows: items } = await db.query('SELECT item_name, unit_price, quantity FROM order_items WHERE order_id = $1 ORDER BY order_item_id', [
    order.order_id,
  ])
  const { rows: extra } = await db.query('SELECT COALESCE(sum(extra_store_fee), 0) AS fee FROM order_restaurants WHERE order_id = $1', [
    order.order_id,
  ])
  return [
    ...items.map((i) => ({ name: i.item_name, amount: toCentavos(i.unit_price), quantity: i.quantity })),
    { name: 'Delivery fee', amount: toCentavos(order.base_delivery_fee), quantity: 1 },
    { name: 'Extra-store fee', amount: toCentavos(extra[0].fee), quantity: 1 },
  ]
    .filter((line) => line.amount > 0)
    .map((line) => ({ ...line, currency: 'PHP' }))
}

// Records that a session was paid. Called by the webhook, and by startCheckout when a webhook was missed.
// The caller has locked the order and then the payment (always in that order, so two requests can't block each other).
// Doing it twice changes nothing: a payment that is already paid is left alone.
async function markPaid(db, order, payment, session) {
  if (payment.payment_status === 'paid' || payment.payment_status === 'refunded') return
  const paid = paidPaymentOf(session)
  if (!paid) return
  if (paid.attributes.amount !== toCentavos(payment.amount) || (paid.attributes.currency ?? 'PHP') !== 'PHP') {
    console.error(`Payment ${payment.payment_id}: PayMongo amount ${paid.attributes.amount} does not match ${payment.amount}. Not marked as paid.`)
    return
  }
  await db.query("UPDATE payments SET payment_status = 'paid', paid_at = now() WHERE payment_id = $1", [payment.payment_id])

  if (order.order_status === 'cancelled') {
    // Paid at the same moment the order was cancelled: the money must go back (same rule as cancelling a paid order).
    await db.query("INSERT INTO refunds (payment_id, amount, reason) VALUES ($1, $2, 'Paid after the order was cancelled')", [
      payment.payment_id,
      payment.amount,
    ])
  } else {
    // The order keeps its status (the operator still confirms it); the history shows when it was paid.
    // changed_by is empty, so staff see "System".
    await db.query('INSERT INTO order_status_history (order_id, status, remarks) VALUES ($1, $2, $3)', [
      order.order_id,
      order.order_status,
      `Online payment received (${METHOD_NAMES[payment.payment_method]})`,
    ])
  }
  await notify(db, {
    user_id: order.customer_id,
    order_id: order.order_id,
    type: 'payment',
    message:
      order.order_status === 'cancelled'
        ? `${order.order_number}: We received your payment after the order was cancelled. A refund was requested.`
        : `${order.order_number}: We received your online payment.`,
  })
}

// Returns { checkout_url } for one of my unpaid online orders.
// The rows stay locked while PayMongo answers, so clicking "Pay" twice can't create two payable pages.
// An open session is reused; a new one is made only when the old one expired.
export async function startCheckout(orderId, customerId) {
  const result = await withTransaction(async (db) => {
    const { rows: orders } = await db.query('SELECT * FROM customer_orders WHERE order_id = $1 AND customer_id = $2 FOR UPDATE', [orderId, customerId])
    const order = orders[0]
    if (!order) throw notFound('not_found', 'Order not found')
    const { rows: payments } = await db.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY payment_id DESC LIMIT 1 FOR UPDATE', [orderId])
    const payment = payments[0]
    if (!payment || !isOnlineMethod(payment.payment_method)) throw conflict('not_online', 'This order is paid in cash on delivery')
    if (payment.payment_status === 'paid') throw conflict('already_paid', 'This order is already paid')
    if (order.order_status === 'cancelled' || payment.payment_status !== 'pending') throw conflict('not_payable', 'This order can no longer be paid')

    if (payment.provider_reference_id) {
      const session = await retrieveSession(payment.provider_reference_id)
      if (paidPaymentOf(session)) {
        // The webhook has not arrived (or was missed), but PayMongo itself says it is paid.
        await markPaid(db, order, payment, session)
        return { alreadyPaid: true } // not thrown here: an error would roll the update back
      }
      if (session.attributes.status === 'active') return { checkout_url: session.attributes.checkout_url }
    }

    const session = await createSession({ order, payment, lineItems: await lineItemsOf(db, order) })
    await db.query('UPDATE payments SET provider_reference_id = $2 WHERE payment_id = $1', [payment.payment_id, session.id])
    return { checkout_url: session.attributes.checkout_url }
  })
  if (result.alreadyPaid) throw conflict('already_paid', 'This order is already paid')
  return result
}

// After an order is cancelled, close its checkout page so it can't be paid any more. Best effort: the order is
// already cancelled, and if the customer was just paying, markPaid records a refund.
export async function closeCheckout(orderId) {
  if (!isPaymongoReady()) return
  try {
    const { rows } = await query(
      "SELECT provider_reference_id FROM payments WHERE order_id = $1 AND payment_status = 'pending' AND provider_reference_id IS NOT NULL",
      [orderId],
    )
    for (const row of rows) await expireSession(row.provider_reference_id)
  } catch (err) {
    console.error(`Could not close the checkout of order ${orderId}:`, err.message)
  }
}

// Handles one verified webhook event.
// 1. The raw event is saved first and on its own, so it is kept even when step 2 fails.
// 2. Then it is processed once. PayMongo may send the same event many times: provider_event_id is UNIQUE, and
//    processed_at tells us the work is done. If step 2 failed, processed_at is empty and PayMongo's retry tries again.
export async function handleEvent(event) {
  const eventId = event.data.id
  const type = event.data.attributes.type
  await query(
    `INSERT INTO payment_webhook_events (provider_event_id, event_type, raw_payload) VALUES ($1, $2, $3)
     ON CONFLICT (provider_event_id) DO NOTHING`,
    [eventId, type, JSON.stringify(event)],
  )

  await withTransaction(async (db) => {
    // The lock makes a second copy of the same event wait here, then see that it is already processed.
    const { rows } = await db.query('SELECT event_id, processed_at FROM payment_webhook_events WHERE provider_event_id = $1 FOR UPDATE', [eventId])
    if (rows[0].processed_at) return

    // Other events (e.g. payment.failed: the customer may simply try again on the same page) are only stored.
    const paymentId = type === 'checkout_session.payment.paid' ? await processPaidSession(db, event.data.attributes.data) : null
    await db.query('UPDATE payment_webhook_events SET processed_at = now(), payment_id = $2 WHERE event_id = $1', [rows[0].event_id, paymentId])
  })
}

// Finds our payment by the session id we saved. An unknown session (e.g. made before a db:reset) is ignored.
async function processPaidSession(db, session) {
  const { rows: found } = await db.query('SELECT payment_id, order_id FROM payments WHERE provider_reference_id = $1', [session?.id ?? null])
  if (!found[0]) return null
  const { rows: orders } = await db.query('SELECT * FROM customer_orders WHERE order_id = $1 FOR UPDATE', [found[0].order_id])
  const { rows: payments } = await db.query('SELECT * FROM payments WHERE payment_id = $1 FOR UPDATE', [found[0].payment_id])
  await markPaid(db, orders[0], payments[0], session)
  return found[0].payment_id
}
