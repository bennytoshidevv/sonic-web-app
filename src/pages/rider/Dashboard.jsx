import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bike,
  CalendarDays,
  CheckCircle2,
  Coins,
  MapPin,
  Moon,
  Power,
  Store,
  Zap,
} from 'lucide-react'
import BottomSheet from '../../components/BottomSheet'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { endShift, getRiderDashboard, setRiderAvailability, startShift } from '../../data/mock'
import {
  deliveryGross,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
  pettyCashOnHand,
  sumAmounts,
} from '../../lib/calc'
import { formatDate, formatMoney, formatTimestampTime } from '../../lib/format'
import { ORDER_STATUS_MESSAGES } from '../../lib/labels'

const AVAILABILITY = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'offline', label: 'Offline' },
]

// Below this, the petty cash card shows "Low" (DESIGN.md: warning color for low petty cash)
const LOW_PETTY_CASH = 200

// Order total from the frozen order data (calc.js)
function totalOf(order, stores) {
  return orderTotal(orderItemsSubtotal(stores.flatMap((s) => s.items)), order.base_delivery_fee, orderExtraStoreFees(stores))
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getRiderDashboard(user.user_id).then(setData)
  }, [user.user_id, refreshKey])

  if (!data) return <p className="py-10 text-center text-sonic-muted">Loading your dashboard…</p>

  const { profile, shift, hasShiftToday, deliveries, deductions, pettyCash, activeDelivery } = data
  const shiftIsOpen = shift?.status === 'open'

  // ---- Earnings of this shift (calc.js) ----
  const gross = deliveries.reduce(
    (sum, d) =>
      sum + deliveryGross(d.order.base_delivery_fee, d.earning.gas_allowance_amount, d.earning.rider_share_pct, orderExtraStoreFees(d.stores)),
    0,
  )
  const totalDeductions = sumAmounts(deductions)
  const netPay = gross - totalDeductions
  const shiftFees = sumAmounts(deductions.filter((d) => d.earning_id === null)) // box rent + savings
  const codCollected = deliveries
    .filter((d) => d.payment?.payment_method === 'cod' && d.payment.payment_status === 'paid')
    .reduce((sum, d) => sum + totalOf(d.order, d.stores), 0)
  const pettyOnHand = pettyCashOnHand(pettyCash)
  const pettyLow = pettyOnHand < LOW_PETTY_CASH

  const activeTotal = activeDelivery ? totalOf(activeDelivery.order, activeDelivery.stores) : 0
  const activeIsCod = activeDelivery?.payment?.payment_method === 'cod' && activeDelivery.payment.payment_status === 'pending'

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  async function handleStart() {
    setActionError('')
    setBusy(true)
    const result = await startShift(user.user_id)
    setBusy(false)
    if (result.error) setActionError('You already had a shift today. Shifts are one per day.')
    reload()
  }

  async function handleEnd() {
    setBusy(true)
    const result = await endShift(user.user_id)
    setBusy(false)
    setConfirmEnd(false)
    if (result.error === 'delivery_in_progress') setActionError('Finish your current delivery before ending your shift.')
    reload()
  }

  async function handleAvailability(value) {
    await setRiderAvailability(user.user_id, value)
    reload()
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      {/* ---- Left column: shift + current delivery ---- */}
      <div className="flex flex-col gap-4">
        {/* Shift card: the page's only gradient (DESIGN.md: rider dashboard card) */}
        <section
          aria-label="Shift"
          className="relative overflow-hidden rounded-xl bg-linear-135 from-sonic-blue to-sonic-violet p-4 text-white shadow-card md:p-6"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-6 size-32 rounded-full bg-sonic-bolt/10 blur-2xl" />

          {shiftIsOpen ? (
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-display text-small font-semibold">
                  <span className="flex size-7 items-center justify-center rounded-full bg-sonic-bolt/20">
                    <Zap className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
                  </span>
                  Shift open since {formatTimestampTime(shift.started_at)}
                </p>
                <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-caption font-semibold tracking-wide uppercase">
                  <span
                    className={`size-2 rounded-full ${profile.availability_status === 'offline' ? 'bg-white/60' : 'animate-pulse bg-sonic-bolt'}`}
                    aria-hidden="true"
                  />
                  {profile.availability_status === 'offline' ? 'Offline' : 'Online'}
                </span>
              </div>

              {/* Availability (rider_profiles.availability_status) */}
              <div role="radiogroup" aria-label="Availability" className="flex rounded-full bg-black/20 p-1">
                {AVAILABILITY.map(({ value, label }) => {
                  const selected = profile.availability_status === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleAvailability(value)}
                      className={`min-h-10 flex-1 rounded-full font-display text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-white ${
                        selected ? 'bg-white text-sonic-ink shadow-card' : 'text-white/80 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setActionError('')
                  setConfirmEnd(true)
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-display font-semibold text-sonic-blue shadow-card transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
              >
                <Power className="size-5" aria-hidden="true" />
                End shift
              </button>
            </div>
          ) : (
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-display text-base font-bold">
                  <span className="flex size-8 items-center justify-center rounded-full bg-white/10">
                    <Moon className="size-4 text-sonic-bolt" aria-hidden="true" />
                  </span>
                  {hasShiftToday ? 'Shift closed for today' : 'No shift yet today'}
                </p>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-caption text-white/80">Offline</span>
              </div>
              <p className="text-small text-white/90">
                {hasShiftToday
                  ? `Your shift ended at ${formatTimestampTime(shift.ended_at)}. Hand over your COD cash at the hub. See you tomorrow!`
                  : 'Ready to roll? Start your shift to receive deliveries across Sipocot.'}
              </p>
              {!hasShiftToday && (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sonic-bolt font-display font-semibold text-sonic-ink shadow-card transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] disabled:opacity-60"
                >
                  <Zap className="size-5 fill-sonic-ink" aria-hidden="true" />
                  {busy ? 'Starting…' : 'Start shift'}
                </button>
              )}
            </div>
          )}
        </section>

        {actionError && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-small text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {actionError}
          </p>
        )}

        {/* Current delivery */}
        {shiftIsOpen && (
          <section aria-labelledby="active-title" className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 id="active-title" className="flex items-center gap-2 font-display text-base font-bold">
                {activeDelivery && <span className="size-2.5 animate-pulse rounded-full bg-sonic-violet" aria-hidden="true" />}
                {activeDelivery ? 'Active delivery' : 'No active delivery'}
              </h2>
              {activeDelivery && <StatusBadge status={activeDelivery.order.order_status} />}
            </div>

            {!activeDelivery ? (
              <p className="flex items-center gap-2 rounded-lg bg-sonic-bg p-3 text-small text-sonic-muted">
                <Bike className="size-5 shrink-0 text-sonic-blue" aria-hidden="true" />
                {profile.availability_status === 'available'
                  ? 'You are available. New deliveries from the operator will show up here.'
                  : 'Set yourself to Available to receive deliveries.'}
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 rounded-lg bg-sonic-bg p-3">
                  <div className="min-w-0">
                    <p className="text-caption tracking-wider text-sonic-muted uppercase">Order</p>
                    <p className="truncate font-display text-small font-bold">{activeDelivery.order.order_number}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-sonic-blue-50 px-2 py-0.5 text-caption font-semibold text-sonic-blue">
                    {activeDelivery.stores.length} {activeDelivery.stores.length === 1 ? 'store' : 'stores'}
                  </span>
                </div>

                <ul className="flex flex-col gap-2">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sonic-bg text-sonic-muted">
                      <Store className="size-4" aria-hidden="true" />
                    </span>
                    <p className="text-small text-sonic-ink">
                      <span className="font-semibold">{activeDelivery.stores[0].name}</span>
                      {activeDelivery.stores.slice(1).map((s) => ` + ${s.name}`)}
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sonic-violet/10 text-sonic-violet">
                      <MapPin className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-small font-semibold text-sonic-ink">
                        {activeDelivery.order.dropoff_street}, {activeDelivery.order.dropoff_barangay}, {activeDelivery.order.dropoff_city}
                      </p>
                      {activeDelivery.order.dropoff_landmark && (
                        <p className="text-caption text-sonic-muted">Landmark: {activeDelivery.order.dropoff_landmark}</p>
                      )}
                    </div>
                  </li>
                </ul>

                <p className="text-small text-sonic-muted">{ORDER_STATUS_MESSAGES[activeDelivery.order.order_status]}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Banknote className={`size-5 ${activeIsCod ? 'text-green-600' : 'text-sonic-muted'}`} aria-hidden="true" />
                    <div>
                      <p className="text-caption text-sonic-muted">{activeIsCod ? 'Cash to collect (COD)' : 'Already paid online'}</p>
                      <p className="font-display text-base font-bold">{activeIsCod ? formatMoney(activeTotal) : 'Nothing to collect'}</p>
                    </div>
                  </div>
                  <Link
                    to={`/rider/deliveries/${activeDelivery.order.order_id}`}
                    className="flex h-11 items-center gap-1.5 rounded-full bg-sonic-blue px-5 font-display text-small font-semibold text-white shadow-card transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue"
                  >
                    Open
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* ---- Right column: earnings + cash ---- */}
      <div className="flex flex-col gap-4">
        <section aria-labelledby="earnings-title" className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card md:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 id="earnings-title" className="flex items-center gap-2 font-display text-base font-bold">
              <span className="flex size-8 items-center justify-center rounded-full bg-sonic-bg text-sonic-blue">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              {shiftIsOpen ? "Today's earnings" : 'Last shift'}
            </h2>
            {shift && <span className="text-small text-sonic-muted">{formatDate(shift.started_at)}</span>}
          </div>

          {!shift ? (
            <p className="text-small text-sonic-muted">Your earnings will show here once you start a shift.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col-reverse rounded-lg bg-sonic-bg p-3">
                  <dt className="text-small text-sonic-muted">Deliveries</dt>
                  <dd className="font-display text-h2 font-bold">{deliveries.length}</dd>
                </div>
                <div className="flex flex-col-reverse rounded-lg bg-sonic-bg p-3">
                  <dt className="text-small text-sonic-muted">Gross earnings</dt>
                  <dd className="font-display text-h3 font-bold">{formatMoney(gross)}</dd>
                </div>
                <div className="flex flex-col-reverse rounded-lg bg-sonic-bg p-3">
                  <dt className="text-small text-sonic-muted">Deductions</dt>
                  <dd className="font-display text-h3 font-bold text-red-600">−{formatMoney(totalDeductions)}</dd>
                </div>
                <div className="flex flex-col-reverse rounded-lg bg-sonic-blue-50 p-3">
                  <dt className="text-small font-semibold text-sonic-blue">Net pay</dt>
                  <dd className="font-display text-h2 font-extrabold text-sonic-blue">{formatMoney(netPay)}</dd>
                </div>
              </dl>
              <p className="text-caption text-sonic-muted">
                Deductions: {formatMoney(10)} operator fee per delivery + {formatMoney(shiftFees)} per shift (box rent and savings).
              </p>
            </>
          )}
        </section>

        {shift && (
          <div className="grid grid-cols-2 gap-3">
            {/* COD cash collected this shift */}
            <section aria-label="COD collected" className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-card md:p-4">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-full bg-sonic-bg text-sonic-blue">
                  <Banknote className="size-5" aria-hidden="true" />
                </span>
                {codCollected > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-caption font-semibold text-red-600">Remit</span>
                )}
              </div>
              <div>
                <p className="text-small text-sonic-muted">COD collected</p>
                <p className="font-display text-h3 font-bold">{formatMoney(codCollected)}</p>
              </div>
              <p className="text-caption text-sonic-muted">To hand over at the hub</p>
            </section>

            {/* Petty cash (for pabili purchases) */}
            <section aria-label="Petty cash on hand" className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-card md:p-4">
              <div className="flex items-center justify-between">
                <span className={`flex size-9 items-center justify-center rounded-full bg-sonic-bg ${pettyLow ? 'text-amber-500' : 'text-green-600'}`}>
                  <Coins className="size-5" aria-hidden="true" />
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-caption font-semibold ${
                    pettyLow ? 'bg-amber-500/15 text-amber-700' : 'bg-green-600/10 text-green-700'
                  }`}
                >
                  {pettyLow ? 'Low' : 'OK'}
                </span>
              </div>
              <div>
                <p className="text-small text-sonic-muted">Petty cash on hand</p>
                <p className="font-display text-h3 font-bold">{formatMoney(pettyOnHand)}</p>
              </div>
              <p className={`flex items-center gap-1 text-caption ${pettyLow ? 'text-amber-700' : 'text-green-700'}`}>
                {pettyLow ? (
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                )}
                {pettyLow ? 'Ask the operator for a top-up' : 'Enough for pabili orders'}
              </p>
            </section>
          </div>
        )}
      </div>

      {/* End shift confirmation */}
      <BottomSheet
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        icon={AlertTriangle}
        title="End your shift?"
        description={
          activeDelivery ? (
            'You still have an active delivery. Finish it before ending your shift.'
          ) : (
            <>
              You have <span className="font-semibold text-sonic-ink">{formatMoney(codCollected)}</span> COD cash to hand over at the
              Sipocot hub before closing.
            </>
          )
        }
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus disabled={busy || Boolean(activeDelivery)} onClick={handleEnd}>
            {busy ? 'Ending…' : 'End shift'}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirmEnd(false)}>
            Keep working
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
