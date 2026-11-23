// Pill-shaped status badge for restaurant (open/closed) and order statuses (colors from DESIGN.md).
// variant 'solid': white text on color, for badges on top of photos (restaurant cards).
// variant 'soft':  light tint with a dot, for badges on white cards. Order statuses are always soft.
const STATUSES = {
  open: { label: 'Open', solid: 'bg-green-600 text-white', soft: 'bg-green-600/15 text-green-700', dot: 'bg-green-600' },
  closed: { label: 'Closed', solid: 'bg-red-600 text-white', soft: 'bg-red-600/15 text-red-700', dot: 'bg-red-600' },
  pending: { label: 'Pending', soft: 'bg-amber-500/15 text-amber-700', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', soft: 'bg-sonic-blue-50 text-sonic-blue', dot: 'bg-sonic-blue' },
  preparing: { label: 'Preparing', soft: 'bg-amber-500/15 text-amber-700', dot: 'bg-amber-500' },
  ready_for_pickup: { label: 'Ready for Pickup', soft: 'bg-sonic-sky/15 text-sky-700', dot: 'bg-sonic-sky' },
  picked_up: { label: 'Picked Up', soft: 'bg-sonic-violet/10 text-sonic-violet', dot: 'bg-sonic-violet' },
  on_the_way: { label: 'On the Way', soft: 'bg-sonic-violet/10 text-sonic-violet', dot: 'bg-sonic-violet' },
  delivered: { label: 'Delivered', soft: 'bg-green-600/15 text-green-700', dot: 'bg-green-600' },
  cancelled: { label: 'Cancelled', soft: 'bg-red-600/15 text-red-700', dot: 'bg-red-600' },
}

export default function StatusBadge({ status, variant = 'solid' }) {
  const { label, solid, soft, dot } = STATUSES[status]

  if (variant === 'soft' || !solid) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-bold tracking-wider uppercase ${soft}`}>
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-caption font-bold tracking-wider uppercase shadow-card ${solid}`}>
      {label}
    </span>
  )
}
