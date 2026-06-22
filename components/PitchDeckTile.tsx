'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  deckUrl:   string;
  title:     string;
  className?: string;
}

// ── Watermark ────────────────────────────────────────────────
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

export default function PitchDeckTile({ deckUrl, title, className = '' }: Props) {

  // ── Thumbnail state ────────────────────────────────────────
  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const thumbCanvasRef    = useRef<HTMLCanvasElement>(null);
  const [thumbStatus, setThumbStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [aspectRatio, setAspectRatio] = useState(1.4142);

  // ── Shared PDF ref (loaded once, reused by modal) ──────────
  const pdfDocRef  = useRef<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);

  // ── Modal state ────────────────────────────────────────────
  const [modalOpen,    setModalOpen]    = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [pageRendering, setPageRendering] = useState(false);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load PDF + render thumbnail ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({ url: deckUrl }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPdfReady(true);

        // Render page 1 into thumbnail canvas
        const page    = await pdf.getPage(1);
        const canvas  = thumbCanvasRef.current;
        const wrapper = thumbContainerRef.current;
        if (cancelled || !canvas || !wrapper) return;

        const vp0 = page.getViewport({ scale: 1 });
        setAspectRatio(vp0.height / vp0.width);

        const scale = (wrapper.clientWidth || 320) / vp0.width;
        const vp    = page.getViewport({ scale });
        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);

        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp } as any).promise;
        if (cancelled) return;

        paintWatermark(canvas);
        setThumbStatus('ready');
      } catch {
        if (!cancelled) setThumbStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [deckUrl]);

  // ── Render a page into the modal canvas ───────────────────
  const renderPage = useCallback(async (pageNum: number) => {
    const pdf    = pdfDocRef.current;
    const canvas = modalCanvasRef.current;
    if (!pdf || !canvas) return;

    setPageRendering(true);
    try {
      const page  = await pdf.getPage(pageNum);
      const dpr   = window.devicePixelRatio || 1;
      const maxW  = (window.innerWidth  - 40) * dpr;
      const maxH  = (window.innerHeight - 96) * dpr;
      const vp1   = page.getViewport({ scale: 1 });
      const scale = Math.min(maxW / vp1.width, maxH / vp1.height);
      const vp    = page.getViewport({ scale });

      canvas.width        = Math.floor(vp.width);
      canvas.height       = Math.floor(vp.height);
      canvas.style.width  = `${Math.floor(vp.width  / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp } as any).promise;
      paintWatermark(canvas);
    } finally {
      setPageRendering(false);
    }
  }, []);

  // ── Trigger page render whenever modal is open + page changes
  // requestAnimationFrame ensures modal DOM (and canvas) is painted before we try to draw
  useEffect(() => {
    if (!modalOpen) return;
    const raf = requestAnimationFrame(() => {
      renderPage(currentPage);
    });
    return () => cancelAnimationFrame(raf);
  }, [modalOpen, currentPage, renderPage]);

  // ── Keyboard ───────────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')                              setModalOpen(false);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage(p => Math.min(p + 1, numPages));
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   setCurrentPage(p => Math.max(p - 1, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, numPages]);

  // ── Body scroll lock ───────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  // ── Open modal ─────────────────────────────────────────────
  function openModal() {
    setCurrentPage(1);
    setModalOpen(true);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {/* THUMBNAIL TILE */}
      <button
        onClick={openModal}
        disabled={!pdfReady}
        aria-label={`Read ${title} pitch deck`}
        className={[
          'group block relative overflow-hidden rounded-card border border-line bg-ivory text-left w-full',
          'hover:border-gold/60 hover:shadow-[0_4px_24px_rgba(191,153,83,0.12)]',
          'transition-all duration-200',
          pdfReady ? 'cursor-pointer' : 'cursor-wait',
          className,
        ].join(' ')}
      >
        <div ref={thumbContainerRef} className="relative w-full overflow-hidden">
          {/* Rendered canvas */}
          <canvas
            ref={thumbCanvasRef}
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            className={[
              'w-full h-auto block transition-opacity duration-300',
              thumbStatus === 'ready' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none',
            ].join(' ')}
          />

          {/* Loading skeleton */}
          {thumbStatus === 'loading' && (
            <div
              className="w-full bg-line/20 animate-pulse flex items-center justify-center"
              style={{ aspectRatio: `1 / ${aspectRatio}` }}
            >
              <span className="text-[10px] tracking-[0.2em] uppercase text-ash/50 select-none">
                Loading…
              </span>
            </div>
          )}

          {/* Error fallback */}
          {thumbStatus === 'error' && (
            <div
              className="w-full bg-ivory flex flex-col items-center justify-center gap-3 px-4"
              style={{ aspectRatio: `1 / ${aspectRatio}` }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-ash/30">
                <rect x="4" y="2" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M9 9h14M9 14h14M9 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M24 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <p className="font-display text-[13px] text-ash text-center leading-snug">{title}</p>
            </div>
          )}

          {/* Hover: read deck */}
          {pdfReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-ink/0 group-hover:bg-ink/50 transition-colors duration-200">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-ivory text-[11px] tracking-[0.22em] uppercase font-medium">
                Read deck
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
          <span className="text-[10px] tracking-[0.18em] uppercase text-ash select-none">Pitch deck</span>
          <span className="text-[10px] text-ash/40 select-none tracking-[0.06em]">www.fylym.com</span>
        </div>
      </button>

      {/* FULLSCREEN MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} pitch deck`}
          style={{
            position:      'fixed',
            inset:         0,
            zIndex:        9999,
            background:    'rgba(20,18,16,0.97)',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          {/* Header */}
          <div style={{
            width:          '100%',
            height:         56,
            flexShrink:     0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '0 20px',
            borderBottom:   '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{
              fontFamily:    "'Playfair Display', Georgia, serif",
              fontSize:      13,
              fontWeight:    700,
              color:         'rgba(245,245,240,0.9)',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              whiteSpace:    'nowrap',
              maxWidth:      '60%',
            }}>
              {title}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {numPages > 1 && (
                <span style={{ fontSize: 11, color: 'rgba(245,245,240,0.4)', letterSpacing: '0.1em', fontFamily: 'Montserrat, sans-serif' }}>
                  {currentPage} / {numPages}
                </span>
              )}
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'rgba(245,245,240,0.5)', borderRadius: 6, padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div style={{
            flex:           1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          '100%',
            position:       'relative',
            overflow:       'hidden',
            padding:        '16px 60px',
          }}>
            {/* Prev */}
            {numPages > 1 && (
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
                style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  zIndex: 1, width: 40, height: 40, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: currentPage <= 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                  cursor: currentPage <= 1 ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Page canvas */}
            <canvas
              ref={modalCanvasRef}
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              style={{
                display:    'block',
                maxWidth:   'calc(100vw - 40px)',
                maxHeight:  'calc(100vh - 96px)',
                opacity:    pageRendering ? 0.35 : 1,
                transition: 'opacity 0.15s',
                boxShadow:  '0 4px 40px rgba(0,0,0,0.5)',
              }}
            />

            {/* Next */}
            {numPages > 1 && (
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, numPages))}
                disabled={currentPage >= numPages}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  zIndex: 1, width: 40, height: 40, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: currentPage >= numPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                  cursor: currentPage >= numPages ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Footer */}
          <div style={{
            height: 32, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0 20px',
          }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.14em', fontFamily: 'Montserrat, sans-serif' }}>
              www.fylym.com
            </span>
            {numPages > 1 && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.1em', fontFamily: 'Montserrat, sans-serif' }}>
                ← → to navigate · Esc to close
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
