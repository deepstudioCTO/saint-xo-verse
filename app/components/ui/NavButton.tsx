interface NavButtonProps {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export function NavButton({
  direction,
  onClick,
  disabled = false,
  showLabel = true,
}: NavButtonProps) {
  const isPrev = direction === "prev";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 text-sm font-medium transition-normal
        ${disabled
          ? "text-[--color-text-tertiary] cursor-not-allowed"
          : "text-[--color-text-secondary] hover:text-[--color-text]"
        }
      `}
    >
      {isPrev && (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {showLabel && <span>PREV</span>}
        </>
      )}
      {!isPrev && (
        <>
          {showLabel && <span>NEXT</span>}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </>
      )}
    </button>
  );
}
