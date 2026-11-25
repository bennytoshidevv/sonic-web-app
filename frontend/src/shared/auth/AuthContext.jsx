import { createContext, useContext, useEffect, useState } from 'react'
import { SESSION_ENDED_EVENT, clearSession, isSessionError, loadSession, saveSession } from '@api/client'
import { getMe } from '@api'

// Keeps the logged-in user (without password) and their login token for the whole app.
// Saved in sessionStorage as { token, user } so a page refresh keeps you logged in.
// On load, the token is checked with the API (GET /api/auth/me): an expired token or a suspended
// account logs the user out, and the user's details are refreshed.
const AuthContext = createContext(null)

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
  const [user, setUser] = useState(() => loadSession()?.user ?? null)
  // True while the saved token is being checked. The pages wait for it, so they never load data
  // with an expired token.
  const [checking, setChecking] = useState(() => Boolean(loadSession()?.token))

  // Check the saved token once when the app opens.
  useEffect(() => {
    if (!loadSession()?.token) return
    getMe().then((result) => {
      if (result.user) {
        saveSession({ ...loadSession(), user: result.user })
        setUser(result.user)
      } else if (isSessionError(result)) {
        // Expired/invalid token or a blocked account (not a temporary server problem): log out.
        clearSession()
        setUser(null)
      }
      setChecking(false)
    })
  }, [])

  // The API stopped accepting the token while the app was open: log out (RequireRole shows the login page).
  useEffect(() => {
    function endSession() {
      clearSession()
      setUser(null)
    }
    window.addEventListener(SESSION_ENDED_EVENT, endSession)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, endSession)
  }, [])

  // After login/sign-up: signIn(user, token). After a profile edit: signIn(user) keeps the same token.
  function signIn(loggedInUser, token = loadSession()?.token) {
    saveSession({ token, user: loggedInUser })
    setUser(loggedInUser)
  }

  function signOut() {
    clearSession()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{checking ? null : children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
