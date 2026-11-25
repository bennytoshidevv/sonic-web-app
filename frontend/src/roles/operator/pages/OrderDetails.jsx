import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Bike,
  CheckCircle2,
  Copy,
  Flag,
  History,
  MapPin,
  Phone,
  Printer,
  Receipt,
  StickyNote,
  Store,
  UserPlus,
  Wallet,
  XCircle,
} from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import EmptyState from '@shared/components/EmptyState'
import StatusBadge from '@shared/components/StatusBadge'
import Toast from '@shared/components/Toast'
import { STAFF_NEXT_STATUS, advanceOrderByStaff, getOrderForStaff, getRidersOverview, rejectOrderByStaff } from '@api'
import { errorText } from '@shared/utils/errors'
import { minutesBetween, orderExtraStoreFees, orderItemsSubtotal, orderTotal } from '@shared/utils/calc'
import { formatDate, formatMoney, formatPhoneNumber, formatTimestampTime } from '@shared/utils/format'
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@shared/utils/labels'
import AssignRiderSheet from '@operator/components/AssignRiderSheet'
import { useStaffPaths } from '@operator/hooks/useStaffPaths'

// Button text for the operator's next step
const NEXT_LABELS = { confirmed: 'Confirm order', preparing: 'Mark preparing', ready_for_pickup: 'Mark ready for pickup' }
const REJECTABLE = ['pending', 'confirmed', 'preparing', 'ready_for_pickup']
const ASSIGNABLE = ['confirmed', 'preparing', 'ready_for_pickup']

// Reasons the operator can pick when rejecting (saved in customer_orders.cancellation_reason)
const REJECT_REASONS = [
  'Out of delivery coverage or barangay not reachable',
  'Store closed or items unavailable',
  'Customer could not be contacted',
  'Bad weather or dispatch suspended',
  'Other reason',
]

export default function OrderDetails() {
  const orderId = Number(useParams().orderId)
  const paths = useStaffPaths()

  const [entry, setEntry] = useState(undefined) // undefined = loading, null = not found
  const [riders, setRiders] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [now, setNow] = useState(null)
  const [busy, setBusy] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => {
    Promise.all([getOrderForStaff(orderId), getRidersOverview()]).then(([order, riderList]) => {
      setEntry(order)
      setRiders(riderList)
      setNow(new Date().toISOString())
    })
  }, [orderId, refreshKey])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  if (entry === undefined) return <p className="py-10 text-center text-sonic-muted">Loading order…</p>
  if (entry === null) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState icon={Receipt} title="Order not found" text="Check the order number and try again.">
          <Link to={paths.liveOrders} className="font-semibold text-sonic-blue hover:underline">
            Back to live orders
          </Link>
        </EmptyState>
      </div>
    )
  }

  const { order, stores, payment, customer, history, assignments, currentAssignment } = entry
  const status = order.order_status
  const next = STAFF_NEXT_STATUS[status]
  const subtotal = orderItemsSubtotal(stores.flatMap((s) => s.items))
  const extraFees = orderExtraStoreFees(stores)
  const total = orderTotal(subtotal, order.base_delivery_fee, extraFees)
  const itemCount = stores.flatMap((s) => s.items).reduce((sum, i) => sum + i.quantity, 0)
  const minutesAgo = minutesBetween(order.placed_at, now)

  function showToast(message) {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  function reload() {
    setRefreshKey(refreshKey + 1)
  }

  async function handleNext() {
    setBusy(true)
    const result = await advanceOrderByStaff(order.order_id)
    setBusy(false)
    showToast(result.error ? errorText(result, result.error === 'payment_required' ? 'Waiting for online payment.' : 'This order cannot be updated right now.') : `Order marked as ${ORDER_STATUS_LABELS[next].toLowerCase()}`)
    reload()
  }

  async function handleReject() {
    if (!reason) {
      setRejectError('Please choose a reason.')
      return
    }
    if (reason === 'Other reason' && !note.trim()) {
      setRejectError('Please write the reason for the customer.')
      return
    }
    const fullReason = note.trim() ? (reason === 'Other reason' ? note.trim() : `${reason}: ${note.trim()}`) : reason
    setBusy(true)
    const result = await rejectOrderByStaff(order.order_id, fullReason)
    setBusy(false)
    if (result.error) {
      setRejectError(errorText(result, 'This order can no longer be rejected.'))
      return
    }
    setRejecting(false)
    showToast('Order rejected. The customer sees the reason on their tracking page.')
    reload()
  }

  async function copySummary() {
    const lines = [
      `Order #${order.order_number} (${ORDER_STATUS_LABELS[status]})`,
      `${customer.full_name} · ${formatPhoneNumber(customer.contact_number)}`,
      `${order.dropoff_street}, ${order.dropoff_barangay}, ${order.dropoff_city}`,
      ...stores.flatMap((s) => [`${s.name}:`, ...s.items.map((i) => `  ${i.quantity}× ${i.item_name}`)]),
      `Total: ${formatMoney(total)} (${PAYMENT_METHOD_LABELS[payment?.payment_method] || '—'})`,
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      showToast('Order summary copied')
    } catch {
      showToast('Could not copy the summary')
    }
  }

  const card = 'rounded-xl bg-white p-4 shadow-card md:p-5'

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb + tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={paths.liveOrders} className="flex min-h-11 items-center gap-1.5 text-small font-semibold text-sonic-muted hover:text-sonic-ink">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Live orders / #{order.order_number}
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copySummary}>
            <Copy className="size-4" aria-hidden="true" />
            Copy summary
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      {/* Order header + actions */}
      <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-h2 font-bold">#{order.order_number}</h1>
            <StatusBadge status={status} />
            {stores.length > 1 && (
              <span className="rounded-full bg-sonic-violet/10 px-2.5 py-0.5 text-caption font-semibold text-sonic-violet">Multi-store ({stores.length})</span>
            )}
          </div>
          <p className="mt-1 text-small text-sonic-muted">
            Placed {formatDate(order.placed_at)} at {formatTimestampTime(order.placed_at)}
            {status === 'pending' && ` · ${minutesAgo} min ago`} · Drop-off: {order.dropoff_barangay}, {order.dropoff_city}
          </p>
          {status === 'cancelled' && order.cancellation_reason && (
            <p className="mt-2 flex items-center gap-1.5 text-small font-medium text-red-600">
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
              Cancelled: {order.cancellation_reason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {next && (
            <Button onClick={handleNext} disabled={busy}>
              <CheckCircle2 className="size-5" aria-hidden="true" />
              {NEXT_LABELS[next]}
            </Button>
          )}
          {REJECTABLE.includes(status) && (
            <Button
              variant="danger-outline"
              onClick={() => {
                setReason('')
                setNote('')
                setRejectError('')
                setRejecting(true)
              }}
            >
              <XCircle className="size-5" aria-hidden="true" />
              Reject order
            </Button>
          )}
          {!next && !REJECTABLE.includes(status) && status !== 'cancelled' && status !== 'delivered' && (
            <p className="text-small text-sonic-muted">The rider updates the order from here.</p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[1fr_380px] xl:items-start">
        {/* ---- Left: stores, money, history ---- */}
        <div className="flex flex-col gap-5">
          {stores.map((store) => (
            <section key={store.restaurant_id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sonic-blue-50 text-sonic-blue">
                    <Store className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-bold">{store.name}</h2>
                    <p className="text-small text-sonic-muted">{store.address}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${store.is_primary ? 'bg-sonic-blue-50 text-sonic-blue' : 'bg-sonic-violet/10 text-sonic-violet'}`}
                >
                  {store.is_primary ? 'Main store' : `Extra store +${formatMoney(store.extra_store_fee)}`}
                </span>
              </div>
              <table className="mt-3 w-full text-small">
                <tbody className="divide-y divide-sonic-border">
                  {store.items.map((item) => (
                    <tr key={item.order_item_id}>
                      <td className="py-2 pr-2 font-semibold">{item.quantity}×</td>
                      <td className="py-2">{item.item_name}</td>
                      <td className="py-2 text-right text-sonic-muted">{formatMoney(item.unit_price)} each</td>
                      <td className="py-2 pl-3 text-right font-display font-semibold">{formatMoney(orderItemsSubtotal([item]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-sonic-border pt-2 text-small">
                {store.contact_number ? (
                  <a href={`tel:${store.contact_number}`} className="flex items-center gap-1.5 text-sonic-blue hover:underline">
                    <Phone className="size-4" aria-hidden="true" />
                    Store: {formatPhoneNumber(store.contact_number)}
                  </a>
                ) : (
                  <span />
                )}
                <span className="font-semibold">Subtotal: {formatMoney(orderItemsSubtotal(store.items))}</span>
              </div>
            </section>
          ))}

          <section aria-labelledby="money-title" className={card}>
            <h2 id="money-title" className="flex items-center gap-2 font-display text-base font-bold">
              <Banknote className="size-5 text-sonic-blue" aria-hidden="true" />
              Money breakdown
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-small">
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">Items subtotal ({itemCount} items)</dt>
                <dd>{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">Delivery fee ({order.dropoff_barangay})</dt>
                <dd>{formatMoney(order.base_delivery_fee)}</dd>
              </div>
              {extraFees > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-sonic-muted">Extra-store fee ({stores.length - 1} extra)</dt>
                  <dd>{formatMoney(extraFees)}</dd>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between gap-3 rounded-lg bg-sonic-blue-50 px-3 py-2">
                <dt className="font-display font-semibold">Total</dt>
                <dd className="font-display text-h3 font-bold text-sonic-blue">{formatMoney(total)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="trail-title" className={card}>
            <h2 id="trail-title" className="flex items-center gap-2 font-display text-base font-bold">
              <History className="size-5 text-sonic-blue" aria-hidden="true" />
              Status history
            </h2>
            <ol className="mt-3 flex flex-col">
              {[...history].reverse().map((h, index, list) => (
                <li key={h.history_id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 size-3 shrink-0 rounded-full ${index === 0 ? 'bg-sonic-blue' : 'bg-sonic-sky'}`} />
                    {index < list.length - 1 && <span className="w-0.5 flex-1 bg-sonic-border" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <p className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-small font-semibold">{ORDER_STATUS_LABELS[h.status]}</span>
                      <span className="text-caption text-sonic-muted">
                        {formatDate(h.changed_at)} · {formatTimestampTime(h.changed_at)}
                      </span>
                    </p>
                    <p className="text-caption text-sonic-muted">By {h.changed_by_name}</p>
                    {h.remarks && <p className="text-small">“{h.remarks}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ---- Right: customer, payment, rider ---- */}
        <div className="flex flex-col gap-5 xl:sticky xl:top-24">
          <section aria-labelledby="customer-title" className={card}>
            <h2 id="customer-title" className="font-display text-base font-bold">
              Customer
            </h2>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{customer.full_name}</p>
                <p className="text-small text-sonic-muted">
                  {formatPhoneNumber(customer.contact_number)} · {customer.order_count} {customer.order_count === 1 ? 'order' : 'orders'}
                </p>
              </div>
              <a
                href={`tel:${customer.contact_number}`}
                aria-label={`Call ${customer.full_name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue transition hover:bg-sonic-blue hover:text-white"
              >
                <Phone className="size-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-3 flex items-start gap-2 text-small">
              <MapPin className="mt-0.5 size-4 shrink-0 text-sonic-blue" aria-hidden="true" />
              {order.dropoff_street}, {order.dropoff_barangay}, {order.dropoff_city}
            </p>
            {order.dropoff_landmark && (
              <p className="mt-1 flex items-start gap-2 text-small text-sonic-muted">
                <Flag className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Landmark: {order.dropoff_landmark}
              </p>
            )}
            {order.order_notes && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-sonic-bolt/20 p-3 text-small">
                <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />“{order.order_notes}”
              </p>
            )}
          </section>

          <section aria-labelledby="payment-title" className={card}>
            <div className="flex items-center justify-between gap-2">
              <h2 id="payment-title" className="font-display text-base font-bold">
                Payment
              </h2>
              {payment && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${
                    payment.payment_status === 'paid' ? 'bg-green-600/10 text-green-700' : 'bg-amber-500/15 text-amber-700'
                  }`}
                >
                  {payment.payment_status === 'paid' ? 'Paid' : payment.payment_method === 'cod' ? 'To collect' : payment.payment_status}
                </span>
              )}
            </div>
            {payment ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-small">
                  {payment.payment_method === 'cod' ? (
                    <Banknote className="size-5 text-green-600" aria-hidden="true" />
                  ) : (
                    <Wallet className="size-5 text-sonic-blue" aria-hidden="true" />
                  )}
                  <span>
                    <span className="block font-semibold">{PAYMENT_METHOD_LABELS[payment.payment_method]}</span>
                    <span className="block text-caption text-sonic-muted">
                      {payment.payment_method === 'cod' ? 'Rider collects the cash' : `Reference: ${payment.provider_reference_id || 'waiting for PayMongo'}`}
                    </span>
                  </span>
                </span>
                <span className="font-display text-h3 font-bold">{formatMoney(payment.amount)}</span>
              </div>
            ) : (
              <p className="mt-2 text-small text-sonic-muted">No payment recorded.</p>
            )}
          </section>

          <section aria-labelledby="rider-title" className={card}>
            <h2 id="rider-title" className="flex items-center gap-2 font-display text-base font-bold">
              <Bike className="size-5 text-sonic-blue" aria-hidden="true" />
              Rider
            </h2>
            {currentAssignment ? (
              <div className="mt-3 rounded-lg bg-sonic-bg p-3">
                <p className="font-semibold">{currentAssignment.rider_name}</p>
                <p className="text-caption text-sonic-muted">
                  Assigned {formatTimestampTime(currentAssignment.assigned_at)} ·{' '}
                  {currentAssignment.response_status === 'pending' ? 'Waiting for the rider to accept' : 'Accepted'}
                </p>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-small font-medium text-amber-700">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {status === 'pending' ? 'Confirm the order, then assign a rider.' : ['delivered', 'cancelled'].includes(status) ? 'No rider on this order now.' : 'No rider assigned yet.'}
              </p>
            )}
            {ASSIGNABLE.includes(status) && (
              <Button fullWidth size="sm" className="mt-3 print:hidden" onClick={() => setAssigning(true)}>
                <UserPlus className="size-4" aria-hidden="true" />
                {currentAssignment ? 'Reassign rider' : 'Assign rider'}
              </Button>
            )}
            {assignments.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-sonic-border pt-3 text-caption text-sonic-muted">
                {assignments.map((a) => (
                  <li key={a.assignment_id} className="flex justify-between gap-2">
                    <span>
                      {a.rider_name} · {formatTimestampTime(a.assigned_at)}
                    </span>
                    <span>{a.end_reason ? a.end_reason : a.response_status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {assigning && (
        <AssignRiderSheet
          entry={entry}
          riders={riders}
          onClose={() => setAssigning(false)}
          onAssigned={(name) => {
            setAssigning(false)
            showToast(`Sent to ${name}. Waiting for the rider to accept.`)
            reload()
          }}
        />
      )}

      <BottomSheet
        open={rejecting}
        onClose={() => setRejecting(false)}
        icon={XCircle}
        title={`Reject order #${order.order_number}?`}
        description="The customer sees this reason on their order tracking page."
      >
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-body font-medium">
              Reason<span className="ml-0.5 text-red-600">*</span>
            </legend>
            {REJECT_REASONS.map((r) => (
              <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 text-small ${reason === r ? 'bg-sonic-blue-50 ring-1 ring-sonic-blue' : 'bg-sonic-bg'}`}>
                <input
                  type="radio"
                  name="reject_reason"
                  checked={reason === r}
                  onChange={() => {
                    setReason(r)
                    setRejectError('')
                  }}
                  className="size-4 accent-sonic-blue"
                />
                {r}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reject_note" className="text-body font-medium">
              Note for the customer {reason !== 'Other reason' && <span className="text-sonic-muted">(optional)</span>}
            </label>
            <textarea
              id="reject_note"
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setRejectError('')
              }}
              placeholder="e.g. Bridge repair on the way to Purok 3 until 2:00 PM."
              className="w-full resize-none rounded-xl border border-sonic-border p-3 text-base outline-none focus:border-sonic-blue focus:ring-3 focus:ring-sonic-blue/25 md:text-body"
            />
          </div>
          {rejectError && (
            <p role="alert" className="flex items-center gap-1.5 text-small font-medium text-red-600">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {rejectError}
            </p>
          )}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button variant="danger" fullWidth disabled={busy} onClick={handleReject}>
              Reject order
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setRejecting(false)}>
              Keep order
            </Button>
          </div>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </div>
  )
}
