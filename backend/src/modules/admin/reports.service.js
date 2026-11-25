import { query } from '../../db.js'

// Report totals for a date range, computed in SQL (module 8).
// Same rules as the admin Reports page (frontend/src/roles/admin/pages/Reports.jsx):
//   - an order belongs to the day it was PLACED (Philippine date; every connection uses Asia/Manila)
//   - sales, items, rider pay and payments count DELIVERED orders only
//   - orders per restaurant counts every order that was not cancelled (one "pickup" per store)
//   - order total = items subtotal + barangay fee + extra-store fees (calc.js orderTotal)
//   - rider pay = allowance + round(share% × (fee − allowance), 2) + extra-store fees (calc.js deliveryGross)
// Nothing here is stored: it is calculated on every request from the order snapshots.

// Orders placed in the range, each with its items subtotal and extra-store fees ($1 = from, $2 = to).
const ORDERS_IN_RANGE = `
  WITH o AS (
    SELECT co.*,
           (SELECT COALESCE(sum(oi.quantity * oi.unit_price), 0) FROM order_items oi WHERE oi.order_id = co.order_id) AS items_total,
           (SELECT COALESCE(sum(orr.extra_store_fee), 0) FROM order_restaurants orr WHERE orr.order_id = co.order_id) AS extra_fees
      FROM customer_orders co
     WHERE co.placed_at::date BETWEEN $1::date AND $2::date
  )`

export async function getReportSummary(from, to) {
  const params = [from, to]
  const [totals, perRestaurant, topItems, riders, payments, sonicIncome] = await Promise.all([
    // KPI tiles
    query(
      `${ORDERS_IN_RANGE}
       SELECT count(*)::int AS orders,
              (count(*) FILTER (WHERE order_status = 'delivered'))::int AS delivered,
              (count(*) FILTER (WHERE order_status = 'cancelled'))::int AS cancelled,
              COALESCE(sum(items_total + base_delivery_fee + extra_fees) FILTER (WHERE order_status = 'delivered'), 0) AS sales,
              COALESCE(sum(base_delivery_fee + extra_fees) FILTER (WHERE order_status = 'delivered'), 0) AS delivery_fees
         FROM o`,
      params,
    ),
    // Orders per restaurant (not cancelled), most first
    query(
      `${ORDERS_IN_RANGE}
       SELECT r.restaurant_id, r.name, count(*)::int AS orders
         FROM o
         JOIN order_restaurants orr ON orr.order_id = o.order_id
         JOIN restaurants r ON r.restaurant_id = orr.restaurant_id
        WHERE o.order_status <> 'cancelled'
        GROUP BY r.restaurant_id, r.name
        ORDER BY orders DESC, r.name`,
      params,
    ),
    // Top 8 items by sales (delivered orders), using the frozen name and price of each order
    query(
      `${ORDERS_IN_RANGE}
       SELECT oi.item_id, max(oi.item_name) AS name, max(r.name) AS restaurant,
              sum(oi.quantity)::int AS quantity, sum(oi.quantity * oi.unit_price) AS sales
         FROM o
         JOIN order_items oi ON oi.order_id = o.order_id
         JOIN menu_items mi ON mi.item_id = oi.item_id
         JOIN menu_categories mc ON mc.menu_category_id = mi.menu_category_id
         JOIN restaurants r ON r.restaurant_id = mc.restaurant_id
        WHERE o.order_status = 'delivered'
        GROUP BY oi.item_id
        ORDER BY sales DESC, quantity DESC, name
        LIMIT 8`,
      params,
    ),
    // Rider performance: deliveries completed in the range, gross pay, average minutes from order placed to
    // delivered, and the all-time average rating. Inactive (not yet approved) riders are left out.
    query(
      `${ORDERS_IN_RANGE}
       SELECT u.user_id, u.full_name, u.account_status,
              count(run.order_id)::int AS delivered,
              COALESCE(sum(run.gross), 0) AS gross_pay,
              round(avg(run.minutes)) AS avg_minutes,
              (SELECT round(avg(rv.rating), 1) FROM rider_reviews rv
                 JOIN deliveries d2 ON d2.order_id = rv.order_id
                 JOIN delivery_assignments a2 ON a2.delivery_id = d2.delivery_id
                WHERE a2.rider_id = u.user_id AND a2.end_reason = 'completed') AS rating
         FROM users u
         LEFT JOIN LATERAL (
           SELECT o.order_id,
                  e.gas_allowance_amount
                    + round(e.rider_share_pct / 100 * (o.base_delivery_fee - e.gas_allowance_amount), 2)
                    + o.extra_fees AS gross,
                  extract(epoch FROM d.delivered_at - o.placed_at) / 60 AS minutes
             FROM o
             JOIN deliveries d ON d.order_id = o.order_id
             JOIN delivery_earnings e ON e.delivery_id = d.delivery_id
             JOIN delivery_assignments a ON a.delivery_id = d.delivery_id AND a.end_reason = 'completed'
            WHERE o.order_status = 'delivered' AND a.rider_id = u.user_id
         ) run ON true
        WHERE u.role = 'rider' AND u.account_status <> 'inactive'
        GROUP BY u.user_id
        ORDER BY delivered DESC, u.user_id`,
      params,
    ),
    // Payment methods (delivered orders), every method listed even with 0 orders
    query(
      `${ORDERS_IN_RANGE},
       delivered AS (
         SELECT o.*, (SELECT p.payment_method FROM payments p WHERE p.order_id = o.order_id
                       ORDER BY p.payment_id DESC LIMIT 1) AS method
           FROM o WHERE o.order_status = 'delivered'
       )
       SELECT m.method AS payment_method,
              count(dl.order_id)::int AS orders,
              COALESCE(sum(dl.items_total + dl.base_delivery_fee + dl.extra_fees), 0) AS amount
         FROM unnest(enum_range(NULL::payment_method)) AS m(method)
         LEFT JOIN delivered dl ON dl.method = m.method
        GROUP BY m.method
        ORDER BY amount DESC, m.method`,
      params,
    ),
    // Sonic income = Sonic's share of each delivered fee (fee − allowance − rider share)
    //              + operator fees and box rent charged in the range (rider savings belong to the rider)
    query(
      `${ORDERS_IN_RANGE}
       SELECT
         (SELECT COALESCE(sum(o.base_delivery_fee - e.gas_allowance_amount
                              - round(e.rider_share_pct / 100 * (o.base_delivery_fee - e.gas_allowance_amount), 2)), 0)
            FROM o JOIN deliveries d ON d.order_id = o.order_id JOIN delivery_earnings e ON e.delivery_id = d.delivery_id
           WHERE o.order_status = 'delivered') AS fee_share,
         (SELECT COALESCE(sum(ad.amount), 0)
            FROM applied_deductions ad JOIN deduction_types dt ON dt.deduction_type_id = ad.deduction_type_id
           WHERE NOT dt.is_rider_savings AND ad.applied_at::date BETWEEN $1::date AND $2::date) AS rider_fees`,
      params,
    ),
  ])
  const income = sonicIncome.rows[0]
  return {
    from,
    to,
    totals: { ...totals.rows[0], sonic_income: Math.round((income.fee_share + income.rider_fees) * 100) / 100, ...income },
    perRestaurant: perRestaurant.rows,
    topItems: topItems.rows,
    riders: riders.rows,
    payments: payments.rows,
  }
}
