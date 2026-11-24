import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import logo from '@shared/assets/logo.jpg'
import BottomSheet from '@shared/components/BottomSheet'
import Button from '@shared/components/Button'
import { useAuth } from '@shared/auth/AuthContext'

// Desktop-first layout shared by the Operator and Admin sections (DESIGN.md: left sidebar in
// sonic-ink with white icons and a sonic-blue active item; content in white cards on sonic-bg).
//   roleLabel: "Operator" or "Admin"
//   navItems:  [{ to, label, Icon, end }]
//   loginPath: where to go after logging out
// On phones and tablets the sidebar becomes a dark bar on top with the menu in one row.
export default function StaffLayout({ roleLabel, navItems, loginPath }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  function handleLogout() {
    signOut()
    navigate(loginPath)
  }

  return (
    <div className="min-h-screen bg-sonic-bg lg:flex">
      {/* Sidebar */}
      <aside className="bg-sonic-ink text-white print:hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center gap-3 px-4 py-3 lg:flex-col lg:items-start lg:px-5 lg:py-6">
          <img src={logo} alt="Super Sonic Delivery" className="aspect-[2/1] h-11 rounded-md bg-white object-cover lg:h-14" />
          <p className="text-caption tracking-wider text-white/60 uppercase">{roleLabel}</p>
        </div>
        <nav aria-label={roleLabel} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 font-display text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-white ${
                  isActive ? 'bg-sonic-blue text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="hidden border-t border-white/10 px-5 py-4 text-small text-white/70 lg:block">
          Logged in as <span className="font-semibold text-white">{user.full_name}</span>
        </p>
      </aside>

      {/* Top bar + page content. min-w-0 lets wide tables scroll inside their own box instead of widening the page. */}
      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-white/90 px-4 shadow-card backdrop-blur-xl print:hidden md:px-8">
          <p className="font-display text-base font-semibold">Hi, {user.full_name.split(' ')[0]}</p>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-small font-semibold text-sonic-muted transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-sonic-blue"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Log out
          </button>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <BottomSheet open={confirmLogout} onClose={() => setConfirmLogout(false)} icon={LogOut} title="Log out?">
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
