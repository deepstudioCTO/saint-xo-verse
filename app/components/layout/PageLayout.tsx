import { Header } from "./Header";
import { FloatingBar } from "./FloatingBar";

interface PageLayoutProps {
  children: React.ReactNode;

  // Header props
  headerRight?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  onBackClick?: () => void;

  // FloatingBar props
  floatingLeft?: React.ReactNode;
  floatingRight?: React.ReactNode;
  ctaText?: string;
  ctaTo?: string;
  ctaDisabled?: boolean;
  onCtaClick?: () => void;

  // Options
  hideHeader?: boolean;
  hideFloatingBar?: boolean;
}

export function PageLayout({
  children,
  headerRight,
  showBack,
  backTo,
  onBackClick,
  floatingLeft,
  floatingRight,
  ctaText,
  ctaTo,
  ctaDisabled,
  onCtaClick,
  hideHeader = false,
  hideFloatingBar = false,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-[--color-bg] flex flex-col">
      {/* Header */}
      {!hideHeader && (
        <Header
          rightElement={headerRight}
          showBack={showBack}
          backTo={backTo}
          onBackClick={onBackClick}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 ${!hideHeader ? "pt-14" : ""} ${!hideFloatingBar ? "pb-16" : ""}`}>
        {children}
      </main>

      {/* Floating Bar */}
      {!hideFloatingBar && (
        <FloatingBar
          leftContent={floatingLeft}
          rightContent={floatingRight}
          ctaText={ctaText}
          ctaTo={ctaTo}
          ctaDisabled={ctaDisabled}
          onCtaClick={onCtaClick}
        />
      )}
    </div>
  );
}
