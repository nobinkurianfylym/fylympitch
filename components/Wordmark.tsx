import Link from "next/link";

export default function Wordmark({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`font-sans text-[16px] select-none ${light ? "text-ivory" : "text-ink"}`}
      style={{ fontWeight: 400, letterSpacing: "0.28em" }}
    >
      PITCH<span className="text-gold" style={{ fontWeight: 600, letterSpacing: 0 }}>.</span>FYLYM
    </Link>
  );
}
