import { Navigate } from 'react-router-dom'
import { HOME_BY_ROLE, useAuth } from '../context/AuthContext'

// Only lets users with one of the given roles see the page.
// Not logged in → /login. Wrong role → back to their own home page.
export default function RequireRole({ roles, children }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  return children
}
