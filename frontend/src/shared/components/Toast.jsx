// Short message near the bottom of the screen, above the cart bar (e.g. "Link copied").
// It is above the bottom sheets (z-50), so a failed save is visible while its form is still open.
// Pass an empty message to hide it.
export default function Toast({ message }) {
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-60 flex justify-center px-4 lg:bottom-8">
      {message && (
        <p className="rounded-full bg-sonic-ink px-4 py-2 text-small font-medium text-white shadow-card">{message}</p>
      )}
    </div>
  )
}
