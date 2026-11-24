import { useLocation } from 'react-router-dom'

// The operator pages are also used by the admin (under /admin/...). This returns the right links
// for the section the user is in, so a link on an operator page never jumps out of /admin.
export function useStaffPaths() {
  const isAdmin = useLocation().pathname.startsWith('/admin')
  const base = isAdmin ? '/admin' : '/operator'
  return {
    base,
    liveOrders: isAdmin ? '/admin/live-orders' : '/operator',
    order: (orderId) => `${base}/orders/${orderId}`,
    restaurants: `${base}/restaurants`,
    menus: (restaurantId) => (restaurantId ? `${base}/menus?restaurant=${restaurantId}` : `${base}/menus`),
    users: `${base}/users`,
    settlements: `${base}/settlements`,
  }
}
