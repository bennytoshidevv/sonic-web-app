// Pill filter button (e.g. cuisine filters). Blue when selected, white otherwise.
export default function Chip({ selected = false, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-10 shrink-0 rounded-full px-4 font-display text-small font-semibold whitespace-nowrap shadow-card transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sonic-blue active:scale-95 ${
        selected ? 'bg-sonic-blue text-white' : 'bg-white text-sonic-ink hover:bg-sonic-blue-50'
      }`}
      {...rest}
    >
      {children}
    </button>
  )
}
