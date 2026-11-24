import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { query } from '../db.js'
import { forbidden, unauthorized } from './errors.js'

export function signToken(user) {
  return jwt.sign({ sub: user.user_id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

// Checks the "Authorization: Bearer <token>" header and loads the user into req.user.
// The user is re-read from the database on every request, so a suspended account
// is locked out right away even if its token has not expired yet.
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) throw unauthorized('no_token', 'Please log in')

  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    throw unauthorized('invalid_token', 'Your session has expired. Please log in again.')
  }

  const { rows } = await query(
    `SELECT user_id, full_name, email, contact_number, role, account_status, created_at, updated_at
       FROM users WHERE user_id = $1`,
    [payload.sub],
  )
  const user = rows[0]
  if (!user) throw unauthorized('invalid_token')
  if (user.account_status !== 'active') throw forbidden(user.account_status)

  req.user = user
  next()
}

// Allows only the listed roles. The admin may also use every operator route,
// so requireRole('operator') lets admins through too.
export function requireRole(...roles) {
  const allowed = new Set(roles)
  if (allowed.has('operator')) allowed.add('admin')
  return (req, res, next) => {
    if (!allowed.has(req.user.role)) throw forbidden('wrong_role', 'You cannot open this page')
    next()
  }
}
