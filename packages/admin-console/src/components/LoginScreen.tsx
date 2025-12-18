import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LockKeyhole } from 'lucide-react'

interface LoginScreenProps {
  onSwitchToRegister: () => void
}

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // TODO: Implement actual login logic here
    console.log('Login attempt:', { email, password })

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-neutral-50 dark:bg-neutral-950 p-4 pt-20">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 bg-neutral-900 dark:bg-neutral-100 rounded-lg flex items-center justify-center mb-2">
            <LockKeyhole className="w-6 h-6 text-neutral-50 dark:text-neutral-900" />
          </div>
          <CardTitle className="text-2xl font-bold">Boardgame Ref Admin Portal</CardTitle>
          <CardDescription>
            Enter your credentials to access the admin console
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Don't have an account?{' '}
            </span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-neutral-900 dark:text-neutral-100 font-medium hover:underline"
            >
              Register
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
