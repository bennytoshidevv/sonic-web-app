import { Minus, Plus, Trash2 } from 'lucide-react'

// − quantity + control. At quantity 1 the minus button becomes a trash button (removes the item).
export default function QuantityStepper({ quantity, itemName, onDecrease, onIncrease }) {
  const buttonClass =
    'flex size-9 items-center justify-center rounded-full text-sonic-ink transition hover:bg-sonic-blue-50 focus-visible:outline-2 focus-visible:outline-sonic-blue active:scale-90'

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-white p-1 shadow-card">
      <button
        type="button"
        onClick={onDecrease}
        aria-label={quantity === 1 ? `Remove ${itemName}` : `Decrease ${itemName} quantity`}
        className={buttonClass}
      >
        {quantity === 1 ? <Trash2 className="size-4 text-red-600" /> : <Minus className="size-4" />}
      </button>
      <span className="w-6 text-center font-display text-small font-bold" aria-live="polite">
        {quantity}
      </span>
      <button type="button" onClick={onIncrease} aria-label={`Increase ${itemName} quantity`} className={buttonClass}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}
