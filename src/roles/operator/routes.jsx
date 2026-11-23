import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@shared/auth/LoginPage'
import RequireRole from '@shared/auth/RequireRole'
import SignupPage from '@shared/auth/SignupPage'
import OperatorLayout from '@operator/layout/OperatorLayout'
import LiveOrders from '@operator/pages/LiveOrders'
import Menus from '@operator/pages/Menus'
import OrderDetails from '@operator/pages/OrderDetails'
import Restaurants from '@operator/pages/Restaurants'
import Settlements from '@operator/pages/Settlements'
import Users from '@operator/pages/Users'

// Everything under /operator. Mounted by app/App.jsx at "/operator/*".
export default function OperatorRoutes() {
  return (
    <Routes>
      {/* Open to everyone: log in, or apply (the admin approves the account) */}
      <Route path="login" element={<LoginPage role="operator" />} />
      <Route path="apply" element={<SignupPage role="operator" />} />

      {/* Operators (and admin, who can use everything the operator can): sidebar layout */}
      <Route
        element={
          <RequireRole roles={['operator', 'admin']} loginPath="/operator/login">
            <OperatorLayout />
          </RequireRole>
        }
      >
        <Route index element={<LiveOrders />} />
        <Route path="orders/:orderId" element={<OrderDetails />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="menus" element={<Menus />} />
        <Route path="users" element={<Users />} />
        <Route path="settlements" element={<Settlements />} />
      </Route>

      <Route path="*" element={<Navigate to="/operator" replace />} />
    </Routes>
  )
}
