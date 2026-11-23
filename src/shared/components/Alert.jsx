import { AlertCircle, Info } from 'lucide-react'

// Message box at the top of a form. variant: 'info' (blue) or 'error' (red).
const STYLES = {
  info: { box: 'bg-sonic-blue-50 text-sonic-ink', icon: 'text-sonic-blue', Icon: Info },
  error: { box: 'bg-red-50 text-red-700', icon: 'text-red-600', Icon: AlertCircle },
}

export default function Alert({ variant = 'info', title, children }) {
  const { box, icon, Icon } = STYLES[variant]

  return (
    <div role={variant === 'error' ? 'alert' : undefined} className={`flex items-start gap-2.5 rounded-xl p-3 ${box}`}>
      <Icon className={`mt-px size-5 shrink-0 ${icon}`} aria-hidden="true" />
      <p className="text-small">
        {title && <span className="font-semibold">{title} </span>}
        {children}
      </p>
    </div>
  )
}
