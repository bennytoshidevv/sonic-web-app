import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@shared/auth/LoginPage'
import RequireRole from '@shared/auth/RequireRole'
import AdminLayout from '@admin/layout/AdminLayout'
import Reports from '@admin/pages/Reports'
import RiderSavings from '@admin/pages/RiderSavings'
import Settings from '@admin/pages/Settings'
// Admin reuses the operator's pages by importing them (no copies).
import LiveOrders from '@operator/pages/LiveOrders'
import Menus from '@operator/pages/Menus'
import OrderDetails from '@operator/pages/OrderDetails'
import Restaurants from '@operator/pages/Restaurants'
import Settlements from '@operator/pages/Settlements'
import Users from '@operator/pages/Users'

// Everything under /admin. Mounted by app/App.jsx at "/admin/*".
export default function AdminRoutes() {
  return (
    <Routes>
      {/* Log in only: there is no public sign-up for admin */}
      <Route path="login" element={<LoginPage role="admin" />} />

      {/* Admin only: sidebar layout with admin screens + the operator screens */}
      <Route
        element={
          <RequireRole roles={['admin']} loginPath="/admin/login">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Reports />} />
        <Route path="rider-savings" element={<RiderSavings />} />
        <Route path="settings" element={<Settings />} />
        <Route path="live-orders" element={<LiveOrders />} />
        <Route path="orders/:orderId" element={<OrderDetails />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="menus" element={<Menus />} />
        <Route path="users" element={<Users />} />
        <Route path="settlements" element={<Settlements />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
