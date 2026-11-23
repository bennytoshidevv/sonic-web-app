import { Ban, Trash2, UtensilsCrossed, X } from 'lucide-react'
import Button from './Button'
import QuantityStepper from './QuantityStepper'
import { lineTotal } from '../lib/calc'
import { formatMoney } from '../lib/format'

// Why an item can no longer be ordered (set by the Cart page).
const PROBLEMS = {
  sold_out: { badge: 'Sold out', message: 'Sold out right now. Remove it to check out.' },
  closed: { badge: 'Closed', message: 'This restaurant is closed right now. Remove it to check out.' },
  removed: { badge: 'Unavailable', message: 'No longer on the menu. Remove it to check out.' },
}

// One item in the cart: photo, name, price each, line total and quantity stepper.
// Items with a `problem` are shown in red with a "Remove" button instead of the stepper.
export default function CartItemRow({ line, onIncrease, onDecrease, onRemove }) {
  const problem = line.problem ? PROBLEMS[line.problem] : null

  return (
    <div className={`flex gap-3 rounded-xl p-3 ${problem ? 'bg-red-50' : 'bg-sonic-bg'}`}>
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sonic-blue-50">
        {line.photo_url ? (
          <img src={line.photo_url} alt="" className={`size-full object-cover ${problem ? 'grayscale' : ''}`} />
        ) : (
          <UtensilsCrossed className="size-7 text-sonic-blue/40" aria-hidden="true" />
        )}
        {problem && (
          <div className="absolute inset-0 flex items-center justify-center bg-sonic-ink/30">
            <Ban className="size-6 text-white" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-sonic-ink">{line.name}</h3>
          {problem ? (
            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-caption font-semibold text-white">
              {problem.badge}
            </span>
          ) : (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${line.name}`}
              className="-mt-2 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-sonic-muted transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-sonic-blue"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {problem ? (
          <p className="mt-1 text-small font-medium text-red-600">{problem.message}</p>
        ) : (
          line.description && <p className="mt-0.5 line-clamp-1 text-small text-sonic-muted">{line.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-small text-sonic-muted">{formatMoney(line.price)} each</p>
            <p className={`font-display text-h3 font-bold ${problem ? 'text-sonic-muted line-through' : 'text-sonic-blue'}`}>
              {formatMoney(lineTotal(line))}
            </p>
          </div>
          {problem ? (
            <Button variant="danger" size="sm" onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          ) : (
            <QuantityStepper quantity={line.quantity} itemName={line.name} onDecrease={onDecrease} onIncrease={onIncrease} />
          )}
        </div>
      </div>
    </div>
  )
}
