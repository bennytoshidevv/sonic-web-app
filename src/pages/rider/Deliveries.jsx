import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  Bike,
  Check,
  Clock,
  Flag,
  Info,
  MapPin,
  Navigation,
  Phone,
  StickyNote,
  Store,
  User,
  X,
  Zap,
} from 'lucide-react'
import BottomSheet from '../../components/BottomSheet'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import Toast from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import { acceptAssignment, advanceDelivery, getRiderDeliveries, rejectAssignment } from '../../data/mock'
import {
  deliveryGross,
  gasAllowanceFor,
  minutesBetween,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
} from '../../lib/calc'
import { formatMoney, formatTimestampTime } from '../../lib/format'
import { RIDER_NEXT_ACTION } from '../../lib/labels'

const PROGRESS = ['picked_up', 'on_the_way', 'delivered']
const PROGRESS_LABELS = { picked_up: 'Picked up', on_the_way: 'On the way', delivered: 'Delivered' }

function totalOf(entry) {
  return orderTotal(orderItemsSubtotal(entry.stores.flatMap((s) => s.items)), entry.order.base_delivery_fee, orderExtraStoreFees(entry.stores))
}

function codToCollect(entry) {
  return entry.payment?.payment_method === 'cod' && entry.payment.payment_status === 'pending' ? totalOf(entry) : 0
}

// Pickups (one per store) then the drop-off
function RouteSteps({ entry }) {
  return (
    <ol className="flex flex-col">
      {entry.stores.map((store, index) => (
        <li key={store.restaurant_id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
              <Store className="size-4" aria-hidden="true" />
            </span>
            <span className="my-1 w-0.5 flex-1 bg-sonic-sky" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 pb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-display text-small font-semibold">
                {index + 1}. {store.name}
              </p>
              <span className="shrink-0 rounded-full bg-sonic-bg px-2 py-0.5 text-caption text-sonic-muted">Pickup</span>
            </div>
            <p className="text-small text-sonic-muted">{store.address}</p>
            <p className="text-caption text-sonic-muted">{store.items.map((i) => `${i.item_name} ×${i.quantity}`).join(', ')}</p>
          </div>
        </li>
      ))}
      <li className="flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonic-violet/10 text-sonic-violet">
          <MapPin className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-small font-semibold">Drop-off</p>
            <span className="shrink-0 rounded-full bg-sonic-violet/10 px-2 py-0.5 text-caption text-sonic-violet">Customer</span>
          </div>
          <p className="text-small text-sonic-ink">
            {entry.order.dropoff_street}, {entry.order.dropoff_barangay}, {entry.order.dropoff_city}
          </p>
          {entry.order.dropoff_landmark && (
            <p className="mt-0.5 flex items-center gap-1 text-caption text-sonic-muted">
              <Flag className="size-3.5 shrink-0" aria-hidden="true" />
              Landmark: {entry.order.dropoff_landmark}
            </p>
          )}
        </div>
      </li>
    </ol>
  )
}

function CodStrip({ amount }) {
  return amount > 0 ? (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-green-600/10 p-3">
      <span className="flex items-center gap-2">
        <Banknote className="size-5 shrink-0 text-green-700" aria-hidden="true" />
        <span>
          <span className="block font-display text-small font-semibold text-green-700">Collect COD payment</span>
          <span className="block text-caption text-sonic-muted">Cash from the customer</span>
        </span>
      </span>
      <span className="font-display text-h3 font-bold text-green-700">{formatMoney(amount)}</span>
    </div>
  ) : (
    <p className="flex items-center gap-2 rounded-lg bg-sonic-bg p-3 text-small text-sonic-muted">
      <Check className="size-4 shrink-0 text-green-600" aria-hidden="true" />
      Paid online. Nothing to collect.
    </p>
  )
}

// New dispatch: earning preview, route, COD, Accept / Reject
function NewDispatchCard({ entry, earning, now, onAccept, onReject, disabled }) {
  const minutes = minutesBetween(entry.assignment.assigned_at, now)
  return (
    <article className="flex flex-col gap-4 overflow-hidden rounded-xl bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 bg-sonic-bolt/20 px-4 py-2.5">
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-sonic-bolt">
            <Zap className="size-4 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
          </span>
          <span className="font-display text-small font-semibold text-sonic-ink">New dispatch</span>
        </span>
        <span className="flex items-center gap-1 text-caption text-sonic-ink">
          <Clock className="size-3.5" aria-hidden="true" />
          Assigned {formatTimestampTime(entry.assignment.assigned_at)} · {minutes < 1 ? 'just now' : `${minutes} min ago`}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 md:px-5 md:pb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-caption tracking-wider text-sonic-muted uppercase">{entry.stores.length > 1 ? 'Multi-store order' : 'Order'}</p>
            <p className="truncate font-display text-small font-bold">{entry.order.order_number}</p>
          </div>
          <StatusBadge status={entry.order.order_status} />
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-sonic-blue-50 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue text-white">
            <Banknote className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-caption text-sonic-blue">Your earning</span>
            <span className="block font-display text-h2 font-extrabold text-sonic-blue">{formatMoney(earning)}</span>
          </span>
        </div>

        <RouteSteps entry={entry} />
        <CodStrip amount={codToCollect(entry)} />

        <div className="grid grid-cols-2 gap-3">
          <Button variant="danger-outline" fullWidth onClick={onReject} disabled={disabled}>
            <X className="size-5" aria-hidden="true" />
            Reject
          </Button>
          <Button fullWidth onClick={onAccept} disabled={disabled}>
            Accept
            <Zap className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  )
}

// Accepted delivery: customer, progress, next stop and the one main action
function ActiveDeliveryCard({ entry, onAdvance, busy }) {
  const status = entry.order.order_status
  const action = RIDER_NEXT_ACTION[status]
  const reached = PROGRESS.indexOf(status)
  const nextStop = ['picked_up', 'on_the_way'].includes(status) ? 'Drop-off' : 'Pickup'

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <StatusBadge status={status} />
          <p className="mt-1 truncate font-display text-small font-bold">#{entry.order.order_number}</p>
          <Link to={`/rider/deliveries/${entry.order.order_id}`} className="text-small font-semibold text-sonic-blue hover:underline">
            View full details
          </Link>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-sonic-blue-50 px-2.5 py-1 text-caption font-semibold text-sonic-blue">
          <span className="size-1.5 animate-pulse rounded-full bg-sonic-blue" aria-hidden="true" />
          In progress
        </span>
      </div>

      {/* Customer */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-sonic-bg p-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sonic-blue shadow-card">
            <User className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-small font-semibold">{entry.customer.full_name}</span>
            <span className="block text-caption text-sonic-muted">Customer</span>
          </span>
        </span>
        <a
          href={`tel:${entry.customer.contact_number}`}
          aria-label={`Call ${entry.customer.full_name}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sonic-blue text-white shadow-card transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue"
        >
          <Phone className="size-5 fill-white" aria-hidden="true" />
        </a>
      </div>

      {/* Progress: Picked up → On the way → Delivered */}
      <ol className="flex items-center gap-1" aria-label="Delivery progress">
        {PROGRESS.map((step, index) => {
          const done = index <= reached
          return (
            <li key={step} className="flex flex-1 flex-col gap-1">
              <span className={`h-1.5 rounded-full ${done ? 'bg-sonic-blue' : 'bg-sonic-border'}`} aria-hidden="true" />
              <span className={`text-caption ${done ? 'font-semibold text-sonic-blue' : 'text-sonic-muted'}`}>
                {PROGRESS_LABELS[step]}
                <span className="sr-only">{done ? ' (done)' : ' (not yet)'}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {/* Next stop */}
      <div className="flex items-start gap-3 rounded-lg bg-sonic-violet/5 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sonic-violet text-white">
          <Navigation className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-caption tracking-wider text-sonic-muted uppercase">Next stop · {nextStop}</p>
          {nextStop === 'Drop-off' ? (
            <>
              <p className="font-display text-small font-semibold">
                {entry.order.dropoff_street}, {entry.order.dropoff_barangay}, {entry.order.dropoff_city}
              </p>
              {entry.order.dropoff_landmark && <p className="text-caption text-sonic-muted">Landmark: {entry.order.dropoff_landmark}</p>}
            </>
          ) : (
            entry.stores.map((s) => (
              <p key={s.restaurant_id} className="text-small">
                <span className="font-display font-semibold">{s.name}</span>
                <span className="text-sonic-muted"> · {s.address}</span>
              </p>
            ))
          )}
        </div>
      </div>

      {entry.order.order_notes && (
        <p className="flex items-start gap-2 rounded-lg bg-sonic-bg p-3 text-small">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-sonic-muted" aria-hidden="true" />“{entry.order.order_notes}”
        </p>
      )}

      <CodStrip amount={codToCollect(entry)} />

      {action ? (
        <Button size="lg" fullWidth onClick={() => onAdvance(entry)} disabled={busy}>
          {status === 'on_the_way' ? <Check className="size-5" aria-hidden="true" /> : <Bike className="size-5" aria-hidden="true" />}
          {action.label}
        </Button>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-small text-amber-700">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          Waiting for the store. You can pick up once the order is ready for pickup.
        </p>
      )}
    </article>
  )
}

export default function Deliveries() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState(null) // 'new' | 'active' (null = pick automatically)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(null) // entry waiting for reject confirmation
  const [confirmingDelivered, setConfirmingDelivered] = useState(null) // entry waiting for "cash collected?"
  const [error, setError] = useState('')
  const [now] = useState(() => new Date().toISOString())
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getRiderDeliveries(user.user_id).then(setData)
  }, [user.user_id, refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (!data) return <p className="py-10 text-center text-sonic-muted">Loading your deliveries…</p>

  const { pending, active, shiftIsOpen, availability, tiers, rate } = data
  const currentTab = tab || (pending.length > 0 ? 'new' : 'active')
  const shown = currentTab === 'new' ? pending : active

  // Pay preview for a new dispatch (calc.js, same rules as the real earning)
  function earningFor(entry) {
    const fee = entry.order.base_delivery_fee
    return deliveryGross(fee, gasAllowanceFor(fee, tiers), rate.rider_share_pct, orderExtraStoreFees(entry.stores))
  }

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  async function handleAccept(entry) {
    setError('')
    setBusy(true)
    const result = await acceptAssignment(user.user_id, entry.assignment.assignment_id)
    setBusy(false)
    if (result.error === 'no_open_shift') {
      setError('Start your shift on the Dashboard before accepting deliveries.')
      return
    }
    showToast(`Accepted ${entry.order.order_number}`)
    setTab('active')
    reload()
  }

  async function confirmReject() {
    setBusy(true)
    await rejectAssignment(user.user_id, rejecting.assignment.assignment_id)
    setBusy(false)
    setRejecting(null)
    showToast('Rejected. The operator will assign another rider.')
    reload()
  }

  async function advance(entry) {
    setError('')
    setBusy(true)
    const result = await advanceDelivery(user.user_id, entry.order.order_id)
    setBusy(false)
    setConfirmingDelivered(null)
    if (result.error) {
      setError(result.error === 'no_open_shift' ? 'Your shift is closed. Start a shift to continue.' : 'This delivery cannot be updated right now.')
      reload()
      return
    }
    showToast(RIDER_NEXT_ACTION[entry.order.order_status].done)
    reload()
  }

  // "Delivered" asks first, so COD cash is only marked as collected on purpose
  function handleAdvance(entry) {
    if (entry.order.order_status === 'on_the_way') setConfirmingDelivered(entry)
    else advance(entry)
  }

  const tabs = [
    { key: 'new', label: 'New dispatches', count: pending.length },
    { key: 'active', label: 'In transit', count: active.length },
  ]

  return (
    <div>
      {/* Shift / availability strip */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-card">
        <span className="flex items-center gap-2 text-small">
          <span
            className={`size-2.5 rounded-full ${shiftIsOpen && availability !== 'offline' ? 'animate-pulse bg-green-600' : 'bg-sonic-border'}`}
            aria-hidden="true"
          />
          <span className="font-display font-semibold">{shiftIsOpen ? 'Shift open' : 'Shift closed'}</span>
          {shiftIsOpen && <span className="text-sonic-muted">· {availability.charAt(0).toUpperCase() + availability.slice(1)}</span>}
        </span>
        {!shiftIsOpen && (
          <Link to="/rider" className="font-display text-small font-semibold text-sonic-blue hover:underline">
            Go to Dashboard
          </Link>
        )}
      </div>

      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">My deliveries</h1>
          <p className="text-small text-sonic-muted">Assigned jobs and new dispatch requests</p>
        </div>
        <span className="shrink-0 rounded-full bg-sonic-blue-50 px-3 py-1 text-caption font-semibold text-sonic-blue">
          {pending.length + active.length} open
        </span>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Deliveries" className="flex rounded-full bg-white p-1 shadow-card md:max-w-md">
        {tabs.map(({ key, label, count }) => {
          const selected = currentTab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={selected}
              aria-controls="deliveries-panel"
              onClick={() => setTab(key)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full font-display text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-sonic-blue ${
                selected ? 'bg-sonic-blue text-white shadow-card' : 'text-sonic-muted hover:text-sonic-ink'
              }`}
            >
              {label}
              <span className={`min-w-5 rounded-full px-1.5 text-caption font-bold ${selected ? 'bg-sonic-bolt text-sonic-ink' : 'bg-sonic-bg text-sonic-muted'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-small text-red-700">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div id="deliveries-panel" role="tabpanel" aria-labelledby={`tab-${currentTab}`} className="mt-4">
        {shown.length === 0 ? (
          <div className="mx-auto max-w-xl">
            {currentTab === 'new' ? (
              <EmptyState
                title={shiftIsOpen ? 'No new deliveries. Stay available!' : 'Your shift is closed'}
                text={
                  shiftIsOpen
                    ? availability === 'available'
                      ? 'You are available. New dispatches from the operator will show up here.'
                      : 'Set yourself to Available on the Dashboard to get new dispatches.'
                    : 'Start your shift on the Dashboard to receive deliveries.'
                }
              />
            ) : (
              <EmptyState icon={Bike} title="Nothing in transit" text="Accepted deliveries show up here until they are delivered." />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {shown.map((entry) =>
              currentTab === 'new' ? (
                <NewDispatchCard
                  key={entry.assignment.assignment_id}
                  entry={entry}
                  earning={earningFor(entry)}
                  now={now}
                  disabled={busy}
                  onAccept={() => handleAccept(entry)}
                  onReject={() => setRejecting(entry)}
                />
              ) : (
                <ActiveDeliveryCard key={entry.assignment.assignment_id} entry={entry} busy={busy} onAdvance={handleAdvance} />
              ),
            )}
          </div>
        )}
      </div>

      {/* Reject confirmation */}
      <BottomSheet
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        icon={X}
        title="Reject this delivery?"
        description={rejecting && `Order ${rejecting.order.order_number} goes back to the operator, who will assign another rider.`}
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus disabled={busy} onClick={confirmReject}>
            Reject delivery
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setRejecting(null)}>
            Keep it
          </Button>
        </div>
      </BottomSheet>

      {/* Delivered confirmation (COD stays pending until the rider collects the cash) */}
      <BottomSheet
        open={confirmingDelivered !== null}
        onClose={() => setConfirmingDelivered(null)}
        icon={Check}
        title="Mark as delivered?"
        description={
          confirmingDelivered &&
          (codToCollect(confirmingDelivered) > 0 ? (
            <>
              Confirm you handed over the order and collected{' '}
              <span className="font-semibold text-sonic-ink">{formatMoney(codToCollect(confirmingDelivered))}</span> in cash.
            </>
          ) : (
            'Confirm you handed over the order to the customer.'
          ))
        }
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button fullWidth autoFocus disabled={busy} onClick={() => advance(confirmingDelivered)}>
            {codToCollect(confirmingDelivered || {}) > 0 ? 'Yes, cash collected' : 'Yes, delivered'}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirmingDelivered(null)}>
            Not yet
          </Button>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
