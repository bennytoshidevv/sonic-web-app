import { Router } from 'express'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, notFound } from '../../middleware/errors.js'
import { optionalText, requiredText, toId } from '../../utils/validate.js'

// Customer addresses (module 2): list, add, edit, set default, delete. Mounted at /api/addresses.
// Every route works on the logged-in customer's own addresses only: the user id always comes from
// the login token, and someone else's address answers 404 (as if it did not exist).
// Responses keep the same shape as the mock functions in frontend/src/mock/mock.js.

const router = Router()
router.use(requireAuth, requireRole('customer'))

// An address with its barangay name, city and delivery fee (like the mock's getCustomerAddresses).
const ADDRESS_WITH_BARANGAY = `
  SELECT a.*, b.barangay_name, b.city_municipality, b.delivery_fee
    FROM customer_addresses a
    JOIN barangays b ON b.barangay_id = a.barangay_id`

// Checks the form fields: { label, barangay_id, street_address, landmark, is_default }.
// The city is not sent: it comes from the barangay.
function readAddressBody(body) {
  return {
    label: optionalText(body?.label, 'Label', 50),
    barangay_id: toId(body?.barangay_id, 'barangay'),
    street_address: requiredText(body?.street_address, 'Street address', 255),
    landmark: optionalText(body?.landmark, 'Landmark', 255),
    is_default: body?.is_default === true,
  }
}

// New addresses must use a barangay Sonic still delivers to (hidden barangays can't be chosen).
// An address that already uses a now-hidden barangay may keep it when other fields are edited.
async function checkBarangay(db, barangayId, currentBarangayId = null) {
  if (barangayId === currentBarangayId) return
  const { rows } = await db.query('SELECT 1 FROM barangays WHERE barangay_id = $1 AND is_active', [barangayId])
  if (!rows[0]) throw badRequest('invalid_barangay', 'Choose a barangay from the list')
}

// Address changes of one customer run one at a time: locking the customer's users row makes a
// second request wait, so two "set default" clicks can't leave two default addresses.
async function lockCustomer(db, userId) {
  await db.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE', [userId])
}

async function findOwnAddress(db, userId, addressId) {
  const { rows } = await db.query(
    'SELECT * FROM customer_addresses WHERE address_id = $1 AND user_id = $2 AND is_active FOR UPDATE',
    [addressId, userId],
  )
  if (!rows[0]) throw notFound('not_found', 'Address not found')
  return rows[0]
}

// Only one default address per customer.
function clearDefault(db, userId) {
  return db.query('UPDATE customer_addresses SET is_default = false WHERE user_id = $1 AND is_default', [userId])
}

// GET /api/addresses -> my active addresses with barangay details (getCustomerAddresses)
router.get('/', async (req, res) => {
  const { rows } = await query(`${ADDRESS_WITH_BARANGAY} WHERE a.user_id = $1 AND a.is_active ORDER BY a.address_id`, [
    req.user.user_id,
  ])
  res.json(rows)
})

// POST /api/addresses  { label, barangay_id, street_address, landmark, is_default } -> the new address (addCustomerAddress)
// The first address always becomes the default, so checkout has an address to start from.
router.post('/', async (req, res) => {
  const data = readAddressBody(req.body)
  const userId = req.user.user_id

  const addressId = await withTransaction(async (db) => {
    await lockCustomer(db, userId)
    await checkBarangay(db, data.barangay_id)
    const { rows } = await db.query('SELECT 1 FROM customer_addresses WHERE user_id = $1 AND is_active LIMIT 1', [userId])
    const isFirst = rows.length === 0
    if (data.is_default) await clearDefault(db, userId)
    const inserted = await db.query(
      `INSERT INTO customer_addresses (user_id, barangay_id, label, street_address, landmark, is_default)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING address_id`,
      [userId, data.barangay_id, data.label, data.street_address, data.landmark, isFirst || data.is_default],
    )
    return inserted.rows[0].address_id
  })

  const { rows } = await query(`${ADDRESS_WITH_BARANGAY} WHERE a.address_id = $1`, [addressId])
  res.status(201).json(rows[0])
})

// PUT /api/addresses/:id  { label, barangay_id, street_address, landmark, is_default } -> { ok } (updateCustomerAddress)
// Like the mock, unticking "default" here does not remove the default (use another address's
// "set default" instead), so a customer never ends up without one.
// Past orders are not affected: they keep their own copy of the address.
router.put('/:id', async (req, res) => {
  const addressId = toId(req.params.id, 'address id')
  const data = readAddressBody(req.body)
  const userId = req.user.user_id

  await withTransaction(async (db) => {
    await lockCustomer(db, userId)
    const address = await findOwnAddress(db, userId, addressId)
    await checkBarangay(db, data.barangay_id, address.barangay_id)
    if (data.is_default) await clearDefault(db, userId)
    await db.query(
      `UPDATE customer_addresses
          SET label = $1, barangay_id = $2, street_address = $3, landmark = $4, is_default = $5
        WHERE address_id = $6`,
      [data.label, data.barangay_id, data.street_address, data.landmark, data.is_default || address.is_default, addressId],
    )
  })
  res.json({ ok: true })
})

// PUT /api/addresses/:id/default -> { ok } (setDefaultAddress)
router.put('/:id/default', async (req, res) => {
  const addressId = toId(req.params.id, 'address id')
  const userId = req.user.user_id
  await withTransaction(async (db) => {
    await lockCustomer(db, userId)
    await findOwnAddress(db, userId, addressId)
    await clearDefault(db, userId)
    await db.query('UPDATE customer_addresses SET is_default = true WHERE address_id = $1', [addressId])
  })
  res.json({ ok: true })
})

// DELETE /api/addresses/:id -> { ok } (deleteCustomerAddress)
// Soft delete (is_active = false), so old data stays consistent. If it was the default,
// the oldest remaining address becomes the default.
router.delete('/:id', async (req, res) => {
  const addressId = toId(req.params.id, 'address id')
  const userId = req.user.user_id
  await withTransaction(async (db) => {
    await lockCustomer(db, userId)
    const address = await findOwnAddress(db, userId, addressId)
    await db.query('UPDATE customer_addresses SET is_active = false, is_default = false WHERE address_id = $1', [addressId])
    if (address.is_default) {
      await db.query(
        `UPDATE customer_addresses SET is_default = true
          WHERE address_id = (SELECT address_id FROM customer_addresses
                               WHERE user_id = $1 AND is_active ORDER BY address_id LIMIT 1)`,
        [userId],
      )
    }
  })
  res.json({ ok: true })
})

export default router
