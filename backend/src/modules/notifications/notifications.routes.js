import { Router } from 'express'
import { query } from '../../db.js'
import { requireAuth } from '../../middleware/auth.js'
import { badRequest, notFound } from '../../middleware/errors.js'
import { toId } from '../../utils/validate.js'

// My notifications: list, count unread, mark as read. Mounted at /api/notifications.
// The rows are created by utils/notify.js when an order changes or a rider is assigned.
// Any logged-in role may use these routes, but only for their own notifications: the user id always comes
// from the login token, and someone else's notification answers 404 (as if it did not exist).

const router = Router()
router.use(requireAuth)

// Old notifications are rarely read, so only the newest ones are sent.
const LIST_LIMIT = 50

// GET /api/notifications?unread=true -> my newest notifications (at most 50), newest first
//   each: { notification_id, order_id, order_number, type, message, is_read, created_at, read_at }
// LEFT JOIN because a notification may have no order (order_id is optional).
router.get('/', async (req, res) => {
  const { unread } = req.query
  if (unread !== undefined && unread !== 'true' && unread !== 'false') throw badRequest('invalid', 'unread must be true or false')
  const { rows } = await query(
    `SELECT n.notification_id, n.order_id, o.order_number, n.type, n.message, n.is_read, n.created_at, n.read_at
       FROM notifications n
       LEFT JOIN customer_orders o ON o.order_id = n.order_id
      WHERE n.user_id = $1 AND ($2 = false OR n.is_read = false)
      ORDER BY n.created_at DESC, n.notification_id DESC
      LIMIT $3`,
    [req.user.user_id, unread === 'true', LIST_LIMIT],
  )
  res.json(rows)
})

// GET /api/notifications/unread-count -> { count }
// Counted when read, never stored, so it can't disagree with the list. It counts all unread ones, not only the newest 50.
router.get('/unread-count', async (req, res) => {
  const { rows } = await query('SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND NOT is_read', [
    req.user.user_id,
  ])
  res.json({ count: rows[0].count })
})

// PUT /api/notifications/read-all -> { ok, updated } (how many were still unread)
router.put('/read-all', async (req, res) => {
  const { rowCount } = await query('UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND NOT is_read', [
    req.user.user_id,
  ])
  res.json({ ok: true, updated: rowCount })
})

// PUT /api/notifications/:id/read -> { ok }
// Safe to repeat: COALESCE keeps the time it was FIRST read.
router.put('/:id/read', async (req, res) => {
  const { rowCount } = await query(
    'UPDATE notifications SET is_read = true, read_at = COALESCE(read_at, now()) WHERE notification_id = $1 AND user_id = $2',
    [toId(req.params.id, 'notification id'), req.user.user_id],
  )
  if (rowCount === 0) throw notFound('not_found', 'Notification not found')
  res.json({ ok: true })
})

export default router
