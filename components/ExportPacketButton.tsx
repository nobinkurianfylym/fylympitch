"use client";

export function ExportPacketButton({
  projectId,
  opportunityId,
}: {
  projectId: string;
  opportunityId: string;
}) {
  return (
    <button
      onClick={() =>
        window.open(`/apply-packet/${projectId}/${opportunityId}`, "_blank")
      }
      className="inline-flex items-center gap-1.5 px-2 py-0.5
        border border-line rounded-sm
        text-ash text-[10px] tracking-[0.14em] uppercase font-normal
        hover:border-gold/50 hover:text-gold transition-colors"
    >
      ↗ Export Packet
    </button>
  );
}
