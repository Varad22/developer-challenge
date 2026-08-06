import { FormEvent, useEffect, useState } from "react";
import { Rater } from "../types";
import { Session } from "../session";

interface LoginPageProps {
  onLogin: (session: Session) => void;
}

type LoginRole = "admin" | "rater";

function LoginPage({ onLogin }: LoginPageProps) {
  const [role, setRole] = useState<LoginRole>("rater");
  const [raters, setRaters] = useState<Rater[]>([]);
  const [rater, setRater] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/raters")
      .then((res) => res.json())
      .then((list: Rater[]) => {
        setRaters(list);
        if (list.length > 0) {
          setRater(list[0].name);
        }
      })
      .catch(() => setError("Could not reach the backend. Is it running?"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const endpoint = role === "admin" ? "/api/login" : "/api/rater/login";
    const body =
      role === "admin"
        ? { password }
        : { rater, password };

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
      onLogin({ role: "rater", token: data.token, rater: data.rater });
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

          {role === "rater" ? (
            <>
              <label className="mb-4 block text-sm text-slate-300">
                Sign in as
                <select
                  value={rater}
                  onChange={(e) => setRater(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
                >
                  {raters.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mb-4 text-sm text-slate-400">
                Rate movies with your wallet on-chain. Demo password matches the
                persona name.
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
            autoFocus
            className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-400"
          />

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending || !password || (role === "rater" && !rater)}
            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Continue to movies"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Demo: admin password is <span className="text-slate-400">blockbuster</span>
            ; rater passwords are{" "}
            <span className="text-slate-400">alice</span>,{" "}
            <span className="text-slate-400">bob</span>, or{" "}
            <span className="text-slate-400">carol</span>.
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
