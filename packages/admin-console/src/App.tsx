import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginScreen } from "./components/LoginScreen";
import { RegistrationScreen } from "./components/RegistrationScreen";
import { ChatScreen } from "./components/ChatScreen";
import { IngestionScreen } from "./components/IngestionScreen";
import { useAuth } from "./hooks/useAuth";

function App() {
  const [screen, setScreen] = useState<"login" | "register">("login");
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return screen === "login" ? (
      <LoginScreen onSwitchToRegister={() => setScreen("register")} />
    ) : (
      <RegistrationScreen onSwitchToLogin={() => setScreen("login")} />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="/ingestion" element={<IngestionScreen />} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
