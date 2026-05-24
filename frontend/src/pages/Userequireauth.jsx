import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Returns a function that, when called, checks if the user is logged in.
 * If yes — runs the callback.
 * If no  — saves the current path and redirects to /login.
 *
 * Usage:
 *   const requireAuth = useRequireAuth()
 *   <button onClick={requireAuth(() => setOpenBooking(true))}>Book</button>
 */
export function useRequireAuth() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  return (callback) => (...args) => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname }, replace: false })
      return
    }
    callback?.(...args)
  }
}