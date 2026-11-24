import { createContext, useContext, useState } from 'react'

// Keeps the logged-in user (without password) for the whole app.
// Saved in sessionStorage so a page refresh keeps you logged in.
const AuthContext = createContext(null)

const STORAGE_KEY = 'sonic_user'

// Where each role lands after login.
export const HOME_BY_ROLE = {
  customer: '/customer',
  rider: '/rider',
  operator: '/operator',
  admin: '/admin',
}

// Each role's own login page.
export const LOGIN_BY_ROLE = {
  customer: '/customer/login',
  rider: '/rider/login',
  operator: '/operator/login',
  admin: '/admin/login',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  })

  function signIn(loggedInUser) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser))
    setUser(loggedInUser)
  }

  function signOut() {
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
