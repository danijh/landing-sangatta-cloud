import { useCallback, useEffect, useState } from 'react'

export function usePublicSession() {
  const [sessionClient, setSessionClient] = useState(null)
  const [csrfToken, setCsrfToken] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/fossbilling-auth.php?action=status', { credentials: 'same-origin', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result?.authenticated) {
          setSessionClient(result.client || {})
          setCsrfToken(result.csrfToken || '')
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrfToken },
      })
      const result = await response.json()
      if (!response.ok || result.result !== true) throw new Error('Logout failed')
      setSessionClient(null)
      setCsrfToken('')
    } catch (error) {
      console.error('Unable to sign out:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }, [csrfToken])

  return { sessionClient, csrfToken, isLoggingOut, logout }
}
