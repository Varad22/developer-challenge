import { useCallback, useEffect, useRef, useState } from "react";
import AddMovieForm from "./components/AddMovieForm";
import AdminLogin from "./components/AdminLogin";
import MovieCard from "./components/MovieCard";
import { ChainEvent, Movie, Rater } from "./types";

function App() {
  const [raters, setRaters] = useState<Rater[]>([]);
  const [rater, setRater] = useState<string>("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [pendingRatings, setPendingRatings] = useState<Set<number>>(new Set());
  const [addPending, setAddPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    sessionStorage.getItem("adminToken")
  );
  const [showLogin, setShowLogin] = useState(false);
  const raterRef = useRef(rater);
  raterRef.current = rater;

  const fetchMovies = useCallback(async (forRater: string) => {
    if (!forRater) return;
    const res = await fetch(`/api/movies?rater=${encodeURIComponent(forRater)}`);
    const body = await res.json();
    if (res.ok) {
      setMovies(body);
    } else {
      setErrorMsg(body.error);
    }
  }, []);

  useEffect(() => {
    fetch("/api/raters")
      .then((res) => res.json())
      .then((list: Rater[]) => {
        setRaters(list);
        if (list.length > 0) setRater(list[0].name);
      })
      .catch(() => setErrorMsg("Could not reach the backend. Is it running?"));
  }, []);

  useEffect(() => {
    fetchMovies(rater);
  }, [rater, fetchMovies]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      const event: ChainEvent = JSON.parse(message.data);
      if (event.name === "MovieAdded") {
        setAddPending(false);
      } else if (event.name === "MovieRated") {
        const movieId = Number(event.data.movieId);
        setPendingRatings((prev) => {
          const next = new Set(prev);
          next.delete(movieId);
          return next;
        });
      }
      fetchMovies(raterRef.current);
    };
    return () => source.close();
  }, [fetchMovies]);

  function login(token: string) {
    sessionStorage.setItem("adminToken", token);
    setAdminToken(token);
    setShowLogin(false);
  }

  function logout() {
    sessionStorage.removeItem("adminToken");
    setAdminToken(null);
  }

  async function addMovie(title: string, year: number) {
    setErrorMsg(null);
    setAddPending(true);
    const res = await fetch("/api/movies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ title, year }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErrorMsg(error);
      setAddPending(false);
      if (res.status === 401) logout();
    }
  }

  async function rateMovie(movieId: number, stars: number) {
    setErrorMsg(null);
    setPendingRatings((prev) => new Set(prev).add(movieId));
    const res = await fetch(`/api/movies/${movieId}/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, rater }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErrorMsg(error);
      setPendingRatings((prev) => {
        const next = new Set(prev);
        next.delete(movieId);
        return next;
      });
    }
  }

  if (showLogin && !adminToken) {
    return <AdminLogin onLogin={login} onBack={() => setShowLogin(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-amber-400">Block</span>buster
            </h1>
            <p className="text-sm text-slate-400">
              Movie ratings, sealed on-chain with Hyperledger FireFly
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`flex items-center gap-1.5 text-xs ${
                connected ? "text-emerald-400" : "text-red-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              {connected ? "live" : "offline"}
            </span>
            {adminToken ? (
              <span className="rounded-lg bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-300">
                admin
              </span>
            ) : (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                Rating as
                <select
                  value={rater}
                  onChange={(e) => setRater(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-amber-400"
                >
                  {raters.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {adminToken ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-sm text-amber-300 transition-colors hover:bg-amber-400/10"
              >
                Log out admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-slate-400"
              >
                Admin login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {adminToken && (
          <section className="mb-8 rounded-xl border border-slate-700 bg-slate-800/40 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Add a movie
            </h2>
            <AddMovieForm pending={addPending} onAdd={addMovie} />
          </section>
        )}

        {errorMsg && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">
            <span className="break-all">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="shrink-0 text-red-400 hover:text-red-200"
            >
              dismiss
            </button>
          </div>
        )}

        {movies.length === 0 ? (
          <p className="py-16 text-center text-slate-500">
            {adminToken
              ? "No movies yet. Add the first one above - it will be recorded on the blockchain."
              : "No movies yet. The admin can sign in to add the first one."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                pending={pendingRatings.has(movie.id)}
                readOnly={!!adminToken}
                onRate={rateMovie}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
