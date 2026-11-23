import { ClipboardList, HandCoins, Store, Users, UtensilsCrossed } from 'lucide-react'
import StaffLayout from '@shared/layouts/StaffLayout'

// Operator menu (the admin menu repeats these items under /admin)
export const OPERATOR_NAV_ITEMS = [
  { to: '/operator', label: 'Live orders', Icon: ClipboardList, end: true },
  { to: '/operator/restaurants', label: 'Restaurants', Icon: Store },
  { to: '/operator/menus', label: 'Menus', Icon: UtensilsCrossed },
  { to: '/operator/users', label: 'Riders & customers', Icon: Users },
  { to: '/operator/settlements', label: 'Settlements', Icon: HandCoins },
]

export default function OperatorLayout() {
  return <StaffLayout roleLabel="Operator" navItems={OPERATOR_NAV_ITEMS} loginPath="/operator/login" />
}
