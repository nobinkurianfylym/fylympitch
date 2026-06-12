import Link from "next/link";

export default function Wordmark({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`font-sans font-extralight tracking-[0.32em] text-[17px] select-none ${light ? "text-ivory" : "text-ink"}`}
    >
      <span className="text-gold font-light">F</span>YLYM
      <span className="text-gold font-light">P</span>ITCH
    </Link>
  );
}
