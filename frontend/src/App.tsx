import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import MoviesPage from "./pages/MoviesPage";
import { clearSession, loadSession, saveSession, Session } from "./session";

function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  function handleLogin(nextSession: Session) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <MoviesPage session={session} onLogout={handleLogout} />;
}

export default App;
