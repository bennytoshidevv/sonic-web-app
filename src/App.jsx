import { Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './components/RequireRole'
import CustomerLayout from './layouts/CustomerLayout'
import RiderLayout from './layouts/RiderLayout'
import { CartProvider } from './context/CartContext'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Cart from './pages/customer/Cart'
import Checkout from './pages/customer/Checkout'
import Home from './pages/customer/Home'
import OrderTracking from './pages/customer/OrderTracking'
import Profile from './pages/customer/Profile'
import Orders from './pages/customer/Orders'
import RateOrder from './pages/customer/RateOrder'
import RestaurantMenu from './pages/customer/RestaurantMenu'
import Placeholder from './pages/Placeholder'
import RiderDashboard from './pages/rider/Dashboard'
import RiderDeliveries from './pages/rider/Deliveries'
import DeliveryDetails from './pages/rider/DeliveryDetails'
import RiderHistory from './pages/rider/History'
import RiderWallet from './pages/rider/Wallet'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Customer pages share CustomerLayout (top bar + bottom navigation) */}
      <Route
        path="/customer"
        element={
          <RequireRole roles={['customer']}>
            <CartProvider>
              <CustomerLayout />
            </CartProvider>
          </RequireRole>
        }
      >
        <Route index element={<Home />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantMenu />} />
        <Route path="orders" element={<Orders />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="orders/:orderId" element={<OrderTracking />} />
        <Route path="orders/:orderId/rate" element={<RateOrder />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Rider pages share RiderLayout (top bar + bottom navigation) */}
      <Route
        path="/rider"
        element={
          <RequireRole roles={['rider']}>
            <RiderLayout />
          </RequireRole>
        }
      >
        <Route index element={<RiderDashboard />} />
        <Route path="deliveries" element={<RiderDeliveries />} />
        <Route path="deliveries/:orderId" element={<DeliveryDetails />} />
        <Route path="history" element={<RiderHistory />} />
        <Route path="wallet" element={<RiderWallet />} />
      </Route>
      {/* Admin can also open operator pages */}
      <Route
        path="/operator"
        element={
          <RequireRole roles={['operator', 'admin']}>
            <Placeholder title="Operator – Live orders" />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin']}>
            <Placeholder title="Admin – Reports" />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
