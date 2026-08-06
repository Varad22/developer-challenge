import { useCallback, useEffect, useState } from "react";
import AddMovieForm from "../components/AddMovieForm";
import MovieCard from "../components/MovieCard";
import { Session } from "../session";
import { ChainEvent, Movie } from "../types";

interface MoviesPageProps {
  session: Session;
  onLogout: () => void;
}

function MoviesPage({ session, onLogout }: MoviesPageProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [pendingRatings, setPendingRatings] = useState<Set<number>>(new Set());
  const [addPending, setAddPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const isAdmin = session.role === "admin";
  const username = session.role === "rater" ? session.username : undefined;

  const fetchMovies = useCallback(async () => {
    const headers: HeadersInit = {};
    if (session.role === "rater") {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const res = await fetch("/api/movies", { headers });
    const body = await res.json();
    if (res.ok) {
      setMovies(body);
    } else {
      setErrorMsg(body.error);
    }
  }, [session]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

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
      fetchMovies();
    };
    return () => source.close();
  }, [fetchMovies]);

  async function addMovie(title: string, year: number) {
    setErrorMsg(null);
    setAddPending(true);
    const res = await fetch("/api/movies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ title, year }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErrorMsg(error);
      setAddPending(false);
      if (res.status === 401) {
        onLogout();
      }
    }
  }

  async function clearPending(movieId: number) {
    setPendingRatings((prev) => {
      const next = new Set(prev);
      next.delete(movieId);
      return next;
    });
  }

  async function waitForOperation(operationId: string, movieId: number) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const res = await fetch(`/api/operations/${operationId}`);
      if (!res.ok) {
        continue;
      }
      const op = await res.json();
      if (op.status === "Succeeded") {
        await clearPending(movieId);
        await fetchMovies();
        return;
      }
      if (op.status === "Failed") {
        setErrorMsg(op.error || "Blockchain transaction failed");
        await clearPending(movieId);
        return;
      }
    }
    setErrorMsg(
      "Timed out waiting for block confirmation. Log out and sign in again if you reset FireFly recently."
    );
    await clearPending(movieId);
  }

  async function rateMovie(movieId: number, stars: number) {
    if (session.role !== "rater") {
      return;
    }

    setErrorMsg(null);
    setPendingRatings((prev) => new Set(prev).add(movieId));
    const res = await fetch(`/api/movies/${movieId}/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ stars }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErrorMsg(error);
      await clearPending(movieId);
      if (res.status === 401) {
        onLogout();
      }
      return;
    }

    const { id } = await res.json();
    if (id) {
      void waitForOperation(id, movieId);
    }
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
              {isAdmin
                ? "Manage the on-chain movie catalog"
                : `Signed in as ${username}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
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
            <span
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                isAdmin
                  ? "bg-amber-400/10 text-amber-300"
                  : "bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {isAdmin ? "admin" : username}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-slate-400"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {isAdmin && (
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
            {isAdmin
              ? "No movies yet. Add the first one above - it will be recorded on the blockchain."
              : "No movies yet. Check back once the admin adds some titles."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                pending={pendingRatings.has(movie.id)}
                readOnly={isAdmin}
                onRate={rateMovie}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default MoviesPage;
