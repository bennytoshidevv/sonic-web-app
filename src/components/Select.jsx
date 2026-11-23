import { AlertCircle, ChevronDown } from 'lucide-react'

// Dropdown with a label above and an error message below. Same look as Input.
// Pass the <option> elements as children.
export default function Select({ label, id, error, icon: Icon, required = false, children, ...rest }) {
  const messageId = `${id}-message`
  const borderClasses = error
    ? 'border-red-600 focus-within:ring-red-600/25'
    : 'border-sonic-border focus-within:border-sonic-blue focus-within:ring-sonic-blue/25'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body font-medium text-sonic-ink">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>

      <div className={`relative flex h-12 items-center gap-2.5 rounded-xl border bg-white px-3.5 transition focus-within:ring-3 ${borderClasses}`}>
        {Icon && <Icon className="size-5 shrink-0 text-sonic-muted" aria-hidden="true" />}
        <select
          id={id}
          name={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          className="h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-7 text-base text-sonic-ink outline-none md:text-body"
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 size-5 text-sonic-muted" aria-hidden="true" />
      </div>

      {error && (
        <p id={messageId} className="flex items-start gap-1.5 text-small font-medium text-red-600">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
