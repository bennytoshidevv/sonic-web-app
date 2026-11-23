import { Zap } from 'lucide-react'

// "Nothing here" message with the brand lightning bolt (or another `icon` on a yellow circle).
// `children` is an optional action button.
export default function EmptyState({ title, text, icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white px-4 py-10 text-center shadow-card">
      {Icon ? (
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-sonic-bolt">
          <Icon className="size-8 text-sonic-ink" aria-hidden="true" />
        </div>
      ) : (
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-sonic-bolt/20">
          <Zap className="size-8 fill-sonic-bolt text-amber-500" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-h3 font-semibold text-sonic-ink">{title}</h3>
      <p className="mt-1 max-w-xs text-body text-sonic-muted">{text}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
