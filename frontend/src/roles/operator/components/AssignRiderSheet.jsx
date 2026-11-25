import { useState } from 'react'
import { AlertTriangle, Bike, Send, Star } from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import { assignRider } from '@api'
import { errorText } from '@shared/utils/errors'
import { averageRating, orderExtraStoreFees, orderItemsSubtotal, orderTotal, pettyCashOnHand } from '@shared/utils/calc'
import { formatMoney } from '@shared/utils/format'

// Dialog to assign (or reassign) a rider to an order. Riders on an open shift who are Available can be
// picked; busy and offline riders are shown greyed out. The rider then accepts or rejects in the rider app.
//   entry:  the order (getLiveOrders / getOrderForStaff shape), or null when closed
//   riders: getRidersOverview()
export default function AssignRiderSheet({ entry, riders, onClose, onAssigned }) {
  const [riderId, setRiderId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!entry) return null

  const total = orderTotal(orderItemsSubtotal(entry.stores.flatMap((s) => s.items)), entry.order.base_delivery_fee, orderExtraStoreFees(entry.stores))
  const isCod = entry.payment?.payment_method === 'cod'
  const currentRiderId = entry.currentAssignment?.rider_id

  // Riders on shift first (available, then busy), then offline/off-shift
  const rank = (r) => (!r.openShift || r.user.account_status !== 'active' ? 3 : r.profile.availability_status === 'available' ? 0 : r.profile.availability_status === 'busy' ? 1 : 2)
  const sorted = riders.filter((r) => r.user.account_status === 'active').sort((a, b) => rank(a) - rank(b))
  const canPick = (r) => rank(r) === 0 && r.user.user_id !== currentRiderId

  async function handleAssign() {
    if (!riderId) {
      setError('Choose a rider first.')
      return
    }
    setSaving(true)
    const result = await assignRider(entry.order.order_id, riderId)
    setSaving(false)
    if (result.error) {
      setError(result.error === 'not_assignable' ? 'Confirm the order before assigning a rider.' : errorText(result, 'That rider is no longer available.'))
      return
    }
    onAssigned(sorted.find((r) => r.user.user_id === riderId).user.full_name)
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      icon={Bike}
      title={currentRiderId ? 'Reassign delivery rider' : 'Assign delivery rider'}
      description={`#${entry.order.order_number} · ${entry.customer.full_name} · ${entry.order.dropoff_barangay}`}
      wide
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-sonic-bg p-3 text-small">
          <span className="text-sonic-muted">
            Order total · {entry.stores.length} {entry.stores.length === 1 ? 'pickup' : 'pickups'}
          </span>
          <span className="font-display font-bold">
            {formatMoney(total)} {isCod && <span className="font-sans text-caption font-medium text-green-700">(COD)</span>}
          </span>
        </div>

        <div role="radiogroup" aria-label="Riders" className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {sorted.length === 0 && <p className="text-small text-sonic-muted">No riders yet.</p>}
          {sorted.map((r) => {
            const pickable = canPick(r)
            const rating = averageRating(r.reviews)
            const status = !r.openShift
              ? 'No open shift'
              : r.profile.availability_status === 'available'
                ? r.user.user_id === currentRiderId
                  ? 'Currently assigned'
                  : 'Available'
                : r.profile.availability_status === 'busy'
                  ? `Busy${r.jobs[0] ? ` · #${r.jobs[0].order_number}` : ''}`
                  : 'Offline'
            return (
              <label
                key={r.user.user_id}
                className={`flex items-center gap-3 rounded-xl p-3 transition ${
                  !pickable ? 'cursor-not-allowed bg-sonic-bg opacity-60' : riderId === r.user.user_id ? 'cursor-pointer bg-sonic-blue-50 ring-1 ring-sonic-blue' : 'cursor-pointer bg-sonic-bg hover:bg-sonic-blue-50/60'
                }`}
              >
                <input
                  type="radio"
                  name="rider"
                  disabled={!pickable}
                  checked={riderId === r.user.user_id}
                  onChange={() => {
                    setRiderId(r.user.user_id)
                    setError('')
                  }}
                  className="size-4 shrink-0 accent-sonic-blue"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-small font-semibold">{r.user.full_name}</span>
                    {rating !== null && (
                      <span className="flex items-center gap-0.5 text-caption text-sonic-muted">
                        <Star className="size-3 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
                        {rating.toFixed(1)}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-caption text-sonic-muted">
                    {r.profile.vehicle_type}
                    {r.profile.plate_number && ` · ${r.profile.plate_number}`}
                    {r.openShift && ` · Petty cash ${formatMoney(pettyCashOnHand(r.pettyCash))}`}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
                    status === 'Available' ? 'bg-green-600/10 text-green-700' : status.startsWith('Busy') ? 'bg-amber-500/15 text-amber-700' : 'bg-sonic-bg text-sonic-muted'
                  }`}
                >
                  {status}
                </span>
              </label>
            )
          })}
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button fullWidth disabled={saving} onClick={handleAssign}>
            <Send className="size-4" aria-hidden="true" />
            {saving ? 'Sending…' : 'Send to rider'}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
        <p className="text-center text-caption text-sonic-muted">The rider accepts or rejects it in the rider app.</p>
      </div>
    </BottomSheet>
  )
}
