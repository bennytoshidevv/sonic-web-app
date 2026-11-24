import { useState } from 'react'
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react'

// Text input with a label above, optional left icon or prefix (e.g. "+63"),
// a hint or error message below, and a show/hide button for passwords.
// hideLabel: keep the label for screen readers only (e.g. a search box).
// onClear:   shows an "x" button that clears the field while it has text.
export default function Input({
  label,
  id,
  type = 'text',
  error,
  hint,
  icon: Icon,
  prefix,
  required = false,
  hideLabel = false,
  onClear,
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const messageId = `${id}-message`
  const message = error || hint

  const borderClasses = error
    ? 'border-red-600 focus-within:ring-red-600/25'
    : 'border-sonic-border focus-within:border-sonic-blue focus-within:ring-sonic-blue/25'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-body font-medium text-sonic-ink'}>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>

      <div
        className={`flex h-12 items-center gap-2.5 rounded-xl border bg-white px-3.5 transition focus-within:ring-3 ${borderClasses}`}
      >
        {Icon && <Icon className="size-5 shrink-0 text-sonic-muted" aria-hidden="true" />}
        {prefix && (
          <span className="shrink-0 rounded-lg bg-sonic-blue-50 px-2 py-0.5 text-small font-semibold text-sonic-ink">
            {prefix}
          </span>
        )}

        {/* 16px text on phones stops iOS from zooming in when the field is tapped */}
        <input
          id={id}
          name={id}
          type={isPassword && showPassword ? 'text' : type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="h-full w-full min-w-0 bg-transparent text-base text-sonic-ink outline-none placeholder:text-sonic-muted/70 md:text-body"
          {...rest}
        />

        {onClear && rest.value && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-sonic-muted transition hover:text-sonic-ink focus-visible:outline-2 focus-visible:outline-sonic-blue"
          >
            <X className="size-5" />
          </button>
        )}

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-sonic-muted transition hover:text-sonic-ink focus-visible:outline-2 focus-visible:outline-sonic-blue"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>

      {error && (
        <p id={messageId} className="flex items-start gap-1.5 text-small font-medium text-red-600">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={messageId} className="text-small text-sonic-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
