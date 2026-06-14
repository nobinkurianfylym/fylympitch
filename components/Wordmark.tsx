import Link from "next/link";

export default function Wordmark({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`font-sans tracking-[0.32em] text-[16px] select-none ${light ? "text-ivory" : "text-ink"}`}
      style={{ fontWeight: 400, letterSpacing: "0.32em" }}
    >
      <span className="text-gold" style={{ fontWeight: 500 }}>F</span>YLYM
      <span className="text-gold" style={{ fontWeight: 500 }}>P</span>ITCH
    </Link>
  );
}
