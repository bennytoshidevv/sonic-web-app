import { Router } from 'express'
import { config } from '../../config.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { HttpError, badRequest, unauthorized } from '../../middleware/errors.js'
import { toId } from '../../utils/validate.js'
import { isPaymongoReady, isValidSignature } from './paymongo.js'
import { handleEvent, startCheckout } from './payments.service.js'

// Online payments with PayMongo (module 10). Mounted at /api/payments.
// Without the PayMongo keys these two routes answer 503; everything else (COD too) works as usual.

const router = Router()

const notSetUp = () => new HttpError(503, 'payments_unavailable', 'Online payment is not available right now')

// POST /api/payments/orders/:id/checkout -> { checkout_url }: the PayMongo page where the customer pays this order.
router.post('/orders/:id/checkout', requireAuth, requireRole('customer'), async (req, res) => {
  const orderId = toId(req.params.id, 'order id')
  if (!isPaymongoReady()) throw notSetUp()
  res.json(await startCheckout(orderId, req.user.user_id))
})

// POST /api/payments/webhook: called by PayMongo, not by our pages. There is no login; the signature proves who sent it.
// req.body is the raw bytes (see app.js). Any 2xx answer means "received"; an error makes PayMongo send it again.
router.post('/webhook', async (req, res) => {
  if (!isPaymongoReady() || !config.paymongoWebhookSecret) throw notSetUp()
  if (!Buffer.isBuffer(req.body) || !isValidSignature(req.get('paymongo-signature'), req.body)) {
    throw unauthorized('invalid_signature', 'Invalid signature')
  }
  let event
  try {
    event = JSON.parse(req.body)
  } catch {
    throw badRequest('bad_request', 'Invalid JSON body')
  }
  if (typeof event?.data?.id !== 'string' || typeof event.data.attributes?.type !== 'string') throw badRequest('invalid', 'Not a PayMongo event')
  await handleEvent(event)
  res.json({ ok: true })
})

export default router
