import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from '@shared/pages/Welcome'
import CustomerRoutes from '@customer/routes'
import RiderRoutes from '@rider/routes'
import OperatorRoutes from '@operator/routes'
import AdminRoutes from '@admin/routes'

// Main router. Each role has its own section and its own routes.jsx:
//   /customer/*  → roles/customer/routes.jsx  (login at /customer/login)
//   /rider/*     → roles/rider/routes.jsx     (login at /rider/login)
//   /operator/*  → roles/operator/routes.jsx  (login at /operator/login)
//   /admin/*     → roles/admin/routes.jsx     (login at /admin/login)
// Each section checks the logged-in user's role itself (RequireRole).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />

      <Route path="/customer/*" element={<CustomerRoutes />} />
      <Route path="/rider/*" element={<RiderRoutes />} />
      <Route path="/operator/*" element={<OperatorRoutes />} />
      <Route path="/admin/*" element={<AdminRoutes />} />

      {/* Old links from before the restructure still work */}
      <Route path="/login" element={<Navigate to="/customer/login" replace />} />
      <Route path="/register" element={<Navigate to="/customer/register" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
