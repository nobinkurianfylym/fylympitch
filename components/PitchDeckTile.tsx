'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Signed URL pointing at the pitch-deck PDF in Supabase storage */
  deckUrl: string;
  /** Film title — used for aria-label and the error fallback */
  title: string;
  className?: string;
}

/**
 * Renders the first page of a pitch-deck PDF as a clickable tile.
 * All PDF.js work happens inside a useEffect (browser only) so the
 * Cloudflare Workers module graph is never touched.
 */
export default function PitchDeckTile({ deckUrl, title, className = '' }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // default to A4 portrait while loading
  const [aspectRatio, setAspectRatio] = useState<number>(1.4142);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // Dynamic import — runs only in the browser, never on Workers
        const pdfjsLib = await import('pdfjs-dist');

        // Point to CDN worker so Next/Cloudflare doesn't try to bundle it
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

        const vp0  = page.getViewport({ scale: 1 });
        const ratio = vp0.height / vp0.width;
        setAspectRatio(ratio);

        const w     = container.clientWidth || 320;
        const scale = w / vp0.width;
        const vp    = page.getViewport({ scale });

        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);

        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;

        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [deckUrl]);

  return (
    <a
      href={deckUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${title} pitch deck`}
      className={[
        'group block relative overflow-hidden rounded-card border border-line bg-ivory',
        'hover:border-gold/60 hover:shadow-[0_4px_24px_rgba(191,153,83,0.12)]',
        'transition-all duration-200',
        className,
      ].join(' ')}
    >
      <div ref={containerRef} className="relative w-full overflow-hidden">

        {/* ── Canvas: hidden until rendered ── */}
        <canvas
          ref={canvasRef}
          className={[
            'w-full h-auto block transition-opacity duration-300',
            status === 'ready'
              ? 'opacity-100'
              : 'opacity-0 absolute inset-0 pointer-events-none',
          ].join(' ')}
        />

        {/* ── Skeleton while loading ── */}
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

        {/* ── Error / fallback ── */}
        {status === 'error' && (
          <div
            className="w-full bg-ivory flex flex-col items-center justify-center gap-3 px-4"
            style={{ aspectRatio: `1 / ${aspectRatio}` }}
          >
            {/* Document icon */}
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

        {/* ── Hover ink overlay ── */}
        <div
          className={[
            'absolute inset-0 flex items-center justify-center pointer-events-none',
            'bg-ink/0 group-hover:bg-ink/55 transition-colors duration-200',
          ].join(' ')}
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-ivory text-[11px] tracking-[0.22em] uppercase font-medium">
            Open deck ↗
          </span>
        </div>
      </div>

      {/* ── Footer label ── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-line">
        <span className="text-[10px] tracking-[0.18em] uppercase text-ash select-none">
          Pitch deck
        </span>
        <span className="text-[10px] text-ash/50 select-none">PDF ↗</span>
      </div>
    </a>
  );
}
