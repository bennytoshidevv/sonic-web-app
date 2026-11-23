import { Ban, Plus, UtensilsCrossed } from 'lucide-react'
import { formatMoney } from '@shared/utils/format'

// Menu item row from DESIGN.md: name, short description and price on the left,
// photo thumbnail with a round "+" button on the right.
// Sold-out items are grayed with a red badge. `canOrder` is false when the restaurant is closed.
export default function MenuItemRow({ item, quantity, canOrder, onAdd }) {
  const soldOut = !item.is_available
  const disabled = soldOut || !canOrder

  return (
    <div className={`flex items-center gap-4 rounded-xl bg-white p-4 shadow-card ${soldOut ? 'opacity-65' : ''}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="font-display text-base font-semibold text-sonic-ink">{item.name}</h4>
          {soldOut && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-caption font-semibold text-red-600">Sold out</span>
          )}
        </div>
        {item.description && <p className="line-clamp-2 text-small text-sonic-muted">{item.description}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className={`font-display text-h3 font-bold ${soldOut ? 'text-sonic-muted' : 'text-sonic-blue'}`}>
            {formatMoney(item.price)}
          </span>
          {quantity > 0 && (
            <span className="rounded-full bg-sonic-blue-50 px-2 py-0.5 text-caption font-semibold text-sonic-blue">
              {quantity} in cart
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <div className={`flex size-18 items-center justify-center overflow-hidden rounded-lg bg-sonic-blue-50 ${soldOut ? 'grayscale' : ''}`}>
          {item.photo_url ? (
            <img src={item.photo_url} alt={item.name} className="size-full object-cover" />
          ) : (
            <UtensilsCrossed className="size-7 text-sonic-blue/40" aria-hidden="true" />
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          aria-label={soldOut ? `${item.name} is sold out` : `Add ${item.name}`}
          className="-mt-4 mr-1 flex size-10 items-center justify-center rounded-full bg-sonic-blue text-white shadow-card transition hover:bg-sonic-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue active:scale-90 disabled:cursor-not-allowed disabled:bg-sonic-border disabled:text-sonic-muted disabled:shadow-none"
        >
          {soldOut ? <Ban className="size-5" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
