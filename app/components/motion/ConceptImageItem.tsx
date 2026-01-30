import { useRef, useState, useEffect } from "react";

interface ConceptImageItemProps {
  image: {
    id: string;
    name: string | null;
    publicUrl: string;
  };
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (id: string) => void;
  onNameChange?: (id: string, newName: string) => void;
}

export function ConceptImageItem({
  image,
  index,
  isSelected,
  onClick,
  onDelete,
  onNameChange,
}: ConceptImageItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(image.name || "");

  useEffect(() => {
    setEditName(image.name || "");
  }, [image.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== image.name && onNameChange) {
      onNameChange(image.id, trimmedName);
    } else {
      setEditName(image.name || "");
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(image.name || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const isActive = isSelected || isHovering;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`
        relative w-full bg-[--color-border-light] overflow-hidden
        transition-all duration-200 ease-out group aspect-[1/2]
        ${isSelected
          ? "scale-[1.03] shadow-xl shadow-black/25 z-10"
          : "hover:scale-[1.02] hover:shadow-lg hover:z-10"
        }
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-7 h-7 bg-black rounded-full flex items-center justify-center z-20 shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="w-4 h-4"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      )}

      {/* Image */}
      <img
        src={image.publicUrl}
        alt={image.name || "Concept Image"}
        crossOrigin="anonymous"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
          isActive ? "grayscale-0" : "grayscale"
        }`}
      />

      {/* Index Label */}
      <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-20 transition-all ${
        isActive ? "text-white bg-black/60" : "text-white/70 bg-black/30"
      }`}>
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Hover overlay with name */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 transition-opacity ${
        isHovering || isEditing ? "opacity-100" : "opacity-0"
      }`}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 left-8 right-10 text-sm font-medium text-white bg-black/50 border border-white/30 rounded px-2 py-0.5 outline-none focus:border-white/60"
          />
        ) : (
          <span className="absolute bottom-2 left-8 right-10 text-sm font-medium text-white truncate">
            {image.name || "Untitled"}
          </span>
        )}
      </div>

      {/* Edit button */}
      {onNameChange && !isEditing && (
        <button
          onClick={handleEditClick}
          className={`absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center z-20 transition-opacity hover:bg-black/80 ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}
          title="Rename"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3"
          >
            <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(image.id);
          }}
          className={`absolute bottom-2 left-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center z-20 transition-opacity hover:bg-red-600 ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}
          title="Delete"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      )}
    </button>
  );
}
