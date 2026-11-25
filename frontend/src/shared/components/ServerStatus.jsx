import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import Button from '@shared/components/Button'
import EmptyState from '@shared/components/EmptyState'
import { SERVER_DOWN_EVENT } from '@api/client'

// Wraps the whole app. When a page cannot load its data (the API is off or crashed), api/client.js sends
// SERVER_DOWN_EVENT and this shows one clear screen instead of a broken page.
// "Try again" shows the app again, so the page loads its data from the start.
export default function ServerStatus({ children }) {
  const [down, setDown] = useState(false)

  useEffect(() => {
    const show = () => setDown(true)
    window.addEventListener(SERVER_DOWN_EVENT, show)
    return () => window.removeEventListener(SERVER_DOWN_EVENT, show)
  }, [])

  if (!down) return children

  return (
    <main role="alert" className="flex min-h-screen items-center justify-center bg-sonic-bg p-4">
      <div className="w-full max-w-md">
        <EmptyState icon={WifiOff} title="Can't reach the server" text="Check your connection, then try again.">
          <Button onClick={() => setDown(false)}>Try again</Button>
        </EmptyState>
      </div>
    </main>
  )
}
