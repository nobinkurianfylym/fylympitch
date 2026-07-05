'use client';

// DeckCoverThumbnail — renders page 1 of a pitch deck as a project tile.
// Used by ProjectThumbnail as the second-priority visual (poster > deck cover > pastel).
// No modal, no click handling — parent (Link/card) owns interaction.

import { useEffect, useRef, useState } from 'react';

interface Props {
  deckUrl: string;
  title: string;
  genre?: string | null;
  className?: string;
}

function paintWatermark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.globalAlpha  = 0.07;
  ctx.fillStyle    = '#1A1815';
  ctx.font         = `${Math.round(w * 0.038)}px Montserrat, sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  const step = Math.round(w * 0.38);
  for (let row = -h; row < h; row += step)
    for (let col = -w; col < w; col += step)
      ctx.fillText('www.fylym.com', col, row);
  ctx.restore();
}

export default function DeckCoverThumbnail({ deckUrl, title, genre, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf  = await pdfjsLib.getDocument({ url: deckUrl }).promise;
        if (cancelled) return;

        const page    = await pdf.getPage(1);
        const canvas  = canvasRef.current;
        const wrapper = containerRef.current;
        if (cancelled || !canvas || !wrapper) return;

        const vp0   = page.getViewport({ scale: 1 });
        const scale = (wrapper.clientWidth || 320) / vp0.width;
        const vp    = page.getViewport({ scale });
        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);

        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp } as any).promise;
        if (cancelled) return;

        paintWatermark(canvas);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [deckUrl]);

  if (status === 'error') {
    // Caller (ProjectThumbnail) doesn't know this failed after mount, so keep
    // this visually consistent with the pastel fallback rather than a broken box.
    return (
      <div
        ref={containerRef}
        className={`${className} flex items-center justify-center bg-[#F5F5F0]`}
      >
        <p className="font-display text-[13px] text-ash text-center leading-snug px-4">{title}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${className} relative overflow-hidden bg-[#F5F5F0]`}>
      <canvas
        ref={canvasRef}
        draggable={false}
        onContextMenu={e => e.preventDefault()}
        className={[
          'w-full h-full object-cover block transition-opacity duration-300',
          status === 'ready' ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 bg-line/20 animate-pulse" />
      )}
    </div>
  );
}
