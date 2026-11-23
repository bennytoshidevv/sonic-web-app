import { useNavigate } from 'react-router-dom'
import Button from '@shared/components/Button'
import { LOGIN_BY_ROLE, useAuth } from '@shared/auth/AuthContext'

// Temporary landing page for each role until the real screens are built.
export default function Placeholder({ title }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  function handleLogout() {
    const loginPath = LOGIN_BY_ROLE[user.role] // read before signing out
    signOut()
    navigate(loginPath)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-card">
        <h1 className="font-display text-h1 font-bold">{title}</h1>
        <p className="mt-2 text-sonic-muted">
          Logged in as {user.full_name} ({user.role}). This screen is coming soon.
        </p>
        <Button variant="secondary" onClick={handleLogout} className="mt-6">
          Log out
        </Button>
      </div>
    </div>
  )
}
