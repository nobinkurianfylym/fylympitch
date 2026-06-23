"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-[11px] tracking-[0.14em] uppercase px-4 py-2 rounded-sm transition-colors"
      style={{ backgroundColor: "#1A1815", color: "#F5F5F0" }}
    >
      Save as PDF
    </button>
  );
}
