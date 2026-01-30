import { Header } from "./Header";
import { FloatingBar } from "./FloatingBar";

interface PageLayoutProps {
  children: React.ReactNode;

  // Header props
  headerRight?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  onBackClick?: () => void;
  showHome?: boolean;
  showGallery?: boolean;

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
  hideCta?: boolean;
}

export function PageLayout({
  children,
  headerRight,
  showBack,
  backTo,
  onBackClick,
  showHome,
  showGallery,
  floatingLeft,
  floatingRight,
  ctaText,
  ctaTo,
  ctaDisabled,
  onCtaClick,
  hideHeader = false,
  hideFloatingBar = false,
  hideCta = false,
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
          showHome={showHome}
          showGallery={showGallery}
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
          ctaText={hideCta ? undefined : ctaText}
          ctaTo={hideCta ? undefined : ctaTo}
          ctaDisabled={ctaDisabled}
          onCtaClick={hideCta ? undefined : onCtaClick}
        />
      )}
    </div>
  );
}
