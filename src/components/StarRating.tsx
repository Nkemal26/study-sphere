import { Star } from "lucide-react";
import { useState } from "react";

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !readOnly && setHover(i)}
          onMouseLeave={() => !readOnly && setHover(null)}
          className={readOnly ? "cursor-default" : "transition-transform hover:scale-110"}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={i <= display ? "fill-accent text-accent" : "text-muted-foreground/40"}
          />
        </button>
      ))}
    </div>
  );
}
