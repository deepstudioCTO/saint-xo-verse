interface TrackInfoProps {
  cover: string;
  title: string;
  artist?: string;
  thumbnailSize?: string;
  className?: string;
}

export function TrackInfo({
  cover,
  title,
  artist = "Saint Vesper",
  thumbnailSize = "w-8 h-8",
  className = "",
}: TrackInfoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={cover}
        alt={title}
        className={`${thumbnailSize} rounded-sm object-cover`}
      />
      <div className="flex flex-col">
        <span className="text-[11px] tracking-wider text-black/70 font-medium whitespace-nowrap">
          {title}
        </span>
        <span className="text-[9px] tracking-wider text-black/30">
          {artist}
        </span>
      </div>
    </div>
  );
}
