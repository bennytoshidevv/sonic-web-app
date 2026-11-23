// Short message near the bottom of the screen, above the cart bar (e.g. "Link copied").
// Pass an empty message to hide it.
export default function Toast({ message }) {
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
      {message && (
        <p className="rounded-full bg-sonic-ink px-4 py-2 text-small font-medium text-white shadow-card">{message}</p>
      )}
    </div>
  )
}
