import { FormEvent, useState } from "react";
import { Session } from "../session";

interface LoginPageProps {
  onLogin: (session: Session) => void;
}

type LoginRole = "admin" | "rater";
type RaterMode = "login" | "register";

function LoginPage({ onLogin }: LoginPageProps) {
  const [role, setRole] = useState<LoginRole>("rater");
  const [raterMode, setRaterMode] = useState<RaterMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (role === "rater" && raterMode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setPending(true);

    let endpoint = "/api/login";
    let body: Record<string, string> = { password };

    if (role === "rater") {
      endpoint =
        raterMode === "register" ? "/api/rater/register" : "/api/rater/login";
      body = { username, password };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    if (role === "admin") {
      onLogin({ role: "admin", token: data.token });
    } else {
      onLogin({
        role: "rater",
        token: data.token,
        username: data.username,
      });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            <span className="text-amber-400">Block</span>buster
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            On-chain movie ratings with Hyperledger FireFly
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-700 bg-slate-800/60 p-8 shadow-lg"
        >
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => {
                setRole("rater");
                setPassword("");
                setConfirmPassword("");
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                role === "rater"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Rater
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("admin");
                setPassword("");
                setConfirmPassword("");
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                role === "admin"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Admin
            </button>
          </div>

          {role === "rater" && (
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-700 p-1">
              <button
                type="button"
                onClick={() => {
                  setRaterMode("login");
                  setError(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  raterMode === "login"
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setRaterMode("register");
                  setError(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  raterMode === "register"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Register
              </button>
            </div>
          )}

          {role === "rater" ? (
            <>
              <label className="mb-4 block text-sm text-slate-300">
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trimStart())}
                  placeholder="your_name"
                  autoComplete="username"
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
                />
              </label>
              <p className="mb-4 text-sm text-slate-400">
                {raterMode === "register"
                  ? "Registration creates a dedicated FireFly wallet for your on-chain ratings."
                  : "Sign in to rate movies with your registered wallet."}
              </p>
            </>
          ) : (
            <p className="mb-4 text-sm text-slate-400">
              Add movies to the catalog. Only the admin wallet can publish new
              titles.
            </p>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={
              role === "rater" && raterMode === "register"
                ? "new-password"
                : "current-password"
            }
            className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
          />

          {role === "rater" && raterMode === "register" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
            />
          )}

          {error && (
            <p className="mb-3 text-sm text-red-400">
              {error}
              {error === "Username is already taken" && (
                <span className="block mt-1 text-slate-400">
                  Switch to <strong className="text-slate-300">Sign in</strong> if you
                  registered this username before.
                </span>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={
              pending ||
              !password ||
              (role === "rater" &&
                (!username ||
                  (raterMode === "register" && !confirmPassword)))
            }
            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Please wait..."
              : role === "admin"
                ? "Continue to movies"
                : raterMode === "register"
                  ? "Create account"
                  : "Sign in"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Admin demo password: <span className="text-slate-400">blockbuster</span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
