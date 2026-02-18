import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LargeTitle } from "~/components/ui";
import { useInlineEdit } from "~/hooks/useInlineEdit";
import { PencilIcon } from "~/components/ui/Icons";
import type { Lookbook } from "~/lib/data";

const LOOKBOOK_CREDITS: Record<string, { role: string; name: string }[]> = {
  "00": [
    { role: "PRODUCTION", name: "YSLX" },
    { role: "PHOTOGRAPHER", name: "YSLX" },
    { role: "HAIR", name: "YSLX" },
    { role: "STYLIST", name: "YSLX" },
    { role: "MAKEUP", name: "YSLX" },
  ],
  "01": [
    { role: "PRODUCTION", name: "YIRANG MOON" },
    { role: "PHOTOGRAPHER", name: "YIRANG MOON" },
    { role: "HAIR", name: "YIRANG MOON" },
    { role: "STYLIST", name: "YIRANG MOON" },
    { role: "MAKEUP", name: "YIRANG MOON" },
  ],
};

function LookbookCredits({ lookbookId }: { lookbookId: string }) {
  const [open, setOpen] = useState(false);
  const credits = LOOKBOOK_CREDITS[lookbookId] ?? [];
  const lastIdx = credits.length - 1;

  const roleVariants = {
    hidden: { opacity: 0 },
    visible: (i: number) => ({
      opacity: 1,
      transition: { duration: 0, delay: i * 0.12 },
    }),
    exit: (i: number) => ({
      opacity: 0,
      transition: { duration: 0, delay: 0.3 + (lastIdx - i) * 0.08 },
    }),
  };

  const nameVariants = {
    hidden: { opacity: 0 },
    visible: (i: number) => ({
      opacity: 1,
      transition: { duration: 0, delay: 0.36 + i * 0.12 },
    }),
    exit: (i: number) => ({
      opacity: 0,
      transition: { duration: 0, delay: (lastIdx - i) * 0.08 },
    }),
  };

  return (
    <>
      <button
        onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setOpen((v) => !v); }}
        className="flex items-center text-[10px] tracking-wider text-black mt-2 cursor-pointer hover:opacity-60 transition-opacity outline-none"
      >
        <span className="font-medium">CREDITS</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="credits-list"
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-2"
          >
            {credits.map((credit, i) => (
              <div key={credit.role} className="flex items-center text-[10px] tracking-wider text-black mt-2.5">
                <motion.span custom={i} variants={roleVariants} className="font-medium w-40">
                  {credit.role}
                </motion.span>
                <motion.span custom={i} variants={nameVariants} className="font-black">
                  {credit.name}
                </motion.span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface LookbookInfoPanelProps {
  lookbook: Lookbook;
  lookbookIndex: number;
  totalLookbooks: number;
  currentLookIndex: number;
  totalLooks: number;
  slideDirection: number;
  currentLookbookId: string;
  onLookbookUpdate: (lookbookId: string, updates: Partial<Lookbook>) => void;
}

export function LookbookInfoPanel({
  lookbook,
  lookbookIndex,
  totalLookbooks,
  currentLookIndex,
  totalLooks,
  slideDirection,
  currentLookbookId,
  onLookbookUpdate,
}: LookbookInfoPanelProps) {
  const lookbookNameEdit = useInlineEdit<HTMLInputElement>({
    onSave: async (trimmed) => {
      const response = await fetch("/api/update-lookbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbookId: lookbook.id, name: trimmed }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      onLookbookUpdate(lookbook.id, { name: trimmed.toLowerCase(), displayName: trimmed });
    },
  });

  const lookbookDescEdit = useInlineEdit<HTMLTextAreaElement>({
    multiline: true,
    rejectEmpty: false,
    onSave: async (trimmed) => {
      const response = await fetch("/api/update-lookbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookbookId: lookbook.id, description: trimmed || null }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      onLookbookUpdate(lookbook.id, { description: trimmed || null });
    },
  });

  return (
    <AnimatePresence mode="wait" custom={slideDirection}>
      <motion.div
        key={currentLookbookId}
        custom={slideDirection}
        initial={{ opacity: 0, y: slideDirection * 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -slideDirection * 10 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <span className="text-[10px] font-medium tracking-wider text-black mb-1">LOOKBOOK&ensp;{String(lookbookIndex + 1).padStart(2, "0")}/{String(totalLookbooks).padStart(2, "0")}</span>
        <div className="group flex items-center gap-2">
          {lookbookNameEdit.isEditing ? (
            <input
              ref={lookbookNameEdit.ref}
              type="text"
              value={lookbookNameEdit.value}
              onChange={(e) => lookbookNameEdit.setValue(e.target.value)}
              onKeyDown={lookbookNameEdit.keyDown}
              onBlur={lookbookNameEdit.save}
              disabled={lookbookNameEdit.isSaving}
              className="text-3xl md:text-4xl font-bold bg-transparent border-b-2 border-white/50 focus:border-white outline-none text-[--color-text] w-full max-w-md"
              style={{ fontFamily: "inherit" }}
            />
          ) : (
            <>
              <LargeTitle>{lookbook.name.toUpperCase()}</LargeTitle>
              <button
                onClick={() => lookbookNameEdit.startEdit(lookbook.displayName)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 cursor-pointer"
                title="Edit lookbook name"
              >
                <PencilIcon size={16} />
              </button>
            </>
          )}
        </div>
        <div className="group flex items-start gap-2 mt-2">
          {lookbookDescEdit.isEditing ? (
            <textarea
              ref={lookbookDescEdit.ref}
              value={lookbookDescEdit.value}
              onChange={(e) => lookbookDescEdit.setValue(e.target.value)}
              onKeyDown={lookbookDescEdit.keyDown}
              onBlur={lookbookDescEdit.save}
              disabled={lookbookDescEdit.isSaving}
              rows={2}
              className="text-sm bg-transparent border border-white/30 focus:border-white/50 rounded-lg outline-none text-[--color-text-secondary] w-full max-w-md p-2 resize-none leading-relaxed"
              placeholder="Add lookbook description..."
            />
          ) : (
            <>
              {lookbook?.description ? (
                <p className="text-sm text-[--color-text-secondary] max-w-md leading-relaxed">
                  {lookbook.description}
                </p>
              ) : (
                <p className="text-sm text-[--color-text-secondary]/40 max-w-md leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
                  Add description...
                </p>
              )}
              <button
                onClick={() => lookbookDescEdit.startEdit(lookbook?.description || "")}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 flex-shrink-0 cursor-pointer"
                title="Edit lookbook description"
              >
                <PencilIcon size={14} />
              </button>
            </>
          )}
        </div>
        <span className="flex items-center text-[10px] tracking-wider text-black mt-8"><span className="font-medium w-40">LOOKS</span><span className="font-bold">{String(currentLookIndex + 1).padStart(2, "0")}/{String(totalLooks).padStart(2, "0")}</span></span>
        <LookbookCredits lookbookId={currentLookbookId} />
      </motion.div>
    </AnimatePresence>
  );
}
