import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@shared/auth/LoginPage'
import RequireRole from '@shared/auth/RequireRole'
import SignupPage from '@shared/auth/SignupPage'
import RiderLayout from '@rider/layout/RiderLayout'
import Dashboard from '@rider/pages/Dashboard'
import Deliveries from '@rider/pages/Deliveries'
import DeliveryDetails from '@rider/pages/DeliveryDetails'
import History from '@rider/pages/History'
import Wallet from '@rider/pages/Wallet'

// Everything under /rider. Mounted by app/App.jsx at "/rider/*".
export default function RiderRoutes() {
  return (
    <Routes>
      {/* Open to everyone: log in, or apply (an operator approves the account) */}
      <Route path="login" element={<LoginPage role="rider" />} />
      <Route path="apply" element={<SignupPage role="rider" />} />

      {/* Riders only: top bar + bottom navigation */}
      <Route
        element={
          <RequireRole roles={['rider']} loginPath="/rider/login">
            <RiderLayout />
          </RequireRole>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="deliveries/:orderId" element={<DeliveryDetails />} />
        <Route path="history" element={<History />} />
        <Route path="wallet" element={<Wallet />} />
      </Route>

      <Route path="*" element={<Navigate to="/rider" replace />} />
    </Routes>
  )
}
