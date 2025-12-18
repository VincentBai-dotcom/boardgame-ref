import { useState } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { RegistrationScreen } from './components/RegistrationScreen'
import { useAuth } from './hooks/useAuth'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { LogOut, Shield } from 'lucide-react'

function App() {
  const [screen, setScreen] = useState<'login' | 'register'>('login')
  const { isAuthenticated, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-neutral-50 dark:bg-neutral-950 p-4 pt-20">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-12 h-12 bg-neutral-900 dark:bg-neutral-100 rounded-lg flex items-center justify-center mb-2">
              <Shield className="w-6 h-6 text-neutral-50 dark:text-neutral-900" />
            </div>
            <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
            <CardDescription>
              You are successfully logged in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-neutral-600 dark:text-neutral-400">
              Welcome to the Boardgame Ref Admin Console
            </div>
            <Button onClick={logout} variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return screen === 'login' ? (
    <LoginScreen onSwitchToRegister={() => setScreen('register')} />
  ) : (
    <RegistrationScreen onSwitchToLogin={() => setScreen('login')} />
  )
}

export default App
