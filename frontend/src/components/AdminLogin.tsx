import { FormEvent, useState } from "react";

interface AdminLoginProps {
  onLogin: (token: string) => void;
  onBack: () => void;
}

function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await res.json();
    setPending(false);
    if (res.ok) {
      onLogin(body.token);
    } else {
      setError(body.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800/60 p-8 shadow-lg"
      >
        <h1 className="mb-1 text-xl font-bold text-slate-100">Admin login</h1>
        <p className="mb-6 text-sm text-slate-400">
          Only the admin can add movies to the catalog.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
        />
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending || !password}
          className="mb-3 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-200"
        >
          Back to movies
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
