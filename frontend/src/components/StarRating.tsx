import { useState } from "react";

interface StarRatingProps {
  value: number;
  onRate?: (stars: number) => void;
  disabled?: boolean;
}

function StarRating({ value, onRate, disabled }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const interactive = Boolean(onRate) && !disabled;
  const shown = hovered || value;

  return (
    <div
      className="flex gap-0.5"
      onMouseLeave={() => setHovered(0)}
      role="radiogroup"
      aria-label="Star rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onRate && onRate(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          className={`text-2xl leading-none transition-transform ${
            interactive ? "cursor-pointer hover:scale-125" : "cursor-default"
          } ${star <= shown ? "text-amber-400" : "text-slate-600"}`}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          {star <= shown ? "\u2605" : "\u2606"}
        </button>
      ))}
    </div>
  );
}

export default StarRating;
