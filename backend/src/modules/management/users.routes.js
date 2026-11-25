import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query, withTransaction } from '../../db.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { badRequest, conflict, forbidden, notFound } from '../../middleware/errors.js'
import { audit } from '../../utils/audit.js'
import { checkContactNumber, checkPassword, cleanEmail, optionalText, requireFields, toId } from '../../utils/validate.js'

// Operator management, part 3 (module 6): customers, operators, rider accounts and account status.
// Mounted at /api/staff/users. Operators and the admin only.
// Approval rules (same as the mock): operators manage riders and customers; only the admin can change
// operator accounts; nobody can change an admin account here, or their own account. Users are never deleted.

const router = Router()
router.use(requireAuth, requireRole('operator'))

// Columns safe to send to the browser (never password_hash).
const USER_COLUMNS = 'user_id, full_name, email, contact_number, role, account_status, created_at, updated_at'
const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended']

// GET /api/staff/users/customers -> [{ user, order_count, delivered_count, total_spent }] (getCustomersForStaff)
// total_spent = items + barangay fee + extra-store fees of delivered orders (the calc.js orderTotal formula),
// computed when read, never stored.
router.get('/customers', async (req, res) => {
  const { rows } = await query(`
    SELECT jsonb_build_object('user_id', u.user_id, 'full_name', u.full_name, 'email', u.email, 'contact_number', u.contact_number,
                              'role', u.role, 'account_status', u.account_status, 'created_at', u.created_at, 'updated_at', u.updated_at) AS "user",
           (SELECT count(*)::int FROM customer_orders o WHERE o.customer_id = u.user_id) AS order_count,
           (SELECT count(*)::int FROM customer_orders o WHERE o.customer_id = u.user_id AND o.order_status = 'delivered') AS delivered_count,
           (SELECT COALESCE(sum(
                     (SELECT COALESCE(sum(oi.quantity * oi.unit_price), 0) FROM order_items oi WHERE oi.order_id = o.order_id)
                     + o.base_delivery_fee
                     + (SELECT COALESCE(sum(orr.extra_store_fee), 0) FROM order_restaurants orr WHERE orr.order_id = o.order_id)), 0)
              FROM customer_orders o
             WHERE o.customer_id = u.user_id AND o.order_status = 'delivered') AS total_spent
      FROM users u
     WHERE u.role = 'customer'
     ORDER BY u.user_id`)
  res.json(rows)
})

// GET /api/staff/users/operators -> operator users (getOperatorsForStaff)
router.get('/operators', async (req, res) => {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE role = 'operator' ORDER BY user_id`)
  res.json(rows)
})

// GET /api/staff/users/names?ids=1,2,3 -> { "1": "Maria ...", ... } (getUserNames)
// For "processed by" columns. An unknown id shows as 'System', like the mock.
router.get('/names', async (req, res) => {
  const text = String(req.query.ids ?? '').trim()
  const ids = text === '' ? [] : [...new Set(text.split(',').map((id) => toId(id, 'user id')))]
  const { rows } = await query('SELECT user_id, full_name FROM users WHERE user_id = ANY($1::int[])', [ids])
  const names = new Map(rows.map((r) => [r.user_id, r.full_name]))
  res.json(Object.fromEntries(ids.map((id) => [id, names.get(id) ?? 'System'])))
})

// POST /api/staff/users/riders  { full_name, email, contact_number, password, vehicle_type, plate_number } -> { user } (createRiderAccount)
// Staff create a rider directly (active right away) with a temporary password the rider changes later.
router.post('/riders', async (req, res) => {
  requireFields(req.body, ['full_name', 'email', 'contact_number', 'password', 'vehicle_type'])
  const email = cleanEmail(req.body.email)
  const contact = checkContactNumber(req.body.contact_number)
  checkPassword(req.body.password)
  const hash = await bcrypt.hash(req.body.password, 10)

  const user = await withTransaction(async (db) => {
    const taken = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [email])
    if (taken.rows[0]) throw conflict('email_taken', 'This email already has an account')
    const { rows } = await db.query(
      `INSERT INTO users (full_name, email, contact_number, password_hash, role, account_status)
       VALUES ($1, $2, $3, $4, 'rider', 'active') RETURNING ${USER_COLUMNS}`,
      [optionalText(req.body.full_name, 'Full name', 100), email, contact, hash],
    )
    await db.query(
      "INSERT INTO rider_profiles (user_id, vehicle_type, plate_number, availability_status) VALUES ($1, $2, $3, 'offline')",
      [rows[0].user_id, optionalText(req.body.vehicle_type, 'Vehicle type', 50), optionalText(req.body.plate_number, 'Plate number', 20)],
    )
    await audit(db, { user_id: req.user.user_id, action: 'create_rider', target_entity: 'users', target_id: rows[0].user_id, new_value: rows[0] })
    return rows[0]
  })
  res.status(201).json({ user })
})

// PUT /api/staff/users/:id/status  { account_status, reason } -> { ok } (setAccountStatus)
// active = approve an application or reactivate; suspended = locked out; inactive = not approved.
// The reason is saved in audit_logs. A rider who is no longer active goes offline (can't get dispatches).
router.put('/:id/status', async (req, res) => {
  const userId = toId(req.params.id, 'user id')
  const status = req.body?.account_status
  if (!ACCOUNT_STATUSES.includes(status)) throw badRequest('invalid_status', 'Choose active, inactive or suspended')
  const reason = optionalText(req.body?.reason, 'Reason', 500)

  await withTransaction(async (db) => {
    const { rows } = await db.query('SELECT user_id, role, account_status FROM users WHERE user_id = $1 FOR UPDATE', [userId])
    const target = rows[0]
    if (!target) throw notFound('not_found', 'User not found')
    // Checked first, so the reason is clear: nobody can approve, suspend or deactivate themselves.
    if (userId === req.user.user_id) throw forbidden('not_allowed', 'You cannot change your own account status')
    if (target.role === 'admin') throw forbidden('not_allowed', 'Admin accounts cannot be changed here')
    if (target.role === 'operator' && req.user.role !== 'admin') throw forbidden('not_allowed', 'Only the admin can change operator accounts')

    await db.query('UPDATE users SET account_status = $2, updated_at = now() WHERE user_id = $1', [userId, status])
    if (status !== 'active' && target.role === 'rider') {
      await db.query("UPDATE rider_profiles SET availability_status = 'offline' WHERE user_id = $1", [userId])
    }
    await audit(db, {
      user_id: req.user.user_id,
      action: `set_account_${status}`,
      target_entity: 'users',
      target_id: userId,
      old_value: { account_status: target.account_status },
      new_value: { account_status: status, reason },
    })
  })
  res.json({ ok: true })
})

// GET /api/staff/users/:id/latest-change -> the latest audit_logs row about this user, or null (getLatestAccountChange)
// Used to show why an account was suspended.
router.get('/:id/latest-change', async (req, res) => {
  const { rows } = await query(
    "SELECT * FROM audit_logs WHERE target_entity = 'users' AND target_id = $1 ORDER BY created_at DESC, audit_id DESC LIMIT 1",
    [toId(req.params.id, 'user id')],
  )
  res.json(rows[0] || null)
})

export default router
