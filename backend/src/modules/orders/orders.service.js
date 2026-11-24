import { query, withTransaction } from '../../db.js'
import { badRequest, conflict } from '../../middleware/errors.js'
import { orderTotal } from '../../utils/calc.js'

// Order logic shared by the customer, operator and rider routes.

// ---------- Reading orders ----------

// One JSON object per order, shaped like the mock's getOrderDetails():
//   { order, stores, history, payment, rider }
//   stores  = order_restaurants (primary first) + restaurant name + that store's order_items
//   history = order_status_history, oldest first
//   payment = the latest payments row
//   rider   = the current rider who accepted, else the rider who completed it, else null
// These are SQL expressions used as `SELECT ${ORDER_DETAILS} FROM customer_orders o`.
// Everything is built inside one SQL query with jsonb sub-queries, so a list of 20 orders is
// still one trip to the database.

// The order's stores. Staff also see each store's address and phone number (where the rider buys the food).
function storesSql(forStaff) {
  return `COALESCE((
      SELECT jsonb_agg(to_jsonb(orr) || jsonb_build_object(
               'name', r.name,
               ${forStaff ? "'address', r.address, 'contact_number', r.contact_number," : ''}
               'items', COALESCE((
                 SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.order_item_id)
                   FROM order_items oi
                   JOIN menu_items mi ON mi.item_id = oi.item_id
                   JOIN menu_categories mc ON mc.menu_category_id = mi.menu_category_id
                  WHERE oi.order_id = o.order_id AND mc.restaurant_id = orr.restaurant_id), '[]'))
             ORDER BY orr.is_primary DESC, orr.restaurant_id)
        FROM order_restaurants orr
        JOIN restaurants r ON r.restaurant_id = orr.restaurant_id
       WHERE orr.order_id = o.order_id), '[]')`
}

// The status history, oldest first. Staff also see who made each change ('System' = no user, e.g. a payment webhook).
function historySql(forStaff) {
  return `COALESCE((
      SELECT jsonb_agg(to_jsonb(h)${forStaff ? " || jsonb_build_object('changed_by_name', COALESCE(hu.full_name, 'System'))" : ''}
                       ORDER BY h.changed_at, h.history_id)
        FROM order_status_history h
        LEFT JOIN users hu ON hu.user_id = h.changed_by
       WHERE h.order_id = o.order_id), '[]')`
}

function orderDetailsSql(forStaff) {
  return `
  jsonb_build_object(
    'order', to_jsonb(o),
    'stores', ${storesSql(forStaff)},
    'history', ${historySql(forStaff)},
    'payment', (
      SELECT to_jsonb(p) FROM payments p
       WHERE p.order_id = o.order_id
       ORDER BY p.payment_id DESC LIMIT 1),
    'rider', (
      SELECT jsonb_build_object('user_id', u.user_id, 'full_name', u.full_name, 'contact_number', u.contact_number,
                                'vehicle_type', rp.vehicle_type, 'plate_number', rp.plate_number)
        FROM deliveries d
        JOIN delivery_assignments a ON a.delivery_id = d.delivery_id
        JOIN users u ON u.user_id = a.rider_id
        JOIN rider_profiles rp ON rp.user_id = a.rider_id
       WHERE d.order_id = o.order_id
         AND ((a.ended_at IS NULL AND a.response_status = 'accepted') OR a.end_reason = 'completed')
       ORDER BY (a.ended_at IS NULL) DESC, a.assignment_id DESC
       LIMIT 1)
  )`
}

const ORDER_DETAILS = orderDetailsSql(false)

// What staff see (the mock's staffOrderView): the customer view plus store addresses, history with names,
// the customer (with their number of orders), the delivery, every rider assignment (with the rider's name)
// and the current assignment (the one not ended yet, or null).
const ASSIGNMENT_WITH_NAME = "to_jsonb(a) || jsonb_build_object('rider_name', au.full_name)"
const STAFF_ORDER_DETAILS = `${orderDetailsSql(true)} || jsonb_build_object(
    'customer', (
      SELECT jsonb_build_object('user_id', cu.user_id, 'full_name', cu.full_name, 'email', cu.email,
                                'contact_number', cu.contact_number,
                                'order_count', (SELECT count(*)::int FROM customer_orders co WHERE co.customer_id = cu.user_id))
        FROM users cu WHERE cu.user_id = o.customer_id),
    'delivery', (SELECT to_jsonb(d) FROM deliveries d WHERE d.order_id = o.order_id),
    'assignments', COALESCE((
      SELECT jsonb_agg(${ASSIGNMENT_WITH_NAME} ORDER BY a.assignment_id)
        FROM deliveries d
        JOIN delivery_assignments a ON a.delivery_id = d.delivery_id
        JOIN users au ON au.user_id = a.rider_id
       WHERE d.order_id = o.order_id), '[]'),
    'currentAssignment', (
      SELECT ${ASSIGNMENT_WITH_NAME}
        FROM deliveries d
        JOIN delivery_assignments a ON a.delivery_id = d.delivery_id
        JOIN users au ON au.user_id = a.rider_id
       WHERE d.order_id = o.order_id AND a.ended_at IS NULL)
  )`

// Every order for staff, newest first (getLiveOrders; the page filters by status).
export async function getStaffOrders() {
  const { rows } = await query(
    `SELECT ${STAFF_ORDER_DETAILS} AS details FROM customer_orders o ORDER BY o.placed_at DESC, o.order_id DESC`,
  )
  return rows.map((r) => r.details)
}

// One order for staff, or null (getOrderForStaff).
export async function getStaffOrder(orderId) {
  const { rows } = await query(`SELECT ${STAFF_ORDER_DETAILS} AS details FROM customer_orders o WHERE o.order_id = $1`, [orderId])
  return rows[0]?.details ?? null
}

// One order of one customer, or null (also null when it belongs to someone else).
export async function getOrderDetails(orderId, customerId) {
  const { rows } = await query(
    `SELECT ${ORDER_DETAILS} AS details FROM customer_orders o WHERE o.order_id = $1 AND o.customer_id = $2`,
    [orderId, customerId],
  )
  return rows[0]?.details ?? null
}

// All orders of a customer, newest first, each with its restaurant_reviews (getCustomerOrders).
export async function getCustomerOrders(customerId) {
  const { rows } = await query(
    `SELECT ${ORDER_DETAILS} || jsonb_build_object('reviews', COALESCE((
              SELECT jsonb_agg(to_jsonb(rr) ORDER BY rr.review_id)
                FROM restaurant_reviews rr WHERE rr.order_id = o.order_id), '[]')) AS details
       FROM customer_orders o
      WHERE o.customer_id = $1
      ORDER BY o.placed_at DESC, o.order_id DESC`,
    [customerId],
  )
  return rows.map((r) => r.details)
}

// ---------- Placing an order ----------

export const PAYMENT_METHODS = ['cod', 'gcash', 'maya', 'qr_ph', 'card']
const MAX_QUANTITY = 99

// Checks the cart lines sent by the browser: [{ item_id, quantity }].
// Only ids and quantities are trusted; names and prices are read from the database.
export function readLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('empty_cart', 'Your cart is empty')
  const seen = new Set()
  return lines.map((line) => {
    const itemId = Number(line?.item_id)
    const quantity = Number(line?.quantity)
    if (!Number.isInteger(itemId) || itemId <= 0) throw badRequest('invalid_id', 'Invalid item id')
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw badRequest('invalid_quantity', `Quantity must be 1 to ${MAX_QUANTITY}`)
    }
    if (seen.has(itemId)) throw badRequest('duplicate_item', 'Each item may appear only once')
    seen.add(itemId)
    return { item_id: itemId, quantity }
  })
}

// Places an order in ONE transaction (all rows are saved, or none):
//   customer_orders (with a copy of the address and the barangay fee), order_restaurants (first store =
//   primary, every other store pays the current extra-store fee), order_items (frozen name and price),
//   the first order_status_history row, and a pending payment.
// The store of the first cart line is the primary store (the cart lists stores in the order they were added).
// Returns the new customer_orders row, or throws 409 'unavailable' when an item can no longer be ordered.
export async function placeOrder({ customerId, addressId, lines, paymentMethod, orderNotes }) {
  return withTransaction(async (db) => {
    // 1. The delivery address must be one of the customer's own saved addresses.
    const { rows: addressRows } = await db.query(
      `SELECT a.street_address, a.landmark, b.barangay_name, b.city_municipality, b.delivery_fee, b.is_active AS barangay_active
         FROM customer_addresses a JOIN barangays b ON b.barangay_id = a.barangay_id
        WHERE a.address_id = $1 AND a.user_id = $2 AND a.is_active`,
      [addressId, customerId],
    )
    const address = addressRows[0]
    if (!address) throw badRequest('invalid_address', 'Choose one of your saved addresses')
    if (!address.barangay_active) throw badRequest('invalid_address', 'Sonic does not deliver to this barangay right now')

    // 2. Check every item again right now (the cart page may be old): it must exist, be active and not
    //    sold out, and its restaurant must be active and open. FOR SHARE keeps an operator from marking an
    //    item sold out halfway through this checkout.
    const { rows: items } = await db.query(
      `SELECT i.item_id, i.name, i.price, i.is_active, i.is_available, r.restaurant_id,
              r.is_active AS restaurant_active, r.open_status
         FROM menu_items i
         JOIN menu_categories c ON c.menu_category_id = i.menu_category_id
         JOIN restaurants r ON r.restaurant_id = c.restaurant_id
        WHERE i.item_id = ANY($1::int[])
          FOR SHARE OF i, r`,
      [lines.map((l) => l.item_id)],
    )
    const byId = new Map(items.map((i) => [i.item_id, i]))
    for (const line of lines) {
      const item = byId.get(line.item_id)
      if (!item || !item.is_active || !item.is_available || !item.restaurant_active || item.open_status !== 'open') {
        throw conflict('unavailable', 'Some items just became unavailable. Please check your cart.')
      }
    }

    // 3. Stores in cart order; the current rate gives the extra-store fee.
    const storeIds = [...new Set(lines.map((l) => byId.get(l.item_id).restaurant_id))]
    const { rows: rateRows } = await db.query(
      'SELECT extra_store_fee FROM rate_settings WHERE effective_from <= now() ORDER BY effective_from DESC, setting_id DESC LIMIT 1',
    )
    const extraStoreFee = rateRows[0].extra_store_fee

    // 4. Total = items subtotal + barangay fee + extra-store fees (same formula as the cart page).
    const subtotal = lines.reduce((sum, l) => sum + byId.get(l.item_id).price * l.quantity, 0)
    const total = orderTotal(subtotal, address.delivery_fee, extraStoreFee * (storeIds.length - 1))

    // 5. The order number uses the order id, so take the next id first: SSD-20261125-1014
    //    (the date is Philippine time, because every connection uses Asia/Manila).
    const { rows: idRows } = await db.query(
      "SELECT nextval(pg_get_serial_sequence('customer_orders', 'order_id')) AS id, to_char(now(), 'YYYYMMDD') AS day",
    )
    const orderId = Number(idRows[0].id)
    const orderNumber = `SSD-${idRows[0].day}-${orderId}`
    const { rows: orderRows } = await db.query(
      `INSERT INTO customer_orders (order_id, order_number, customer_id, base_delivery_fee, order_notes,
                                    dropoff_street, dropoff_barangay, dropoff_city, dropoff_landmark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orderId, orderNumber, customerId, address.delivery_fee, orderNotes, address.street_address, address.barangay_name,
        address.city_municipality, address.landmark],
    )

    for (const [index, restaurantId] of storeIds.entries()) {
      await db.query(
        'INSERT INTO order_restaurants (order_id, restaurant_id, is_primary, extra_store_fee) VALUES ($1, $2, $3, $4)',
        [orderId, restaurantId, index === 0, index === 0 ? 0 : extraStoreFee],
      )
    }
    for (const line of lines) {
      const item = byId.get(line.item_id)
      await db.query(
        'INSERT INTO order_items (order_id, item_id, quantity, unit_price, item_name) VALUES ($1, $2, $3, $4, $5)',
        [orderId, line.item_id, line.quantity, item.price, item.name],
      )
    }
    await db.query("INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1, 'pending', $2)", [
      orderId,
      customerId,
    ])
    // COD stays pending until the rider collects the cash; online methods stay pending until
    // PayMongo confirms the payment (module 10).
    await db.query('INSERT INTO payments (order_id, payment_method, amount) VALUES ($1, $2, $3)', [orderId, paymentMethod, total])

    return orderRows[0]
  })
}
