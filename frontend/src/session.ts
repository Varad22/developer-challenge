export type Session =
  | { role: "admin"; token: string }
  | { role: "rater"; token: string; rater: string };

const SESSION_KEY = "session";

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as Session;
    if (session.role === "admin" && session.token) {
      return session;
    }
    if (session.role === "rater" && session.token && session.rater) {
      return session;
    }
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }

  return null;
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
