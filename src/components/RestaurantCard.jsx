import { Link } from 'react-router-dom'
import { Clock, Store } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatTodayHours } from '../lib/format'

// Restaurant card from DESIGN.md: 16:9 photo with Open/Closed badge, name, cuisine chips, today's hours.
// Closed restaurants are faded and say they are not accepting orders.
export default function RestaurantCard({ restaurant }) {
  const isClosed = restaurant.open_status === 'closed'

  return (
    <Link
      to={`/customer/restaurants/${restaurant.restaurant_id}`}
      className={`flex flex-col gap-3 rounded-xl bg-white p-3 shadow-card transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue active:scale-[0.99] ${isClosed ? 'opacity-75' : ''}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-sonic-blue-50">
        {restaurant.logo_url ? (
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            className={`size-full object-cover ${isClosed ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Store className="size-12 text-sonic-blue/40" aria-hidden="true" />
          </div>
        )}
        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={restaurant.open_status} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`truncate font-display text-base font-semibold ${isClosed ? 'text-sonic-muted' : 'text-sonic-ink'}`}>
            {restaurant.name}
          </h3>
          {isClosed && (
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-caption font-semibold text-red-600">
              Not accepting orders
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {restaurant.cuisines.map((cuisine) => (
            <span key={cuisine} className="rounded-full bg-sonic-bg px-2 py-0.5 text-caption font-medium text-sonic-muted">
              {cuisine}
            </span>
          ))}
        </div>

        <p className={`flex items-center gap-1.5 pt-0.5 text-small font-medium ${isClosed ? 'text-red-600' : 'text-sonic-muted'}`}>
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {formatTodayHours(restaurant.hours)}
        </p>
      </div>
    </Link>
  )
}
