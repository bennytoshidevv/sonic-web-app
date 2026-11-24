// In-app notifications (the notifications table). There is no notifications page yet (team decision),
// but saving them now means a page can be added later without touching the order logic.
// Pass the transaction client, so the notification is saved (or rolled back) together with the change.

// Same wording as ORDER_STATUS_MESSAGES in frontend/src/shared/utils/labels.js.
const ORDER_STATUS_MESSAGES = {
  pending: 'Waiting for the store to confirm your order.',
  confirmed: 'The store confirmed your order.',
  preparing: 'The store is preparing your food.',
  ready_for_pickup: 'Your food is ready. Waiting for the rider to pick it up.',
  picked_up: 'Your rider picked up your order.',
  on_the_way: 'Your rider is on the way to you.',
  delivered: 'Your order was delivered.',
  cancelled: 'This order was cancelled.',
}

export async function notify(db, { user_id, order_id = null, type, message }) {
  await db.query('INSERT INTO notifications (user_id, order_id, type, message) VALUES ($1, $2, $3, $4)', [
    user_id,
    order_id,
    type,
    message,
  ])
}

// Tells the customer that their order changed status, e.g. "SSD-20261125-1014: The store confirmed your order."
export function notifyOrderStatus(db, order, status) {
  return notify(db, {
    user_id: order.customer_id,
    order_id: order.order_id,
    type: 'order_status',
    message: `${order.order_number}: ${ORDER_STATUS_MESSAGES[status]}`,
  })
}
