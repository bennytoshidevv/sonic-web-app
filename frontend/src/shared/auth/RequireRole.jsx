import { Navigate } from 'react-router-dom'
import { HOME_BY_ROLE, useAuth } from '@shared/auth/AuthContext'

// Guards one role section (customer, rider, operator, admin).
//   roles:     who may open it, e.g. ['operator', 'admin']
//   loginPath: where to go when nobody is logged in, e.g. '/rider/login'
// Not logged in → loginPath. Logged in with another role → back to their own home page.
export default function RequireRole({ roles, loginPath, children }) {
  const { user } = useAuth()

  if (!user) return <Navigate to={loginPath} replace />
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />

  return children
}
