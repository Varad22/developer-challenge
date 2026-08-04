import { Movie } from "../types";
import StarRating from "./StarRating";

interface MovieCardProps {
  movie: Movie;
  pending: boolean;
  readOnly: boolean;
  onRate: (movieId: number, stars: number) => void;
}

function MovieCard({ movie, pending, readOnly, onRate }: MovieCardProps) {
  const alreadyRated = movie.myRating > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-5 shadow-lg transition-colors hover:border-slate-500">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-100">{movie.title}</h3>
        {movie.year > 0 && (
          <span className="shrink-0 text-sm text-slate-400">{movie.year}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold text-amber-400">
          {movie.ratingCount > 0 ? movie.average.toFixed(1) : "-"}
        </span>
        <span className="text-sm text-slate-400">
          {movie.ratingCount} rating{movie.ratingCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-auto border-t border-slate-700 pt-3">
        {readOnly ? (
          <span className="text-xs text-slate-500">
            admins curate the catalog - only raters can vote
          </span>
        ) : pending ? (
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
            Waiting for block confirmation...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <StarRating
              value={movie.myRating}
              onRate={(stars) => onRate(movie.id, stars)}
            />
            <span className="text-xs text-slate-500">
              {alreadyRated ? "your rating - click to change" : "rate it"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MovieCard;
