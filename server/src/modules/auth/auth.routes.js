import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query, withTransaction } from '../../db.js'
import { requireAuth, signToken } from '../../middleware/auth.js'
import { badRequest, conflict, forbidden, unauthorized } from '../../middleware/errors.js'
import { checkContactNumber, checkPassword, cleanEmail, requireFields } from '../../utils/validate.js'

// Auth: login, customer sign-up, rider/operator applications, own profile and password.
// Responses keep the same shape as the mock functions ({ user }, { ok: true }, { error }).

const router = Router()
const BCRYPT_ROUNDS = 10

// Columns safe to send to the browser (never password_hash).
const USER_COLUMNS = 'user_id, full_name, email, contact_number, role, account_status, created_at, updated_at'

async function emailTaken(email, exceptUserId = 0) {
  const { rows } = await query('SELECT 1 FROM users WHERE lower(email) = $1 AND user_id <> $2', [email, exceptUserId])
  return rows.length > 0
}

// POST /api/auth/login  { email, password } -> { token, user }
// Errors: 401 invalid, 403 suspended, 403 inactive
router.post('/login', async (req, res) => {
  requireFields(req.body, ['email', 'password'])
  const email = String(req.body.email).trim().toLowerCase()

  const { rows } = await query(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE lower(email) = $1`, [email])
  const found = rows[0]
  // Same message for "no such email" and "wrong password", so attackers can't
  // find out which emails have accounts.
  if (!found || !(await bcrypt.compare(req.body.password, found.password_hash))) {
    throw unauthorized('invalid', 'Wrong email or password')
  }
  if (found.account_status === 'suspended') throw forbidden('suspended', 'Account suspended')
  if (found.account_status === 'inactive') throw forbidden('inactive', 'Account not active yet')

  const { password_hash: _hidden, ...user } = found
  res.json({ token: signToken(user), user })
})

// POST /api/auth/register  { full_name, email, contact_number, password } -> { token, user }
// Customers only; the account is active right away.
router.post('/register', async (req, res) => {
  requireFields(req.body, ['full_name', 'email', 'contact_number', 'password'])
  const email = cleanEmail(req.body.email)
  const contact = checkContactNumber(req.body.contact_number)
  checkPassword(req.body.password)
  if (await emailTaken(email)) throw conflict('email_taken', 'This email already has an account')

  const hash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS)
  const { rows } = await query(
    `INSERT INTO users (full_name, email, contact_number, password_hash, role, account_status)
     VALUES ($1, $2, $3, $4, 'customer', 'active')
     RETURNING ${USER_COLUMNS}`,
    [req.body.full_name.trim(), email, contact, hash],
  )
  res.status(201).json({ token: signToken(rows[0]), user: rows[0] })
})

// POST /api/auth/apply  { role: 'rider'|'operator', full_name, email, contact_number, password,
//                         vehicle_type?, plate_number? } -> { ok: true }
// Creates an inactive account that staff must approve (rider -> operator, operator -> admin).
router.post('/apply', async (req, res) => {
  const { role } = req.body ?? {}
  if (!['rider', 'operator'].includes(role)) throw badRequest('invalid_role', 'Only riders and operators can apply')
  requireFields(req.body, ['full_name', 'email', 'contact_number', 'password', ...(role === 'rider' ? ['vehicle_type'] : [])])
  const email = cleanEmail(req.body.email)
  const contact = checkContactNumber(req.body.contact_number)
  checkPassword(req.body.password)
  if (await emailTaken(email)) throw conflict('email_taken', 'This email already has an account')

  const hash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS)
  await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO users (full_name, email, contact_number, password_hash, role, account_status)
       VALUES ($1, $2, $3, $4, $5, 'inactive') RETURNING user_id`,
      [req.body.full_name.trim(), email, contact, hash, role],
    )
    if (role === 'rider') {
      await db.query(
        `INSERT INTO rider_profiles (user_id, vehicle_type, plate_number, availability_status)
         VALUES ($1, $2, $3, 'offline')`,
        [rows[0].user_id, req.body.vehicle_type.trim(), req.body.plate_number?.trim() || null],
      )
    }
  })
  res.status(201).json({ ok: true })
})

// GET /api/auth/me -> { user }   (used on page refresh to check the saved token)
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// PATCH /api/auth/me  { full_name, email, contact_number } -> { user }
router.patch('/me', requireAuth, async (req, res) => {
  requireFields(req.body, ['full_name', 'email', 'contact_number'])
  const email = cleanEmail(req.body.email)
  const contact = checkContactNumber(req.body.contact_number)
  if (await emailTaken(email, req.user.user_id)) throw conflict('email_taken', 'This email already has an account')

  const { rows } = await query(
    `UPDATE users SET full_name = $1, email = $2, contact_number = $3, updated_at = now()
      WHERE user_id = $4 RETURNING ${USER_COLUMNS}`,
    [req.body.full_name.trim(), email, contact, req.user.user_id],
  )
  res.json({ user: rows[0] })
})

// POST /api/auth/change-password  { current_password, new_password } -> { ok: true }
router.post('/change-password', requireAuth, async (req, res) => {
  requireFields(req.body, ['current_password', 'new_password'])
  checkPassword(req.body.new_password)

  const { rows } = await query('SELECT password_hash FROM users WHERE user_id = $1', [req.user.user_id])
  if (!(await bcrypt.compare(req.body.current_password, rows[0].password_hash))) {
    throw badRequest('wrong_password', 'Current password is wrong')
  }
  const hash = await bcrypt.hash(req.body.new_password, BCRYPT_ROUNDS)
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2', [hash, req.user.user_id])
  res.json({ ok: true })
})

export default router
