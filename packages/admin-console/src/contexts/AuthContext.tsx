import { createContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { client } from '@/lib/client'

interface AuthContextType {
  accessToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state on mount by attempting to refresh token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to refresh using the HTTP-only cookie
        const response = await client.auth.refresh.post({})

        if (response.data?.accessToken) {
          setAccessToken(response.data.accessToken)
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await client.auth.login.post({
        email,
        password,
      })

      if (response.error) {
        return { success: false, error: 'Invalid credentials' }
      }

      if (response.data?.accessToken) {
        setAccessToken(response.data.accessToken)
        return { success: true }
      }

      return { success: false, error: 'Login failed' }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'An error occurred during login' }
    }
  }

  const register = async (email: string, password: string) => {
    try {
      const response = await client.auth['register-admin'].post({
        email,
        password,
      })

      if (response.error) {
        return { success: false, error: 'Registration failed' }
      }

      if (response.data?.accessToken) {
        setAccessToken(response.data.accessToken)
        return { success: true }
      }

      return { success: false, error: 'Registration failed' }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: 'An error occurred during registration' }
    }
  }

  const logout = async () => {
    try {
      // Call backend to revoke refresh token
      await client.auth.logout.post({})
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local state regardless of API response
      setAccessToken(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: !!accessToken,
        login,
        register,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Export the context for use in hooks
export { AuthContext }
