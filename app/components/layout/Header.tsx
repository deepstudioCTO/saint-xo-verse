import { Link } from "react-router";

interface HeaderProps {
  rightElement?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  onBackClick?: () => void;
  showHome?: boolean;
  showGallery?: boolean;
}

// Icon components for consistent navigation
const BackIcon = () => (
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
);

const HomeIcon = () => (
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
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const GalleryIcon = () => (
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
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const navButtonClass = "text-[--color-text-secondary] hover:text-[--color-text] transition-normal";

export function Header({
  rightElement,
  showBack,
  backTo = "/",
  onBackClick,
  showHome,
  showGallery,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[--color-bg]">
      <div className="flex items-center justify-between page-padding h-14">
        {/* Left: Navigation buttons or Logo */}
        <div className="flex items-center gap-3">
          {showBack ? (
            onBackClick ? (
              <button onClick={onBackClick} className={navButtonClass}>
                <BackIcon />
              </button>
            ) : (
              <Link to={backTo} className={navButtonClass}>
                <BackIcon />
              </Link>
            )
          ) : (
            <Link to="/" className="text-sm font-bold tracking-tight">
              Saint XO Verse
            </Link>
          )}

          {showHome && (
            <Link to="/" className={navButtonClass}>
              <HomeIcon />
            </Link>
          )}

          {showGallery && (
            <Link to="/gallery" className={navButtonClass}>
              <GalleryIcon />
            </Link>
          )}
        </div>

        {/* Right: Custom element */}
        {rightElement && (
          <div className="text-subtitle">{rightElement}</div>
        )}
      </div>
    </header>
  );
}

// Export icons for use in custom headers
export { BackIcon, HomeIcon, GalleryIcon, navButtonClass };
