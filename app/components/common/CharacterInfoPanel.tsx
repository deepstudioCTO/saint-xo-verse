import { LargeTitle } from "~/components/ui";
import { useInlineEdit } from "~/hooks/useInlineEdit";
import { PencilIcon } from "~/components/ui/Icons";
import type { Persona } from "~/lib/data";

interface CharacterInfoPanelProps {
  character: Persona;
  lookId: string;
  selectedIndex: number;
  totalCharacters: number;
  onCharacterUpdate: (characterId: string, updates: Partial<Persona>) => void;
}

export function CharacterInfoPanel({
  character,
  lookId,
  selectedIndex,
  totalCharacters,
  onCharacterUpdate,
}: CharacterInfoPanelProps) {
  const charNameEdit = useInlineEdit<HTMLInputElement>({
    onSave: async (trimmed) => {
      const response = await fetch("/api/update-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookId, characterId: character.characterId, name: trimmed }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      onCharacterUpdate(character.characterId, { name: trimmed });
    },
  });

  const charDescEdit = useInlineEdit<HTMLTextAreaElement>({
    multiline: true,
    rejectEmpty: false,
    onSave: async (trimmed) => {
      const response = await fetch("/api/update-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookId, characterId: character.characterId, description: trimmed }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Update failed");
      onCharacterUpdate(character.characterId, { description: trimmed });
    },
  });

  return (
    <>
      <p className="text-[10px] tracking-wider text-black mb-1">PERSONA {String(selectedIndex + 1).padStart(2, "0")} / {String(totalCharacters).padStart(2, "0")}</p>
      <div className="group flex items-center gap-2">
        {charNameEdit.isEditing ? (
          <input
            ref={charNameEdit.ref}
            type="text"
            value={charNameEdit.value}
            onChange={(e) => charNameEdit.setValue(e.target.value)}
            onKeyDown={charNameEdit.keyDown}
            onBlur={charNameEdit.save}
            disabled={charNameEdit.isSaving}
            className="text-3xl md:text-4xl font-bold bg-transparent border-b-2 border-white/50 focus:border-white outline-none text-[--color-text] w-full max-w-md"
            style={{ fontFamily: "inherit" }}
          />
        ) : (
          <>
            <LargeTitle>{character.name}</LargeTitle>
            <button
              onClick={() => charNameEdit.startEdit(character.name)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 cursor-pointer"
              title="Edit name"
            >
              <PencilIcon size={16} />
            </button>
          </>
        )}
      </div>
      <div className="group flex items-start gap-2 mt-2">
        {charDescEdit.isEditing ? (
          <textarea
            ref={charDescEdit.ref}
            value={charDescEdit.value}
            onChange={(e) => charDescEdit.setValue(e.target.value)}
            onKeyDown={charDescEdit.keyDown}
            onBlur={charDescEdit.save}
            disabled={charDescEdit.isSaving}
            rows={3}
            className="text-sm bg-transparent border border-white/30 focus:border-white/50 rounded-lg outline-none text-[--color-text-secondary] w-full max-w-md p-2 resize-none leading-relaxed"
          />
        ) : (
          <>
            <p className="text-sm text-[--color-text-secondary] max-w-md leading-relaxed">
              {character.description}
            </p>
            <button
              onClick={() => charDescEdit.startEdit(character.description)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 flex-shrink-0 cursor-pointer"
              title="Edit description"
            >
              <PencilIcon size={14} />
            </button>
          </>
        )}
      </div>
    </>
  );
}
