interface DotIndicatorProps {
  total: number;
  current: number;
  onChange?: (index: number) => void;
}

export function DotIndicator({ total, current, onChange }: DotIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onChange?.(index)}
          disabled={!onChange}
          className={`
            w-2 h-2 rounded-full transition-normal
            ${index === current
              ? "bg-[--color-text]"
              : "bg-[--color-border] hover:bg-[--color-text-secondary]"
            }
            ${!onChange ? "cursor-default" : "cursor-pointer"}
          `}
          aria-label={`Go to item ${index + 1}`}
        />
      ))}
    </div>
  );
}
