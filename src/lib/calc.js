// Calculated values. These are never stored in mock data.

// Average of restaurant_reviews.rating, rounded to 1 decimal. null when there are no reviews.
export function averageRating(reviews) {
  if (reviews.length === 0) return null
  const total = reviews.reduce((sum, r) => sum + r.rating, 0)
  return Math.round((total / reviews.length) * 10) / 10
}

// Total number of items in the cart (sum of quantities).
export function cartItemCount(lines) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

// One cart line: price × quantity.
export function lineTotal(line) {
  return line.price * line.quantity
}

// Items subtotal: all line totals added up.
export function cartSubtotal(lines) {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0)
}

// The first store is the main store; every other store adds the extra-store fee (rate_settings).
export function extraStoreFees(storeCount, feePerExtraStore) {
  return Math.max(storeCount - 1, 0) * feePerExtraStore
}

// Order total = items subtotal + barangay delivery fee + extra-store fees.
export function orderTotal(subtotal, deliveryFee, extraFees) {
  return subtotal + deliveryFee + extraFees
}

// Items subtotal of a placed order: unit_price (frozen at checkout) × quantity for each order_items row.
export function orderItemsSubtotal(items) {
  return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
}

// Extra-store fees of a placed order: the extra_store_fee snapshots in order_restaurants added up.
export function orderExtraStoreFees(orderRestaurants) {
  return orderRestaurants.reduce((sum, r) => sum + r.extra_store_fee, 0)
}

// Whole minutes between two timestamps (e.g. order placed → delivered).
export function minutesBetween(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 60000)
}

// Average of a list of numbers, or null for an empty list.
export function average(values) {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// ---------- Rider pay (CLAUDE.md) ----------

function roundMoney(amount) {
  return Math.round(amount * 100) / 100
}

// Gas allowance for a barangay delivery fee, from gas_allowance_tiers (0 below the lowest tier).
export function gasAllowanceFor(deliveryFee, tiers) {
  const tier = tiers.find(
    (t) => t.is_active && deliveryFee >= t.min_delivery_fee && (t.max_delivery_fee === null || deliveryFee <= t.max_delivery_fee),
  )
  return tier ? tier.allowance_amount : 0
}

// Rider share = rider_share_pct of (barangay fee − gas allowance). Example: 70% of (250 − 50) = 140.
export function riderShare(deliveryFee, gasAllowance, riderSharePct) {
  return roundMoney((riderSharePct / 100) * (deliveryFee - gasAllowance))
}

// Gross pay for one delivery = gas allowance + rider share + all extra-store fees.
// Example: fee 250 → 50 + 140 = 190 (+10 per extra store).
export function deliveryGross(deliveryFee, gasAllowance, riderSharePct, extraStoreFees) {
  return roundMoney(gasAllowance + riderShare(deliveryFee, gasAllowance, riderSharePct) + extraStoreFees)
}

// Sum of the `amount` of each row (e.g. applied_deductions).
export function sumAmounts(rows) {
  return roundMoney(rows.reduce((sum, row) => sum + row.amount, 0))
}

// Petty cash on hand = issued + GCash top-ups − purchases − cash returned + adjustments.
export function pettyCashOnHand(transactions) {
  const sign = { cash_issued: 1, gcash_topup: 1, purchase: -1, cash_returned: -1, adjustment: 1 }
  return roundMoney(transactions.reduce((sum, t) => sum + sign[t.txn_type] * t.amount, 0))
}

// Change to give back for a COD payment (0 if the cash handed over is not enough).
export function changeDue(cashTendered, total) {
  return Math.max(roundMoney(cashTendered - total), 0)
}

// Quick cash amounts for the COD change calculator: exact, the next ₱100, ₱500 and ₱1,000 (only those ≥ total).
export function cashOptions(total) {
  const options = [total, Math.ceil(total / 100) * 100, 500, 1000].filter((amount) => amount >= total)
  return [...new Set(options)]
}

// Petty cash ledger totals by type: { issued, topups, purchases, returned, adjustments }.
export function pettyCashBreakdown(transactions) {
  const total = (type) => sumAmounts(transactions.filter((t) => t.txn_type === type))
  return {
    issued: total('cash_issued'),
    topups: total('gcash_topup'),
    purchases: total('purchase'),
    returned: total('cash_returned'),
    adjustments: total('adjustment'),
  }
}

// Savings balance = deposits − withdrawals (rider_savings_entries).
export function savingsBalance(entries) {
  return roundMoney(entries.reduce((sum, e) => sum + (e.entry_type === 'deposit' ? e.amount : -e.amount), 0))
}

// End-of-shift settlement: the rider keeps their net pay out of the COD cash and hands over the rest.
// If the net pay is more than the COD collected, Sonic pays the rider the difference.
export function settlementAmounts(codCollected, netPay) {
  return {
    toRemit: roundMoney(Math.max(codCollected - netPay, 0)),
    toPayRider: roundMoney(Math.max(netPay - codCollected, 0)),
  }
}
