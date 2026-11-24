import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@shared/auth/LoginPage'
import RequireRole from '@shared/auth/RequireRole'
import SignupPage from '@shared/auth/SignupPage'
import { CartProvider } from '@customer/context/CartContext'
import CustomerLayout from '@customer/layout/CustomerLayout'
import Cart from '@customer/pages/Cart'
import Checkout from '@customer/pages/Checkout'
import Home from '@customer/pages/Home'
import Orders from '@customer/pages/Orders'
import OrderTracking from '@customer/pages/OrderTracking'
import Profile from '@customer/pages/Profile'
import RateOrder from '@customer/pages/RateOrder'
import RestaurantMenu from '@customer/pages/RestaurantMenu'

// Everything under /customer. Mounted by app/App.jsx at "/customer/*", so the paths here are relative.
export default function CustomerRoutes() {
  return (
    <Routes>
      {/* Open to everyone */}
      <Route path="login" element={<LoginPage role="customer" />} />
      <Route path="register" element={<SignupPage role="customer" />} />

      {/* Customers only: top bar + bottom navigation, cart available on every page */}
      <Route
        element={
          <RequireRole roles={['customer']} loginPath="/customer/login">
            <CartProvider>
              <CustomerLayout />
            </CartProvider>
          </RequireRole>
        }
      >
        <Route index element={<Home />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantMenu />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:orderId" element={<OrderTracking />} />
        <Route path="orders/:orderId/rate" element={<RateOrder />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/customer" replace />} />
    </Routes>
  )
}
