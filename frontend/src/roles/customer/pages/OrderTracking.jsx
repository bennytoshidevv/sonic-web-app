import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Bike,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCw,
  Star,
  StickyNote,
  Store,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import EmptyState from '@shared/components/EmptyState'
import OrderStepper from '@customer/components/OrderStepper'
import StatusBadge from '@shared/components/StatusBadge'
import { useAuth } from '@shared/auth/AuthContext'
import { cancelOrder, getOrderDetails } from '@mock/mock'
import { orderExtraStoreFees, orderItemsSubtotal, orderTotal } from '@shared/utils/calc'
import { formatDate, formatMoney, formatTimestampTime } from '@shared/utils/format'
import { ORDER_STATUS_MESSAGES, PAYMENT_METHOD_LABELS } from '@shared/utils/labels'

// "09181234567" → "0918 123 4567"
function formatPhone(number) {
  return number.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3')
}

export default function OrderTracking() {
  const navigate = useNavigate()
  const orderId = Number(useParams().orderId)
  const { user } = useAuth()

  const [data, setData] = useState(null) // { order, stores, history, payment, rider }
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0) // +1 reloads the order
  const [lastUpdated, setLastUpdated] = useState(null)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    getOrderDetails(orderId, user.user_id).then((result) => {
      setData(result)
      setLastUpdated(new Date().toISOString())
      setLoading(false)
      setRefreshing(false)
    })
  }, [orderId, user.user_id, refreshKey])

  function refresh() {
    setRefreshing(true)
    setRefreshKey(refreshKey + 1)
  }

  if (loading) return <p className="py-10 text-center text-sonic-muted">Loading your order…</p>

  if (!data) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState icon={ReceiptText} title="Order not found" text="We could not find this order in your account.">
          <Button onClick={() => navigate('/customer')}>Back to restaurants</Button>
        </EmptyState>
      </div>
    )
  }

  const { order, stores, history, payment, rider } = data
  const status = order.order_status
  const isCancelled = status === 'cancelled'

  // Totals from the frozen order data (calc.js)
  const allItems = stores.flatMap((store) => store.items)
  const subtotal = orderItemsSubtotal(allItems)
  const extraFees = orderExtraStoreFees(stores)
  const total = orderTotal(subtotal, order.base_delivery_fee, extraFees)

  const lastChange = history[history.length - 1]
  const storeNames = stores.map((s) => s.name).join(' & ')

  // What the payment row says
  let paymentText = ''
  if (payment) {
    if (payment.payment_status === 'paid') paymentText = 'Paid'
    else if (isCancelled) paymentText = 'Not charged'
    else if (payment.payment_method === 'cod') paymentText = `Pay ${formatMoney(total)} to the rider`
    else paymentText = 'Waiting for payment'
  }

  async function handleCancel(e) {
    e.preventDefault()
    if (!cancelReason.trim()) {
      setCancelError('Please tell us why you are cancelling.')
      return
    }
    setCancelling(true)
    const result = await cancelOrder(order.order_id, user.user_id, cancelReason.trim())
    setCancelling(false)
    if (result.error) {
      setCancelError('This order can no longer be cancelled: the store already confirmed it.')
      refresh()
      return
    }
    setCancelOpen(false)
    refresh()
  }

  function openCancel() {
    setCancelReason('')
    setCancelError('')
    setCancelOpen(true)
  }

  const cardClass = 'rounded-xl bg-white p-4 shadow-card md:p-6'

  return (
    <div>
      {/* Page header */}
      <div className="mb-4 flex items-center gap-1">
        <Link
          to="/customer/orders"
          aria-label="Back to my orders"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue"
        >
          <ArrowLeft className="size-6" />
        </Link>
        <h1 className="font-display text-h2 font-bold">Track order</h1>
      </div>

      {/* Desktop: progress on the left, details on the right. Phone/tablet: stacked. */}
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4">
          {/* Delivered / cancelled banner */}
          {status === 'delivered' && (
            <div role="status" className="flex items-center gap-3 rounded-xl bg-green-600 p-4 text-white shadow-card">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sonic-bolt">
                <Zap className="size-5 fill-sonic-ink text-sonic-ink" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-h3 font-bold">Order delivered!</p>
                <p className="text-small text-white/90">Enjoy your meal from {storeNames}.</p>
              </div>
            </div>
          )}
          {isCancelled && (
            <div role="status" className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-700 shadow-card">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-display text-h3 font-bold text-red-600">Order cancelled</p>
                {order.cancellation_reason && <p className="mt-0.5 text-small">Reason: {order.cancellation_reason}</p>}
              </div>
            </div>
          )}

          {/* Order number + status */}
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-small text-sonic-muted">Order number</p>
                <h2 className="truncate font-display text-h3 font-bold tracking-tight">{order.order_number}</h2>
                <p className="text-small text-sonic-muted">
                  Placed {formatDate(order.placed_at)} · {formatTimestampTime(order.placed_at)}
                </p>
              </div>
              <StatusBadge status={status} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-sonic-border pt-3">
              <p className="text-small text-sonic-muted">Last updated {formatTimestampTime(lastUpdated)}</p>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-small font-semibold text-sonic-blue transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </section>

          {/* Progress stepper */}
          <section aria-labelledby="progress-title" className={cardClass}>
            <h2 id="progress-title" className="font-display text-h3 font-semibold">
              Order progress
            </h2>
            <p className="mt-1 mb-4 text-small text-sonic-muted">
              {ORDER_STATUS_MESSAGES[status]}
              {!isCancelled && lastChange && ` (${formatTimestampTime(lastChange.changed_at)})`}
            </p>
            <OrderStepper status={status} history={history} />
          </section>

          {/* Rider */}
          {rider && !isCancelled && (
            <section aria-labelledby="rider-title" className={`${cardClass} flex items-center justify-between gap-3`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50">
                  <Bike className="size-6 text-sonic-blue" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-caption text-sonic-muted">Your rider</p>
                  <h2 id="rider-title" className="truncate font-display text-base font-semibold">
                    {rider.full_name}
                  </h2>
                  <p className="truncate text-small text-sonic-muted">
                    {rider.vehicle_type}
                    {rider.plate_number && ` · ${rider.plate_number}`}
                  </p>
                  <p className="text-small text-sonic-ink">{formatPhone(rider.contact_number)}</p>
                </div>
              </div>
              {status !== 'delivered' && (
                <a
                  href={`tel:${rider.contact_number}`}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-sonic-blue px-4 font-display text-small font-semibold text-white shadow-card transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue"
                >
                  <Phone className="size-4 fill-white" aria-hidden="true" />
                  Call
                </a>
              )}
            </section>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:sticky lg:top-24 lg:mt-0">
          {/* Delivery address + notes (snapshots saved with the order) */}
          <section className={`${cardClass} flex flex-col gap-3`}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50">
                <MapPin className="size-5 fill-sonic-blue text-sonic-blue-50" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-small text-sonic-muted">Delivery address</p>
                <p className="font-display text-small font-semibold">
                  {order.dropoff_street}, {order.dropoff_barangay}, {order.dropoff_city}
                </p>
                {order.dropoff_landmark && <p className="text-small text-sonic-muted">{order.dropoff_landmark}</p>}
              </div>
            </div>
            {order.order_notes && (
              <div className="flex items-start gap-2 rounded-lg bg-sonic-bg p-3">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-sonic-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-caption text-sonic-muted">Order notes</p>
                  <p className="text-small text-sonic-ink">“{order.order_notes}”</p>
                </div>
              </div>
            )}
          </section>

          {/* Items by store + totals + payment */}
          <section aria-labelledby="summary-title" className={`${cardClass} flex flex-col gap-3`}>
            <h2 id="summary-title" className="font-display text-h3 font-semibold">
              Order summary
            </h2>

            {stores.map((store) => (
              <div key={store.restaurant_id} className="flex flex-col gap-2 rounded-lg bg-sonic-bg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sonic-blue">
                    <Store className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate font-display text-small font-semibold">{store.name}</span>
                  </span>
                  <span className="shrink-0 text-caption text-sonic-muted">{store.is_primary ? 'Main store' : 'Extra store'}</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {store.items.map((item) => (
                    <li key={item.order_item_id} className="flex justify-between gap-3 text-body">
                      <span className="min-w-0">
                        {item.item_name} <span className="text-sonic-muted">×{item.quantity}</span>
                      </span>
                      <span className="shrink-0 font-display text-small font-semibold">
                        {formatMoney(orderItemsSubtotal([item]))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <dl className="flex flex-col gap-1.5 text-small">
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">Items subtotal</dt>
                <dd>{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-sonic-muted">Delivery fee ({order.dropoff_barangay})</dt>
                <dd>{formatMoney(order.base_delivery_fee)}</dd>
              </div>
              {extraFees > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-sonic-muted">Extra-store fee</dt>
                  <dd>{formatMoney(extraFees)}</dd>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between gap-3 rounded-lg bg-sonic-blue-50 px-3 py-2">
                <dt className="font-display text-base font-semibold text-sonic-ink">Total</dt>
                <dd className="font-display text-h3 font-bold text-sonic-blue">{formatMoney(total)}</dd>
              </div>
            </dl>

            {payment && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-sonic-bg px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-small font-semibold text-sonic-ink">
                  {payment.payment_method === 'cod' ? (
                    <Banknote className="size-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Wallet className="size-4 text-sonic-blue" aria-hidden="true" />
                  )}
                  {PAYMENT_METHOD_LABELS[payment.payment_method]}
                </span>
                <span
                  className={`text-right text-small ${payment.payment_status === 'paid' ? 'font-semibold text-green-700' : 'text-sonic-ink'}`}
                >
                  {paymentText}
                </span>
              </div>
            )}
          </section>

          {/* Actions: cancel only while pending, rate only after delivered */}
          {status === 'pending' && (
            <Button variant="danger" fullWidth onClick={openCancel}>
              <XCircle className="size-5" aria-hidden="true" />
              Cancel order
            </Button>
          )}
          {status === 'delivered' && (
            <Button fullWidth onClick={() => navigate(`/customer/orders/${order.order_id}/rate`)}>
              <Star className="size-5 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
              Rate your order
            </Button>
          )}
        </div>
      </div>

      {/* Cancel confirmation (customer_orders.cancellation_reason) */}
      <BottomSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        icon={XCircle}
        title="Cancel this order?"
        description={`Let us know why you're cancelling ${order.order_number}.`}
      >
        <form onSubmit={handleCancel} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancellation_reason" className="text-body font-medium text-sonic-ink">
              Reason for cancelling<span className="ml-0.5 text-red-600">*</span>
            </label>
            <textarea
              id="cancellation_reason"
              rows={3}
              maxLength={300}
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                setCancelError('')
              }}
              placeholder="e.g. Changed my mind / Ordered by mistake"
              aria-invalid={cancelError ? true : undefined}
              aria-describedby={cancelError ? 'cancel-error' : undefined}
              className={`w-full resize-none rounded-xl border bg-white p-3 text-base text-sonic-ink transition outline-none placeholder:text-sonic-muted/70 focus:ring-3 md:text-body ${
                cancelError
                  ? 'border-red-600 focus:ring-red-600/25'
                  : 'border-sonic-border focus:border-sonic-blue focus:ring-sonic-blue/25'
              }`}
            />
            {cancelError && (
              <p id="cancel-error" className="flex items-start gap-1.5 text-small font-medium text-red-600">
                <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
                {cancelError}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button type="submit" variant="danger" fullWidth disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  )
}
