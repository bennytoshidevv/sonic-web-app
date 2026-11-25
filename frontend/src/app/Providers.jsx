import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@shared/auth/AuthContext'
import ServerStatus from '@shared/components/ServerStatus'

// App-wide providers: the router, the "can't reach the server" screen and the logged-in user.
// (The cart provider is customer-only, so it lives in roles/customer/routes.jsx.)
export default function Providers({ children }) {
  return (
    <BrowserRouter>
      <ServerStatus>
        <AuthProvider>{children}</AuthProvider>
      </ServerStatus>
    </BrowserRouter>
  )
}
