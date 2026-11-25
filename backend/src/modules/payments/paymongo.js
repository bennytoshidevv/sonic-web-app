import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../../config.js'
import { HttpError } from '../../middleware/errors.js'

// Everything that talks to PayMongo (https://docs.paymongo.com). No other file knows PayMongo's format.
// We use the v1 Checkout Session API: it can also RETRIEVE and EXPIRE a session, which we need so an
// order never has two payable checkout pages.

// Our payment_method → PayMongo's name for it.
const PAYMONGO_METHODS = { gcash: 'gcash', maya: 'paymaya', qr_ph: 'qrph', card: 'card' }
const TIMEOUT_MS = 10000

export const isOnlineMethod = (method) => method in PAYMONGO_METHODS
export const isPaymongoReady = () => Boolean(config.paymongoSecretKey)

// PayMongo counts money in centavos (₱434.00 = 43400).
export const toCentavos = (pesos) => Math.round(pesos * 100)

async function call(method, path, attributes) {
  let res
  try {
    res = await fetch(config.paymongoApiUrl + path, {
      method,
      headers: {
        // HTTP Basic: the secret key is the user name, the password is empty.
        authorization: `Basic ${Buffer.from(`${config.paymongoSecretKey}:`).toString('base64')}`,
        'content-type': 'application/json',
      },
      body: attributes && JSON.stringify({ data: { attributes } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    console.error('PayMongo could not be reached:', err.message)
    throw new HttpError(502, 'payment_provider_error', 'The payment service is not available right now. Please try again.')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.data?.id) {
    // PayMongo's own explanation is for us (bad key, method not enabled, ...), not for the customer.
    console.error(`PayMongo ${method} ${path} failed (${res.status}):`, JSON.stringify(json?.errors ?? null))
    throw new HttpError(502, 'payment_provider_error', 'The payment service is not available right now. Please try again.')
  }
  return json.data
}

// Creates the hosted checkout page. Returns the session { id, attributes: { checkout_url, ... } }.
export function createSession({ order, payment, lineItems }) {
  const orderPage = `${config.frontendUrl}/customer/orders/${order.order_id}`
  return call('POST', '/v1/checkout_sessions', {
    line_items: lineItems,
    payment_method_types: [PAYMONGO_METHODS[payment.payment_method]],
    reference_number: order.order_number,
    description: `Super Sonic Delivery order ${order.order_number}`,
    // Opening success_url does NOT prove payment (anyone can type it). Only the signed webhook does.
    success_url: orderPage,
    cancel_url: orderPage,
  })
}

export const retrieveSession = (id) => call('GET', `/v1/checkout_sessions/${encodeURIComponent(id)}`)
export const expireSession = (id) => call('POST', `/v1/checkout_sessions/${encodeURIComponent(id)}/expire`)

// The paid payment inside a session (PayMongo: at most one), or undefined.
export function paidPaymentOf(session) {
  return session?.attributes?.payments?.find((p) => p?.attributes?.status === 'paid')
}

// Checks the Paymongo-Signature header: "t=<time>,te=<test signature>,li=<live signature>".
// The signature is HMAC-SHA256 of "<t>.<raw body>" with the webhook's secret. Only PayMongo and we know that
// secret, so nobody else can send us a fake "paid" message. The RAW body is needed: re-writing the JSON could
// change a space and break the signature.
export function isValidSignature(header, rawBody) {
  const parts = Object.fromEntries(String(header ?? '').split(',').map((p) => p.trim().split('=')))
  // Choosing by OUR key means a test event can never be accepted as a live payment.
  const received = config.paymongoSecretKey.startsWith('sk_live_') ? parts.li : parts.te
  if (!parts.t || !received) return false
  const expected = createHmac('sha256', config.paymongoWebhookSecret).update(`${parts.t}.`).update(rawBody).digest()
  const given = Buffer.from(received, 'hex')
  // timingSafeEqual takes the same time for every wrong guess (and needs equal lengths).
  return given.length === expected.length && timingSafeEqual(given, expected)
}
