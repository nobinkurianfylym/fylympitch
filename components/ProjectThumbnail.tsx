interface Props {
  posterPath?: string | null;
  title: string;
  genre?: string | null;
  supabaseUrl: string;
  className?: string;
}

export default function ProjectThumbnail({ posterPath, title, genre, supabaseUrl, className = "" }: Props) {
  if (posterPath) {
    return (
      <img
        src={`${supabaseUrl}/storage/v1/object/public/thumbnails/${posterPath}`}
        alt={title}
        className={`object-cover ${className}`}
      />
    );
  }

  const words = title.trim().split(/\s+/);
  const line1 = words.slice(0, 3).join(" ");
  const line2 = words.slice(3, 6).join(" ");
  const genreLabel = (genre ?? "").toUpperCase().slice(0, 12);

  return (
    <svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-label={title}>
      <rect width="160" height="100" fill="#1A1815" />
      <rect x="0" y="0" width="3" height="100" fill="#BF9953" />
      <rect x="0" y="88" width="160" height="12" fill="#BF9953" opacity="0.12" />
      {genreLabel && (
        <text x="12" y="22" fill="#BF9953" fontSize="7" fontFamily="monospace" letterSpacing="1.8">{genreLabel}</text>
      )}
      <text x="12" y="54" fill="#F5F5F0" fontSize="12" fontFamily="Georgia, serif">
        {line1.length > 16 ? line1.slice(0, 16) + "…" : line1}
      </text>
      {line2 && (
        <text x="12" y="70" fill="#F5F5F0" fontSize="12" fontFamily="Georgia, serif" opacity="0.7">
          {line2.length > 16 ? line2.slice(0, 16) + "…" : line2}
        </text>
      )}
      <text x="12" y="95" fill="#BF9953" fontSize="5.5" fontFamily="monospace" letterSpacing="2" opacity="0.7">FYLYMPITCH</text>
    </svg>
  );
}
