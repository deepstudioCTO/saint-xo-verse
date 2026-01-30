import { Link } from "react-router";

interface HeaderProps {
  rightElement?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  onBackClick?: () => void;
}

export function Header({ rightElement, showBack, backTo = "/", onBackClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[--color-bg]">
      <div className="flex items-center justify-between page-padding h-14">
        {/* Left: Back or Logo */}
        {showBack ? (
          onBackClick ? (
            <button
              onClick={onBackClick}
              className="text-[--color-text-secondary] hover:text-[--color-text] transition-normal text-sm font-medium"
            >
              <span className="flex items-center gap-1">
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
              </span>
            </button>
          ) : (
            <Link
              to={backTo}
              className="text-[--color-text-secondary] hover:text-[--color-text] transition-normal text-sm font-medium"
            >
              <span className="flex items-center gap-1">
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
              </span>
            </Link>
          )
        ) : (
          <Link to="/" className="text-sm font-bold tracking-tight">
            Saint XO Verse
          </Link>
        )}

        {/* Right: Custom element */}
        {rightElement && (
          <div className="text-subtitle">{rightElement}</div>
        )}
      </div>
    </header>
  );
}
