// Display names for ERD enum values.

// payments.payment_method (cod is the default)
export const PAYMENT_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  gcash: 'GCash',
  maya: 'Maya',
  qr_ph: 'QR Ph',
  card: 'Credit/Debit card',
}

// customer_orders.order_status, in the order they happen (cancelled can happen while pending)
export const ORDER_STEPS = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered']

export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  on_the_way: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

// One short sentence about what is happening now (there is no ETA in the ERD)
export const ORDER_STATUS_MESSAGES = {
  pending: 'Waiting for the store to confirm your order.',
  confirmed: 'The store confirmed your order.',
  preparing: 'The store is preparing your food.',
  ready_for_pickup: 'Your food is ready. Waiting for the rider to pick it up.',
  picked_up: 'Your rider picked up your order.',
  on_the_way: 'Your rider is on the way to you.',
  delivered: 'Your order was delivered.',
  cancelled: 'This order was cancelled.',
}

// The rider's one main action for each order status (DESIGN.md: "Picked Up", "On the Way", "Delivered")
export const RIDER_NEXT_ACTION = {
  ready_for_pickup: { label: 'Picked up', done: 'Marked as picked up' },
  picked_up: { label: 'On the way', done: 'Marked as on the way' },
  on_the_way: { label: 'Delivered', done: 'Delivered! Earning added to your shift' },
}
