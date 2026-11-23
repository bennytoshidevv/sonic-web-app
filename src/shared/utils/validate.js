// Small form validation helpers shared by the auth forms.

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// Philippine mobile number typed after the +63 prefix: 10 digits starting with 9 (e.g. 9171234567).
export function isValidPhMobile(digits) {
  return /^9\d{9}$/.test(digits)
}

// Gas allowance tiers must be contiguous: sorted by the lowest fee, each tier starts exactly ₱1.00 after
// the previous one ends, only the last tier may have no upper limit, and amounts can't be negative.
// Returns a message to show, or null when the tiers are fine.
export function tierRangeProblem(tiers) {
  if (tiers.length === 0) return 'Add at least one tier.'
  const sorted = [...tiers].sort((a, b) => a.min_delivery_fee - b.min_delivery_fee)
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    const last = i === sorted.length - 1
    if (!(t.min_delivery_fee >= 0) || !(t.allowance_amount >= 0)) return 'Fees and allowances must be ₱0.00 or more.'
    if (t.max_delivery_fee === null && !last) return 'Only the highest tier can have no upper limit.'
    if (t.max_delivery_fee !== null && t.max_delivery_fee < t.min_delivery_fee) return 'A tier ends before it starts.'
    if (!last && sorted[i + 1].min_delivery_fee !== t.max_delivery_fee + 1) {
      return `Tiers must connect: after ₱${t.max_delivery_fee}, the next tier should start at ₱${t.max_delivery_fee + 1}.`
    }
  }
  return null
}
