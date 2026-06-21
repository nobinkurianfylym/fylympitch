'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Signed URL pointing at the pitch-deck PDF in Supabase storage */
  deckUrl: string;
  /** Film title — used for aria-label and the error fallback */
  title: string;
  className?: string;
}

/** Paints a diagonal www.fylym.com watermark onto an already-rendered canvas. */
function paintWatermark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w   = canvas.width;
  const h   = canvas.height;
  const txt = 'www.fylym.com';

  ctx.save();

  // Diagonal stamp across the centre — single pass, low opacity
  ctx.globalAlpha    = 0.07;
  ctx.fillStyle      = '#1A1815';
  ctx.font           = `${Math.round(w * 0.038)}px Montserrat, sans-serif`;
  ctx.letterSpacing  = '0.14em';
  ctx.textAlign      = 'center';
  ctx.textBaseline   = 'middle';

  // Tile diagonally so watermark appears throughout
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6); // −30°

  const step = Math.round(w * 0.38);
  for (let row = -h; row < h; row += step) {
    for (let col = -w; col < w; col += step) {
      ctx.fillText(txt, col, row);
    }
  }

  ctx.restore();
}

/**
 * Renders the first page of a pitch-deck PDF as a read-only preview tile.
 * No download, no external link. Watermark painted on canvas after render.
 * All PDF.js work happens inside a useEffect (browser only) so the
 * Cloudflare Workers module graph is never touched.
 */
export default function PitchDeckTile({ deckUrl, title, className = '' }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [aspectRatio, setAspectRatio] = useState<number>(1.4142);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({ url: deckUrl }).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas    = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const vp0   = page.getViewport({ scale: 1 });
        const ratio = vp0.height / vp0.width;
        setAspectRatio(ratio);

        const w     = container.clientWidth || 320;
        const scale = w / vp0.width;
        const vp    = page.getViewport({ scale });

        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);

        const ctx = canvas.getContext('2d')!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx, viewport: vp } as any).promise;
        if (cancelled) return;

        // Watermark on top — after page pixels are painted
        paintWatermark(canvas);

        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [deckUrl]);

  return (
    <div
      aria-label={`${title} pitch deck preview`}
      className={[
        'block relative overflow-hidden rounded-card border border-line bg-ivory',
        className,
      ].join(' ')}
      // Block right-click → Save image
      onContextMenu={e => e.preventDefault()}
    >
      <div ref={containerRef} className="relative w-full overflow-hidden">

        {/* ── Canvas ── */}
        <canvas
          ref={canvasRef}
          className={[
            'w-full h-auto block transition-opacity duration-300',
            status === 'ready'
              ? 'opacity-100'
              : 'opacity-0 absolute inset-0 pointer-events-none',
          ].join(' ')}
          // Disable drag-to-save
          draggable={false}
        />

        {/* ── Skeleton ── */}
        {status === 'loading' && (
          <div
            className="w-full bg-line/20 animate-pulse flex items-center justify-center"
            style={{ aspectRatio: `1 / ${aspectRatio}` }}
          >
            <span className="text-[10px] tracking-[0.2em] uppercase text-ash/50 select-none">
              Loading…
            </span>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div
            className="w-full bg-ivory flex flex-col items-center justify-center gap-3 px-4"
            style={{ aspectRatio: `1 / ${aspectRatio}` }}
          >
            <svg
              width="32" height="32" viewBox="0 0 32 32" fill="none"
              className="text-ash/30" aria-hidden="true"
            >
              <rect x="4" y="2" width="20" height="26" rx="2"
                stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M9 9h14M9 14h14M9 19h8"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M24 2v6h6" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <p className="font-display text-[13px] text-ash text-center leading-snug">
              {title}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-line">
        <span className="text-[10px] tracking-[0.18em] uppercase text-ash select-none">
          Pitch deck
        </span>
        <span className="text-[10px] text-ash/40 select-none tracking-[0.08em]">
          www.fylym.com
        </span>
      </div>
    </div>
  );
}
