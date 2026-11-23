import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  BellRing,
  Bike,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  Flag,
  Info,
  MapPin,
  Phone,
  Receipt,
  Store,
  Wallet,
  Zap,
} from 'lucide-react'
import Alert from '../../components/Alert'
import BottomSheet from '../../components/BottomSheet'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import Input from '../../components/Input'
import StatusBadge from '../../components/StatusBadge'
import Toast from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import { advanceDelivery, getRiderDeliveryDetails, recordPettyPurchase } from '../../data/mock'
import {
  cashOptions,
  changeDue,
  deliveryGross,
  gasAllowanceFor,
  minutesBetween,
  orderExtraStoreFees,
  orderItemsSubtotal,
  orderTotal,
  pettyCashOnHand,
  sumAmounts,
} from '../../lib/calc'
import { formatMoney, formatPhoneNumber, formatTimestampTime } from '../../lib/format'
import { PAYMENT_METHOD_LABELS, RIDER_NEXT_ACTION } from '../../lib/labels'

// "Liza Bautista" → "LB"
function initials(name) {
  const words = name.trim().split(/\s+/)
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

// Pickups → Transit → Drop-off. Returns how many of the 3 steps are done.
function stepsDone(status) {
  if (status === 'delivered') return 3
  if (status === 'picked_up' || status === 'on_the_way') return 1
  return 0
}

export default function DeliveryDetails() {
  const navigate = useNavigate()
  const orderId = Number(useParams().orderId)
  const { user } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [justDelivered, setJustDelivered] = useState(false)

  const [cashSheet, setCashSheet] = useState(false)
  const [tendered, setTendered] = useState(null) // cash handed over by the customer
  const [customCash, setCustomCash] = useState('')

  const [pettyOpen, setPettyOpen] = useState(false)
  const [pettyAmount, setPettyAmount] = useState('')
  const [pettyError, setPettyError] = useState('')

  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    getRiderDeliveryDetails(user.user_id, orderId).then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [user.user_id, orderId, refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  if (loading) return <p className="py-10 text-center text-sonic-muted">Loading delivery…</p>

  if (!data) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState icon={Bike} title="Delivery not found" text="This delivery is not assigned to you.">
          <Button onClick={() => navigate('/rider/deliveries')}>My deliveries</Button>
        </EmptyState>
      </div>
    )
  }

  const { order, stores, history, payment, customer, assignment, earning, shiftPettyCash, orderPurchases, shiftIsOpen, tiers, rate } = data
  const status = order.order_status
  const isPending = assignment.response_status === 'pending'
  const isDelivered = status === 'delivered'
  const inProgress = assignment.response_status === 'accepted' && !isDelivered
  const action = inProgress ? RIDER_NEXT_ACTION[status] : null

  // Money (calc.js)
  const extraFees = orderExtraStoreFees(stores)
  const total = orderTotal(orderItemsSubtotal(stores.flatMap((s) => s.items)), order.base_delivery_fee, extraFees)
  const isCod = payment?.payment_method === 'cod'
  const codPending = isCod && payment.payment_status === 'pending'
  const allowance = earning ? earning.gas_allowance_amount : gasAllowanceFor(order.base_delivery_fee, tiers)
  const sharePct = earning ? earning.rider_share_pct : rate.rider_share_pct
  const riderEarning = deliveryGross(order.base_delivery_fee, allowance, sharePct, extraFees)
  const pettyOnHand = pettyCashOnHand(shiftPettyCash)
  const advancedForOrder = sumAmounts(orderPurchases)

  const pickedUpRow = history.find((h) => h.status === 'picked_up')
  const deliveredRow = history.find((h) => h.status === 'delivered')
  const pickedUp = stepsDone(status) >= 1
  const done = stepsDone(status)

  // ---- Actions ----
  async function advance() {
    setError('')
    setBusy(true)
    const result = await advanceDelivery(user.user_id, order.order_id)
    setBusy(false)
    setCashSheet(false)
    if (result.error) {
      setError(result.error === 'no_open_shift' ? 'Your shift is closed. Start a shift on the Dashboard.' : 'This delivery cannot be updated right now.')
    } else if (result.order.order_status === 'delivered') {
      setJustDelivered(true)
      window.scrollTo({ top: 0 })
    } else {
      showToast(RIDER_NEXT_ACTION[status].done)
    }
    setRefreshKey(refreshKey + 1)
  }

  function handleMainAction() {
    if (status === 'on_the_way') {
      setTendered(codPending ? total : null)
      setCustomCash('')
      setCashSheet(true)
    } else {
      advance()
    }
  }

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(order.order_number)
      showToast('Order number copied')
    } catch {
      showToast('Could not copy the order number')
    }
  }

  async function savePetty(e) {
    e.preventDefault()
    const amount = Number(pettyAmount)
    if (!pettyAmount || !(amount > 0)) {
      setPettyError('Enter the amount you paid the store.')
      return
    }
    const result = await recordPettyPurchase(user.user_id, order.order_id, Math.round(amount * 100) / 100)
    if (result.error === 'not_enough') {
      setPettyError(`You only have ${formatMoney(pettyOnHand)} petty cash on hand.`)
      return
    }
    if (result.error) {
      setPettyError('This delivery cannot record a store advance right now.')
      return
    }
    setPettyAmount('')
    setPettyError('')
    showToast(`Store advance of ${formatMoney(amount)} saved`)
    setRefreshKey(refreshKey + 1)
  }

  // ---- Success screen right after "Delivered" ----
  if (justDelivered && isDelivered) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-4 text-center">
        <div className="relative">
          <span className="flex size-24 items-center justify-center rounded-full bg-sonic-bolt shadow-card">
            <Zap className="size-12 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
          </span>
          <span className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full bg-green-600 text-white ring-4 ring-sonic-bg">
            <Check className="size-5" aria-hidden="true" />
          </span>
        </div>
        <div>
          <span className="rounded-full bg-sonic-blue-50 px-3 py-1 text-caption font-semibold text-sonic-blue">Lightning-fast run</span>
          <h1 className="mt-3 font-display text-h1 font-bold">Order delivered!</h1>
          <p className="mt-1 text-body text-sonic-muted">Drop-off completed for {customer.full_name}.</p>
        </div>

        <div className="w-full rounded-xl bg-white p-4 text-left shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-small text-sonic-muted">Delivery earning</span>
            <span className="font-display text-h2 font-bold text-green-700">+{formatMoney(riderEarning)}</span>
          </div>
          {isCod && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-small text-sonic-muted">COD cash in hand</span>
              <span className="font-display text-h3 font-bold">{formatMoney(total)}</span>
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-sonic-border pt-4 text-center">
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-sonic-muted">Placed to delivered</dt>
              <dd className="font-display text-h3 font-bold">{minutesBetween(order.placed_at, deliveredRow.changed_at)} min</dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-caption text-sonic-muted">Stops completed</dt>
              <dd className="font-display text-h3 font-bold">{stores.length + 1}</dd>
            </div>
          </dl>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button fullWidth onClick={() => navigate('/rider/deliveries')}>
            Find next delivery
            <Bike className="size-5" aria-hidden="true" />
          </Button>
          <Button variant="secondary" fullWidth onClick={() => navigate('/rider')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Main action (bottom bar on phone/tablet, in the side column on desktop)
  const mainAction = action ? (
    <Button size="lg" fullWidth onClick={handleMainAction} disabled={busy}>
      {status === 'on_the_way' ? 'Arrived · Mark as delivered' : action.label}
      <Zap className="size-5 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
    </Button>
  ) : inProgress ? (
    <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-small text-amber-700">
      <Info className="size-4 shrink-0" aria-hidden="true" />
      Waiting for the store. You can pick up once the order is ready for pickup.
    </p>
  ) : null

  const cardClass = 'rounded-xl bg-white p-4 shadow-card md:p-5'
  const callButton =
    'flex size-11 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue transition hover:bg-sonic-blue hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue'

  return (
    <div className={inProgress ? 'pb-16 lg:pb-0' : ''}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          to="/rider/deliveries"
          aria-label="Back to my deliveries"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="truncate font-display text-h3 font-bold">#{order.order_number}</h1>
            <button
              type="button"
              onClick={copyOrderNumber}
              aria-label="Copy order number"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-sonic-muted transition hover:bg-sonic-blue-50 hover:text-sonic-blue"
            >
              <Copy className="size-4" />
            </button>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Progress: Pickups → Transit → Drop-off */}
      <ol className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-white p-3 shadow-card" aria-label="Delivery progress">
        {[
          { label: `Pickups (${stores.length})`, Icon: Store },
          { label: 'Transit', Icon: Bike },
          { label: 'Drop-off', Icon: MapPin },
        ].map(({ label, Icon }, index) => {
          const state = index < done ? 'done' : index === done ? 'active' : 'upcoming'
          return (
            <li key={label} className="flex flex-col items-center gap-1.5" aria-current={state === 'active' ? 'step' : undefined}>
              <span className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : index <= done ? 'bg-sonic-sky' : 'bg-sonic-border'}`} />
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    state === 'done' ? 'bg-sonic-blue text-white' : state === 'active' ? 'bg-sonic-violet/15 text-sonic-violet' : 'bg-sonic-bg text-sonic-muted'
                  }`}
                >
                  {state === 'done' ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                </span>
                <span className={`h-0.5 flex-1 ${index === 2 ? 'invisible' : index < done ? 'bg-sonic-sky' : 'bg-sonic-border'}`} />
              </span>
              <span className={`text-caption ${state === 'upcoming' ? 'text-sonic-muted' : 'font-semibold text-sonic-ink'}`}>
                {label}
                <span className="sr-only">{state === 'done' ? ' (done)' : state === 'active' ? ' (now)' : ' (not yet)'}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">
        {isPending && (
          <Alert variant="info" title="New dispatch.">
            <Link to="/rider/deliveries" className="font-semibold underline">
              Accept or reject it
            </Link>{' '}
            on the Deliveries page.
          </Alert>
        )}
        {isDelivered && deliveredRow && (
          <p className="flex items-center gap-2 rounded-xl bg-green-600/10 p-3 text-small font-semibold text-green-700">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            Delivered at {formatTimestampTime(deliveredRow.changed_at)} · You earned {formatMoney(riderEarning)}
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-small text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
        {/* ---- Left: pickups + drop-off ---- */}
        <div className="flex flex-col gap-4">
          <section aria-labelledby="pickups-title" className={`${cardClass} flex flex-col gap-3`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 id="pickups-title" className="font-display text-h3 font-bold">
                  Pickups
                </h2>
                <span className="rounded-full bg-sonic-bg px-2 py-0.5 text-caption text-sonic-muted">
                  {stores.length} {stores.length === 1 ? 'store' : 'stores'}
                </span>
              </div>
              {pickedUp && (
                <span className="flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-1 text-caption font-semibold text-green-700">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Done
                </span>
              )}
            </div>

            {stores.map((store, index) => (
              <div key={store.restaurant_id} className="flex flex-col gap-3 rounded-lg bg-sonic-bg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonic-blue font-display text-small font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-small font-semibold">{store.name}</p>
                      <p className="text-small text-sonic-muted">{store.address}</p>
                      {pickedUpRow && (
                        <p className="text-caption font-medium text-green-700">✓ Picked up at {formatTimestampTime(pickedUpRow.changed_at)}</p>
                      )}
                    </div>
                  </div>
                  {store.contact_number && (
                    <a href={`tel:${store.contact_number}`} aria-label={`Call ${store.name}`} className={callButton}>
                      <Phone className="size-5" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <ul className="flex flex-col gap-1.5 rounded-lg bg-white p-3">
                  {store.items.map((item) => (
                    <li key={item.order_item_id} className="flex items-center gap-2 text-small">
                      {pickedUp ? (
                        <CheckCircle2 className="size-4 shrink-0 text-green-600" aria-hidden="true" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-sonic-border" aria-hidden="true" />
                      )}
                      <span className="font-semibold">{item.quantity}×</span> {item.item_name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section aria-labelledby="dropoff-title" className={`${cardClass} flex flex-col gap-3`}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="dropoff-title" className="font-display text-h3 font-bold">
                Drop-off
              </h2>
              <span className="rounded-full bg-sonic-violet/10 px-2 py-0.5 text-caption font-semibold text-sonic-violet">Final stop</span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-sonic-bg p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sonic-blue font-display font-bold text-white">
                  {initials(customer.full_name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-small font-semibold">{customer.full_name}</p>
                  <p className="text-small text-sonic-muted">{formatPhoneNumber(customer.contact_number)}</p>
                </div>
              </div>
              <a href={`tel:${customer.contact_number}`} aria-label={`Call ${customer.full_name}`} className={callButton}>
                <Phone className="size-5" aria-hidden="true" />
              </a>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sonic-violet/10 text-sonic-violet">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-small font-semibold">
                  {order.dropoff_street}, {order.dropoff_barangay}, {order.dropoff_city}
                </p>
                {order.dropoff_landmark && (
                  <p className="mt-0.5 flex items-center gap-1 text-small text-sonic-muted">
                    <Flag className="size-3.5 shrink-0" aria-hidden="true" />
                    Landmark: {order.dropoff_landmark}
                  </p>
                )}
              </div>
            </div>

            {order.order_notes && (
              <div className="flex items-start gap-2.5 rounded-lg bg-sonic-bolt/20 p-3">
                <BellRing className="mt-0.5 size-4 shrink-0 text-sonic-ink" aria-hidden="true" />
                <div>
                  <p className="font-display text-small font-semibold text-sonic-ink">Customer note</p>
                  <p className="text-small text-sonic-ink">“{order.order_notes}”</p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ---- Right: payment, store advance, action ---- */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <section aria-labelledby="payment-title" className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${codPending ? 'bg-green-600/10 text-green-700' : 'bg-sonic-blue-50 text-sonic-blue'}`}
                >
                  {isCod ? <Banknote className="size-5" aria-hidden="true" /> : <Wallet className="size-5" aria-hidden="true" />}
                </span>
                <div>
                  <h2 id="payment-title" className="font-display text-small font-semibold">
                    {isCod ? 'Cash on Delivery (COD)' : `Paid via ${PAYMENT_METHOD_LABELS[payment.payment_method]}`}
                  </h2>
                  <p className="text-caption text-sonic-muted">
                    {codPending ? 'Collect before handing over the items' : isCod ? 'Cash collected' : 'Nothing to collect'}
                  </p>
                </div>
              </div>
              <span className={`font-display text-h2 font-extrabold ${codPending ? 'text-green-700' : 'text-sonic-muted'}`}>
                {codPending || isCod ? formatMoney(total) : formatMoney(0)}
              </span>
            </div>
            <p className="mt-3 flex items-center justify-between gap-2 border-t border-sonic-border pt-3 text-small">
              <span className="text-sonic-muted">{earning ? 'Your earning' : 'Your earning (estimate)'}</span>
              <span className="font-display font-bold text-sonic-blue">{formatMoney(riderEarning)}</span>
            </p>
          </section>

          {/* Store advance / petty cash (petty_cash_transactions, txn_type = purchase) */}
          {(inProgress || orderPurchases.length > 0) && (
            <section className={`${cardClass} p-0 md:p-0`}>
              <button
                type="button"
                onClick={() => setPettyOpen(!pettyOpen)}
                aria-expanded={pettyOpen}
                aria-controls="petty-panel"
                className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-bg text-sonic-blue">
                    <Receipt className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-display text-small font-semibold">Store advance (petty cash)</span>
                    <span className="block text-small text-sonic-muted">
                      {advancedForOrder > 0 ? `${formatMoney(advancedForOrder)} paid to stores for this order` : 'Did you pay a store from petty cash?'}
                    </span>
                  </span>
                </span>
                <ChevronDown className={`size-5 shrink-0 text-sonic-muted transition ${pettyOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {pettyOpen && (
                <div id="petty-panel" className="flex flex-col gap-3 border-t border-sonic-border px-4 py-4 md:px-5">
                  {orderPurchases.length > 0 && (
                    <ul className="flex flex-col gap-1 text-small">
                      {orderPurchases.map((t) => (
                        <li key={t.txn_id} className="flex justify-between gap-2">
                          <span className="text-sonic-muted">Paid at {formatTimestampTime(t.created_at)}</span>
                          <span className="font-semibold">{formatMoney(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {inProgress && shiftIsOpen && (
                    <form onSubmit={savePetty} noValidate className="flex flex-col gap-2">
                      <Input
                        label="Amount paid to the store"
                        id="petty_amount"
                        inputMode="decimal"
                        prefix="₱"
                        placeholder="0.00"
                        value={pettyAmount}
                        onChange={(e) => {
                          setPettyAmount(e.target.value.replace(/[^\d.]/g, ''))
                          setPettyError('')
                        }}
                        error={pettyError}
                        hint={`Petty cash on hand: ${formatMoney(pettyOnHand)}`}
                      />
                      <Button type="submit" size="sm" variant="secondary" className="self-end">
                        Save store advance
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Desktop: main action here */}
          {mainAction && <div className="hidden lg:block">{mainAction}</div>}
        </div>
      </div>

      {/* Phone/tablet: main action fixed at the bottom */}
      {mainAction && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(11,16,51,0.08)] backdrop-blur-md lg:hidden">
          <div className="mx-auto max-w-xl">{mainAction}</div>
        </div>
      )}

      {/* Delivered: confirm the cash (COD stays pending until the rider collects it) */}
      <BottomSheet
        open={cashSheet}
        onClose={() => setCashSheet(false)}
        icon={Banknote}
        title={codPending ? 'Confirm cash collection' : 'Mark as delivered?'}
        description={`Order #${order.order_number}`}
      >
        <div className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 rounded-lg bg-sonic-bg p-3 text-small">
            <div className="flex justify-between gap-3">
              <dt className="text-sonic-muted">Order total (food + delivery)</dt>
              <dd className="font-display font-bold">{formatMoney(total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-sonic-muted">Your earning</dt>
              <dd className="font-display font-bold text-green-700">+{formatMoney(riderEarning)}</dd>
            </div>
          </dl>

          {codPending ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-body font-medium" id="cash-label">
                  Cash handed over by {customer.full_name.split(' ')[0]}
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="cash-label">
                  {cashOptions(total).map((amount, index) => (
                    <button
                      key={amount}
                      type="button"
                      aria-pressed={tendered === amount && !customCash}
                      onClick={() => {
                        setTendered(amount)
                        setCustomCash('')
                      }}
                      className={`min-h-11 rounded-full px-4 font-display text-small font-semibold shadow-card transition ${
                        tendered === amount && !customCash ? 'bg-sonic-blue text-white' : 'bg-white text-sonic-ink hover:bg-sonic-blue-50'
                      }`}
                    >
                      {formatMoney(amount)}
                      {index === 0 && ' (exact)'}
                    </button>
                  ))}
                </div>
                <Input
                  label="Other amount"
                  id="custom_cash"
                  inputMode="decimal"
                  prefix="₱"
                  placeholder="0.00"
                  value={customCash}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, '')
                    setCustomCash(value)
                    setTendered(value ? Number(value) : null)
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg bg-sonic-blue-50 p-3">
                <span className="text-small font-medium text-sonic-ink">Change to give back</span>
                <span className="font-display text-h2 font-extrabold text-sonic-blue">
                  {tendered !== null ? formatMoney(changeDue(tendered, total)) : '—'}
                </span>
              </div>
              {tendered !== null && tendered < total && (
                <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                  Not enough cash: {formatMoney(total - tendered)} short.
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 text-small text-sonic-muted">
              <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />
              Paid online. Just hand over the order.
            </p>
          )}

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button fullWidth onClick={advance} disabled={busy || (codPending && (tendered === null || tendered < total))}>
              {codPending ? 'Cash received · Complete' : 'Yes, delivered'}
              <Zap className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setCashSheet(false)}>
              Go back
            </Button>
          </div>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
