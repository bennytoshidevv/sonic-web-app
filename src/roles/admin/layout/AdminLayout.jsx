import { BarChart3, ClipboardList, HandCoins, PiggyBank, Settings, Store, Users, UtensilsCrossed } from 'lucide-react'
import StaffLayout from '@shared/layouts/StaffLayout'

// Admin menu: admin-only screens first, then the operator screens (same pages, under /admin).
const NAV_ITEMS = [
  { to: '/admin', label: 'Reports', Icon: BarChart3, end: true },
  { to: '/admin/rider-savings', label: 'Rider savings', Icon: PiggyBank },
  { to: '/admin/settings', label: 'Settings', Icon: Settings },
  { to: '/admin/live-orders', label: 'Live orders', Icon: ClipboardList },
  { to: '/admin/restaurants', label: 'Restaurants', Icon: Store },
  { to: '/admin/menus', label: 'Menus', Icon: UtensilsCrossed },
  { to: '/admin/users', label: 'Riders & customers', Icon: Users },
  { to: '/admin/settlements', label: 'Settlements', Icon: HandCoins },
]

export default function AdminLayout() {
  return <StaffLayout roleLabel="Admin" navItems={NAV_ITEMS} loginPath="/admin/login" />
}
