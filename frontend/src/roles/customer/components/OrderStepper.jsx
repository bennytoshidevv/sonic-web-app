import { Check, X } from 'lucide-react'
import { ORDER_STATUS_LABELS, ORDER_STEPS } from '@shared/utils/labels'
import { formatTimestampTime } from '@shared/utils/format'

// Vertical order-tracking stepper from DESIGN.md: sky-blue line, filled sonic-blue dots for
// completed steps. Times come from order_status_history.
// A cancelled order shows only the steps it reached, then a red "Cancelled" step.
export default function OrderStepper({ status, history }) {
  // Time of each status (the latest change wins)
  const times = {}
  // (the first row per status: a later row with the same status only adds a remark, e.g. "payment received")
  for (const row of history) times[row.status] ??= row.changed_at

  let steps
  if (status === 'cancelled') {
    steps = [
      ...ORDER_STEPS.filter((step) => times[step]).map((step) => ({ step, state: 'done' })),
      { step: 'cancelled', state: 'cancelled' },
    ]
  } else {
    const current = ORDER_STEPS.indexOf(status)
    steps = ORDER_STEPS.map((step, index) => {
      let state = 'upcoming'
      if (index < current || status === 'delivered') state = 'done'
      else if (index === current) state = 'active'
      return { step, state }
    })
  }

  return (
    <ol className="flex flex-col">
      {steps.map(({ step, state }, index) => {
        const isLast = index === steps.length - 1
        return (
          <li key={step} className="flex gap-3" aria-current={state === 'active' ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <StepDot state={state} />
              {!isLast && <div className={`my-1 min-h-5 w-0.5 flex-1 ${state === 'done' ? 'bg-sonic-sky' : 'bg-sonic-border'}`} />}
            </div>
            <div className={`flex min-w-0 flex-1 items-start justify-between gap-3 ${isLast ? '' : 'pb-4'}`}>
              <span
                className={`font-display text-small font-semibold ${
                  state === 'upcoming' ? 'text-sonic-muted' : state === 'cancelled' ? 'text-red-600' : 'text-sonic-ink'
                }`}
              >
                {ORDER_STATUS_LABELS[step]}
                <span className="sr-only">
                  {state === 'done' ? ' (done)' : state === 'active' ? ' (current step)' : state === 'upcoming' ? ' (not yet)' : ''}
                </span>
              </span>
              <span className="shrink-0 text-small text-sonic-muted">
                {times[step] && state !== 'upcoming' ? formatTimestampTime(times[step]) : ''}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StepDot({ state }) {
  if (state === 'done') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sonic-blue text-white shadow-card">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sonic-violet/15">
        <span className="size-2.5 animate-pulse rounded-full bg-sonic-violet" />
      </span>
    )
  }
  if (state === 'cancelled') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
        <X className="size-3.5" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sonic-bg">
      <span className="size-2 rounded-full bg-sonic-border" />
    </span>
  )
}
