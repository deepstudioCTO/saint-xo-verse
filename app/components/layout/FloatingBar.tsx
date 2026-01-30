import { Link } from "react-router";

interface FloatingBarProps {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  ctaText?: string;
  ctaTo?: string;
  ctaDisabled?: boolean;
  onCtaClick?: () => void;
}

export function FloatingBar({
  leftContent,
  rightContent,
  ctaText,
  ctaTo,
  ctaDisabled = false,
  onCtaClick,
}: FloatingBarProps) {
  const ctaClasses = `
    px-6 py-3 text-sm font-medium transition-normal
    ${ctaDisabled
      ? "text-[--color-text-tertiary] cursor-not-allowed"
      : "text-[--color-text] hover:opacity-70"
    }
  `;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[--color-bg]">
      <div className="flex items-center justify-between page-padding h-16">
        {/* Left */}
        <div className="text-sm font-medium">
          {leftContent}
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {rightContent}

          {ctaText && (
            ctaTo && !ctaDisabled ? (
              <Link to={ctaTo} className={ctaClasses}>
                {ctaText}
              </Link>
            ) : (
              <button
                onClick={onCtaClick}
                disabled={ctaDisabled}
                className={ctaClasses}
              >
                {ctaText}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
