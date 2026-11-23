import { useEffect } from 'react'

// Dialog that slides up from the bottom on phones and shows as a centered box from tablet up.
// Closes with the Escape key or by tapping the dark background.
// icon: optional Lucide icon shown in a circle next to the title and description.
// children: the action buttons, shown full width below.
// wide: a wider dialog from tablet up (for bigger staff forms).
export default function BottomSheet({ open, onClose, title, description, icon: Icon, wide = false, children }) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sonic-ink/50 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-card md:rounded-xl`}
      >
        <div aria-hidden="true" className="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-sonic-border md:hidden" />
        <div className="flex items-start gap-4">
          {Icon && (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sonic-blue-50 text-sonic-blue">
              <Icon className="size-6" aria-hidden="true" />
            </span>
          )}
          <div>
            <h3 id="sheet-title" className="font-display text-h3 font-semibold text-sonic-ink">
              {title}
            </h3>
            {description && <div className="mt-1 text-body text-sonic-muted">{description}</div>}
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
