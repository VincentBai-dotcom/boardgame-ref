import { useState } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { RegistrationScreen } from './components/RegistrationScreen'

function App() {
  const [screen, setScreen] = useState<'login' | 'register'>('login')

  return screen === 'login' ? (
    <LoginScreen onSwitchToRegister={() => setScreen('register')} />
  ) : (
    <RegistrationScreen onSwitchToLogin={() => setScreen('login')} />
  )
}

export default App
