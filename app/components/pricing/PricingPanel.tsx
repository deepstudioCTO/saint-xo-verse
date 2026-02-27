import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExpandedPanelShell } from "~/components/common/ExpandedPanelShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

/* ── Helpers ─────────────────────────────────────────────────── */

function formatPrice(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

/* ── Data ────────────────────────────────────────────────────── */

interface Subscription {
  tier: string;
  price: number;
  publishes: number;
  queue: string;
  commercial: boolean;
  b2bAd: boolean;
  chat: boolean;
  highlighted: boolean;
  badge?: string;
  description: string;
}

const SUBSCRIPTIONS: Subscription[] = [
  {
    tier: "Fan Pass",
    price: 19_900,
    publishes: 5,
    queue: "Basic",
    commercial: false,
    b2bAd: false,
    chat: true,
    highlighted: false,
    description: "Try out AI content creation with your favorite members.",
  },
  {
    tier: "License",
    price: 55_000,
    publishes: 20,
    queue: "Standard",
    commercial: true,
    b2bAd: false,
    chat: true,
    highlighted: false,
    description: "Commercial rights for professional creators.",
  },
  {
    tier: "Studio",
    price: 149_000,
    publishes: 60,
    queue: "Priority",
    commercial: true,
    b2bAd: true,
    chat: true,
    highlighted: true,
    badge: "Best Offer",
    description: "Full access for studios and agencies.",
  },
  {
    tier: "Studio Plus",
    price: 299_000,
    publishes: 120,
    queue: "Top Priority",
    commercial: true,
    b2bAd: true,
    chat: true,
    highlighted: false,
    description: "Maximum throughput for high-volume production.",
  },
];

interface Pack {
  name: string;
  price: number;
  count: number;
  perPublish: number;
  discount: number;
  highlighted?: boolean;
  badge?: string;
}

const ONE_TIME_PACKS: Pack[] = [
  { name: "1 Publish", price: 4_900, count: 1, perPublish: 4_900, discount: 0 },
  { name: "10 Pack", price: 35_000, count: 10, perPublish: 3_500, discount: 29 },
  {
    name: "30 Pack",
    price: 96_000,
    count: 30,
    perPublish: 3_200,
    discount: 35,
    highlighted: true,
    badge: "Best Value",
  },
  { name: "100 Pack", price: 300_000, count: 100, perPublish: 3_000, discount: 39 },
];

const FAQ_ITEMS = [
  {
    q: "What is a Publish?",
    a: "A Publish is one generated output — a video clip or an image — created through the Saint XO platform. Each generation costs one Publish credit regardless of length or resolution.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes. You can upgrade, downgrade, or cancel anytime from your account settings. Changes take effect at the start of your next billing cycle. Unused Publishes do not roll over.",
  },
  {
    q: "What does Commercial use include?",
    a: "Commercial use allows you to use generated content in revenue-generating projects — social media marketing, branded content, product demos, and more. Fan Pass is limited to personal, non-commercial use only.",
  },
  {
    q: "What is B2B AD licensing?",
    a: "B2B AD licensing grants rights to use Saint XO member likenesses in paid advertising campaigns, sponsored content, and promotional materials distributed through third-party channels.",
  },
  {
    q: "Do unused Publishes carry over?",
    a: "Subscription Publishes reset each billing cycle and do not roll over. One-time pack Publishes never expire — use them whenever you like.",
  },
  {
    q: "How does the queue work?",
    a: "Higher-tier plans get faster queue positions. During peak hours, Priority and Top Priority subscribers' jobs are processed before Basic and Standard tier jobs.",
  },
];

/* ── Feature list ────────────────────────────────────────────── */

type BooleanFeatureKey = "commercial" | "b2bAd" | "chat";

const FEATURES: { key: BooleanFeatureKey; label: string }[] = [
  { key: "commercial", label: "Commercial Use" },
  { key: "b2bAd", label: "B2B AD License" },
  { key: "chat", label: "AI Chat" },
];

/* ── Icons ───────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-green-600"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DashIcon() {
  return <span className="inline-block w-3.5 text-center text-neutral-300" aria-hidden="true">—</span>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Cards ───────────────────────────────────────────────────── */

function SubscriptionCard({ sub, index }: { sub: Subscription; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className={cn(
        "relative flex flex-col rounded-xl bg-white p-5 border transition-shadow",
        sub.highlighted
          ? "ring-2 ring-violet-400/50 shadow-md border-violet-200/60"
          : "shadow-sm border-neutral-200/80 hover:shadow-md",
      )}
    >
      {sub.badge && (
        <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 text-[10px] font-semibold text-white rounded-full bg-gradient-to-r from-blue-500 to-violet-500">
          {sub.badge}
        </span>
      )}

      <span className="text-sm font-semibold text-black">{sub.tier}</span>
      <p className="mt-1 text-[11px] text-neutral-500 leading-snug">{sub.description}</p>

      <div className="mt-4 mb-1">
        <span className="text-2xl font-bold text-black">{formatPrice(sub.price)}</span>
        <span className="text-xs text-neutral-400 ml-0.5">/월</span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-black">
          {sub.publishes} Publishes
        </span>
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 text-neutral-500">
          {sub.queue}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 mb-5">
        {FEATURES.map((f) => {
          const included = sub[f.key];
          return (
            <li key={f.key} className="flex items-center gap-2 text-xs text-neutral-600">
              {included ? <CheckIcon /> : <DashIcon />}
              <span className={included ? undefined : "text-neutral-400"}>{f.label}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={cn(
          "mt-auto w-full py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
          sub.highlighted
            ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:opacity-90"
            : "bg-black text-white hover:bg-neutral-800",
        )}
      >
        Get Started
      </button>
    </motion.div>
  );
}

function OneTimeCard({ pack, index }: { pack: Pack; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className={cn(
        "relative flex flex-col items-center rounded-xl bg-white p-5 border transition-shadow",
        pack.highlighted
          ? "ring-2 ring-violet-400/50 shadow-md border-violet-200/60"
          : "shadow-sm border-neutral-200/80 hover:shadow-md",
      )}
    >
      {pack.badge && (
        <span className="absolute -top-2.5 px-2.5 py-0.5 text-[10px] font-semibold text-white rounded-full bg-gradient-to-r from-blue-500 to-violet-500">
          {pack.badge}
        </span>
      )}

      <span className="text-3xl font-bold text-black">{pack.count}</span>
      <span className="text-xs text-neutral-500 mt-0.5">
        Publish{pack.count > 1 ? "es" : ""}
      </span>

      <div className="mt-3 mb-1">
        <span className="text-lg font-bold text-black">{formatPrice(pack.price)}</span>
      </div>
      <span className="text-[11px] text-neutral-400">
        {formatPrice(pack.perPublish)} / publish
      </span>

      {pack.discount > 0 && (
        <span className="mt-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-50 text-green-700">
          {pack.discount}% OFF
        </span>
      )}

      <button
        type="button"
        className="mt-4 w-full py-2 rounded-lg text-xs font-semibold bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer"
      >
        Buy
      </button>
    </motion.div>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────── */

function FAQItem({ item, index }: { item: (typeof FAQ_ITEMS)[number]; index: number }) {
  const [open, setOpen] = useState(false);
  const contentId = `faq-${index}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.15 + index * 0.04 }}
      className="rounded-lg border border-neutral-200/80 bg-white overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="text-xs font-medium text-black">{item.q}</span>
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-[11px] leading-relaxed text-neutral-500">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Panel ───────────────────────────────────────────────────── */

interface PricingPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PricingPanel({ open, onClose }: PricingPanelProps) {
  return (
    <ExpandedPanelShell open={open} onClose={onClose}>
      {(contentReady) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <span className="text-xs font-medium tracking-wider uppercase text-black">
              Pricing
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-black/40 hover:text-black/70 transition-colors cursor-pointer"
              aria-label="Close pricing panel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {contentReady && (
              <>
                {/* Hero */}
                <div className="text-center pt-2 pb-6">
                  <h2 className="text-2xl font-bold">
                    <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                      Choose Your Plan
                    </span>
                  </h2>
                  <p className="mt-2 text-xs text-neutral-500 max-w-md mx-auto">
                    Create with Saint XO members — AI-powered video and image generation for fans, creators, and studios.
                  </p>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="subscription">
                  <div className="flex justify-center mb-5">
                    <TabsList className="inline-flex bg-neutral-100 rounded-full p-0.5">
                      <TabsTrigger
                        value="subscription"
                        className="rounded-full px-5 py-1.5 data-[state=active]:shadow-sm"
                      >
                        Subscription
                      </TabsTrigger>
                      <TabsTrigger
                        value="onetime"
                        className="rounded-full px-5 py-1.5 data-[state=active]:shadow-sm"
                      >
                        One-time
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Subscription grid */}
                  <TabsContent value="subscription">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {SUBSCRIPTIONS.map((sub, i) => (
                        <SubscriptionCard key={sub.tier} sub={sub} index={i} />
                      ))}
                    </div>
                  </TabsContent>

                  {/* One-time grid */}
                  <TabsContent value="onetime">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {ONE_TIME_PACKS.map((pack, i) => (
                        <OneTimeCard key={pack.name} pack={pack} index={i} />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* FAQ */}
                <div className="mt-8 mb-2">
                  <h3 className="text-sm font-semibold text-black mb-4">
                    Frequently Asked Questions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FAQ_ITEMS.map((item, i) => (
                      <FAQItem key={item.q} item={item} index={i} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </ExpandedPanelShell>
  );
}
