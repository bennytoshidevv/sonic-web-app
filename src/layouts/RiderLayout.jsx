import { useState } from 'react'
import { NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import { Bike, Gauge, LogOut, ReceiptText, Wallet } from 'lucide-react'
import logo from '../assets/logo.jpg'
import BottomSheet from '../components/BottomSheet'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/rider', label: 'Dashboard', Icon: Gauge, end: true },
  { to: '/rider/deliveries', label: 'Deliveries', Icon: Bike },
  { to: '/rider/history', label: 'History', Icon: ReceiptText },
  { to: '/rider/wallet', label: 'Wallet', Icon: Wallet },
]

// Shared layout for all rider pages (mobile-first, big touch targets). Handles the responsive behavior:
// - Phone + tablet: sticky top bar (logo + greeting + log out), bottom navigation.
// - Desktop (lg):   the navigation moves into the top bar and the bottom bar is hidden.
export default function RiderLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)
  // The delivery details page shows its own bottom action bar instead of the navigation
  const onDetailsPage = useMatch('/rider/deliveries/:orderId') !== null

  function handleLogout() {
    signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-sonic-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 shadow-card backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Super Sonic Delivery" className="aspect-[2/1] h-11 shrink-0 object-cover md:h-12" />
            <div className="min-w-0 border-l border-sonic-border pl-3">
              <p className="text-caption tracking-wider text-sonic-muted uppercase">Rider</p>
              <p className="truncate font-display text-base font-semibold">Hi, {user.full_name.split(' ')[0]}</p>
            </div>
          </div>

          {/* Desktop navigation */}
          <nav aria-label="Rider" className="hidden flex-1 justify-center gap-1 lg:flex">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-full px-4 font-display text-small font-semibold transition ${
                    isActive ? 'bg-sonic-blue-50 text-sonic-blue' : 'text-sonic-muted hover:text-sonic-ink'
                  }`
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-display text-small font-semibold text-sonic-muted transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-sonic-blue"
          >
            <LogOut className="size-5" aria-hidden="true" />
            <span className="hidden md:inline">Log out</span>
            <span className="sr-only md:hidden">Log out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 md:px-6 md:pt-6 lg:px-8 lg:pb-12">
        <Outlet />
      </main>

      {/* Bottom navigation (phone + tablet) */}
      <nav
        aria-label="Rider"
        className={`fixed inset-x-0 bottom-0 z-40 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(11,16,51,0.06)] backdrop-blur-xl lg:hidden print:hidden ${onDetailsPage ? 'hidden' : ''}`}
      >
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-1">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-caption transition ${
                  isActive ? 'font-semibold text-sonic-blue' : 'text-sonic-muted'
                }`
              }
            >
              <Icon className="size-6" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <BottomSheet
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        icon={LogOut}
        title="Log out?"
        description="Your shift stays open. Log in again to keep working."
      >
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button variant="danger" fullWidth autoFocus onClick={handleLogout}>
            Log out
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirmLogout(false)}>
            Stay logged in
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
