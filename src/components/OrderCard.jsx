import { Link } from 'react-router-dom'
import { ArrowRight, Bike, Clock, Info, Phone, RotateCcw, Star, Store, Zap } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { averageRating, orderExtraStoreFees, orderItemsSubtotal, orderTotal } from '../lib/calc'
import { formatDate, formatMoney, formatTimestampTime } from '../lib/format'
import { ORDER_STATUS_MESSAGES } from '../lib/labels'

const primaryLink =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sonic-blue px-4 font-display text-small font-semibold text-white shadow-card transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue'
const softButton =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sonic-bg px-3.5 font-display text-small font-semibold text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue'

// One order in the My Orders list. `entry` comes from getCustomerOrders():
// { order, stores, history, payment, rider, reviews }.
// Active orders: Track order. Delivered: Reorder + Rate order (or "Rated 4.0"). Cancelled: reason + View details.
export default function OrderCard({ entry, onReorder }) {
  const { order, stores, rider, reviews } = entry
  const status = order.order_status
  const isCancelled = status === 'cancelled'
  const isDelivered = status === 'delivered'
  const isActive = !isCancelled && !isDelivered

  const items = stores.flatMap((store) => store.items)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = orderTotal(orderItemsSubtotal(items), order.base_delivery_fee, orderExtraStoreFees(stores))
  const rating = averageRating(reviews)
  const trackUrl = `/customer/orders/${order.order_id}`

  return (
    <article className={`flex flex-col gap-3 rounded-xl bg-white p-4 shadow-card ${isCancelled ? 'opacity-90' : ''}`}>
      {/* Stores + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-sonic-bg ${isCancelled ? 'text-sonic-muted' : 'text-sonic-blue'}`}
          >
            <Store className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold">{stores.map((s) => s.name).join(' + ')}</h3>
            <p className="truncate text-small text-sonic-muted">
              {stores.length > 1 && `${stores.length} stores · `}
              {order.order_number}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Date + items */}
      <div className="flex flex-col gap-1 rounded-lg bg-sonic-bg p-3">
        <p className="flex items-center gap-1.5 text-small text-sonic-muted">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {formatDate(order.placed_at)} · {formatTimestampTime(order.placed_at)}
        </p>
        <p className="line-clamp-2 text-small text-sonic-ink">
          <span className="font-semibold">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}:
          </span>{' '}
          {items.map((item) => `${item.item_name} ×${item.quantity}`).join(', ')}
        </p>
      </div>

      {/* What is happening now */}
      {isActive && rider && (status === 'picked_up' || status === 'on_the_way') ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-sonic-blue-50 p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonic-blue text-white">
              <Bike className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-small text-sonic-ink">
                Rider: <span className="font-semibold">{rider.full_name}</span>
              </p>
              <p className="flex items-center gap-1 text-caption text-sonic-blue-dark">
                <span className="size-1.5 rounded-full bg-green-600" aria-hidden="true" />
                {ORDER_STATUS_MESSAGES[status]}
              </p>
            </div>
          </div>
          <a
            href={`tel:${rider.contact_number}`}
            aria-label={`Call ${rider.full_name}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sonic-blue shadow-card transition hover:bg-sonic-blue hover:text-white"
          >
            <Phone className="size-4" aria-hidden="true" />
          </a>
        </div>
      ) : isActive ? (
        <p className="flex items-center gap-2 px-1 text-small text-sonic-muted">
          <Info className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
          {ORDER_STATUS_MESSAGES[status]}
        </p>
      ) : null}

      {isCancelled && order.cancellation_reason && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-small text-red-700">
          <Info className="size-4 shrink-0 text-red-600" aria-hidden="true" />
          Cancelled: {order.cancellation_reason}
        </p>
      )}

      {/* Total + actions */}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-1">
        <div className="flex items-end gap-2">
          <div>
            <span className="block text-small text-sonic-muted">Total</span>
            <span
              className={`font-display text-h3 font-bold ${
                isCancelled ? 'text-sonic-muted line-through' : isActive ? 'text-sonic-blue' : 'text-sonic-ink'
              }`}
            >
              {formatMoney(total)}
            </span>
          </div>
          {isDelivered && rating !== null && (
            <span className="mb-0.5 flex items-center gap-1 rounded-full bg-sonic-bg px-2.5 py-1 text-caption font-semibold">
              <Star className="size-3.5 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
              Rated {rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive && (
            <Link to={trackUrl} className={primaryLink}>
              Track order
              <Zap className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
            </Link>
          )}
          {isDelivered && (
            <>
              <button type="button" onClick={() => onReorder(entry)} className={rating === null ? softButton : primaryLink}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reorder
              </button>
              {rating === null && (
                <Link to={`${trackUrl}/rate`} className={primaryLink}>
                  <Star className="size-4 fill-sonic-bolt text-sonic-bolt" aria-hidden="true" />
                  Rate order
                </Link>
              )}
            </>
          )}
          {isCancelled && (
            <Link to={trackUrl} className={softButton}>
              View details
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
