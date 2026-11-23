import { Star } from 'lucide-react'

// 1–5 stars in sonic-bolt yellow (DESIGN.md). With onChange it is a radio group the user can tap;
// without onChange it only shows the rating.
export default function StarRating({ value, onChange, label, size = 'lg' }) {
  const starSize = size === 'lg' ? 'size-8' : 'size-4'

  if (!onChange) {
    return (
      <span className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${starSize} ${n <= value ? 'fill-sonic-bolt text-sonic-bolt' : 'fill-sonic-border text-sonic-border'}`}
            aria-hidden="true"
          />
        ))}
      </span>
    )
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(n)}
          className="flex size-11 items-center justify-center rounded-full transition hover:bg-sonic-bolt/15 focus-visible:outline-2 focus-visible:outline-sonic-blue active:scale-90"
        >
          <Star
            className={`${starSize} transition ${n <= value ? 'fill-sonic-bolt text-sonic-bolt' : 'fill-sonic-border text-sonic-border'}`}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  )
}
