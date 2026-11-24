import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@shared/auth/AuthContext'

// App-wide providers: the router and the logged-in user.
// (The cart provider is customer-only, so it lives in roles/customer/routes.jsx.)
export default function Providers({ children }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )
}
