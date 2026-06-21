'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  deckUrl: string;
  title: string;
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

export default function PitchDeckTile({ deckUrl, title, className = '' }: Props) {
  // ── Preview tile state ─────────────────────────────────────
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef     = useRef<HTMLDivElement>(null);
  const [thumbStatus, setThumbStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [aspectRatio, setAspectRatio] = useState(1.4142);

  // ── Modal / fullscreen state ───────────────────────────────
  const [modalOpen,   setModalOpen]   = useState(false);
  const [numPages,    setNumPages]    = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);

  // ── Shared PDF doc ref ────────────────────────────────────
  const pdfRef         = useRef<any>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef       = useRef<HTMLDivElement>(null);

  // ── Load PDF once, render preview thumb ───────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({ url: deckUrl }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);

        // Render preview (page 1, thumbnail size)
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas    = previewCanvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const vp0 = page.getViewport({ scale: 1 });
        setAspectRatio(vp0.height / vp0.width);

        const scale = (container.clientWidth || 320) / vp0.width;
        const vp    = page.getViewport({ scale });
        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);

        const ctx = canvas.getContext('2d')!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx, viewport: vp } as any).promise;
        if (cancelled) return;

        paintWatermark(canvas);
        setThumbStatus('ready');
      } catch {
        if (!cancelled) setThumbStatus('error');
      }
    }
    loadPdf();
    return () => { cancelled = true; };
  }, [deckUrl]);

  // ── Render a specific page into the modal canvas ───────────
  const renderModalPage = useCallback(async (pageNum: number) => {
    if (!pdfRef.current || !modalCanvasRef.current) return;
    setPageLoading(true);
    try {
      const page = await pdfRef.current.getPage(pageNum);

      // Fit to viewport: account for header bar (56px) + padding (32px)
      const dpr      = window.devicePixelRatio || 1;
      const maxW     = (window.innerWidth  - 32)  * dpr;
      const maxH     = (window.innerHeight - 88)  * dpr;
      const vp1      = page.getViewport({ scale: 1 });
      const fitScale = Math.min(maxW / vp1.width, maxH / vp1.height);
      const vp       = page.getViewport({ scale: fitScale });

      const canvas       = modalCanvasRef.current;
      canvas.width       = Math.floor(vp.width);
      canvas.height      = Math.floor(vp.height);
      canvas.style.width  = `${Math.floor(vp.width  / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;

      const ctx = canvas.getContext('2d')!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport: vp } as any).promise;
      paintWatermark(canvas);
    } finally {
      setPageLoading(false);
    }
  }, []);

  // ── Open / close modal ─────────────────────────────────────
  const openModal = useCallback(() => {
    setCurrentPage(1);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  // ── Render correct page whenever modal opens or page changes ─
  useEffect(() => {
    if (modalOpen) renderModalPage(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, currentPage]);

  // ── Keyboard: arrows + Escape ──────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { closeModal(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
        setCurrentPage(p => Math.min(p + 1, numPages));
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')
        setCurrentPage(p => Math.max(p - 1, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, numPages, closeModal]);

  // ── Lock body scroll while modal open ─────────────────────
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  return (
    <>
      {/* ══ PREVIEW TILE ════════════════════════════════════════ */}
      <button
        onClick={openModal}
        aria-label={`Read ${title} pitch deck`}
        className={[
          'group block relative overflow-hidden rounded-card border border-line bg-ivory text-left w-full',
          'hover:border-gold/60 hover:shadow-[0_4px_24px_rgba(191,153,83,0.12)]',
          'transition-all duration-200 cursor-pointer',
          className,
        ].join(' ')}
      >
        <div ref={containerRef} className="relative w-full overflow-hidden">
          <canvas
            ref={previewCanvasRef}
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            className={[
              'w-full h-auto block transition-opacity duration-300',
              thumbStatus === 'ready'
                ? 'opacity-100'
                : 'opacity-0 absolute inset-0 pointer-events-none',
            ].join(' ')}
          />

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

          {thumbStatus === 'error' && (
            <div
              className="w-full bg-ivory flex flex-col items-center justify-center gap-3 px-4"
              style={{ aspectRatio: `1 / ${aspectRatio}` }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-ash/30" aria-hidden="true">
                <rect x="4" y="2" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M9 9h14M9 14h14M9 19h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="font-display text-[13px] text-ash text-center leading-snug">{title}</p>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-ink/0 group-hover:bg-ink/50 transition-colors duration-200">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-ivory text-[11px] tracking-[0.22em] uppercase font-medium">
              Read deck
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
          <span className="text-[10px] tracking-[0.18em] uppercase text-ash select-none">
            Pitch deck
          </span>
          <span className="text-[10px] text-ash/40 select-none tracking-[0.06em]">
            www.fylym.com
          </span>
        </div>
      </button>

      {/* ══ FULLSCREEN MODAL ════════════════════════════════════ */}
      {modalOpen && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} pitch deck`}
          style={{
            position:       'fixed',
            inset:          0,
            zIndex:         9999,
            background:     'rgba(20,18,16,0.97)',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
          }}
        >
          {/* Header bar */}
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
            {/* Title */}
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
              maxWidth:      '50%',
            }}>
              {title}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Page counter */}
              {numPages > 1 && (
                <span style={{
                  fontSize:      11,
                  color:         'rgba(245,245,240,0.4)',
                  letterSpacing: '0.1em',
                  fontFamily:    'Montserrat, sans-serif',
                }}>
                  {currentPage} / {numPages}
                </span>
              )}

              {/* Close */}
              <button
                onClick={closeModal}
                aria-label="Close"
                style={{
                  width:          32,
                  height:         32,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  background:     'transparent',
                  border:         'none',
                  cursor:         'pointer',
                  color:          'rgba(245,245,240,0.5)',
                  borderRadius:   6,
                  transition:     'color 0.15s',
                  padding:        0,
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#F5F5F0')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(245,245,240,0.5)')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Page canvas area */}
          <div style={{
            flex:           1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          '100%',
            position:       'relative',
            overflow:       'hidden',
            padding:        '16px 0',
          }}>
            {/* Prev arrow */}
            {numPages > 1 && (
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                style={{
                  position:       'absolute',
                  left:           12,
                  top:            '50%',
                  transform:      'translateY(-50%)',
                  zIndex:         1,
                  width:          40,
                  height:         40,
                  borderRadius:   '50%',
                  border:         '1px solid rgba(255,255,255,0.12)',
                  background:     'rgba(255,255,255,0.05)',
                  color:          currentPage <= 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                  cursor:         currentPage <= 1 ? 'default' : 'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  transition:     'background 0.15s, color 0.15s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Canvas */}
            <canvas
              ref={modalCanvasRef}
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              style={{
                display:   'block',
                maxWidth:  'calc(100vw - 32px)',
                maxHeight: 'calc(100vh - 88px)',
                opacity:   pageLoading ? 0.4 : 1,
                transition:'opacity 0.15s',
                boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
              }}
            />

            {/* Next arrow */}
            {numPages > 1 && (
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, numPages))}
                disabled={currentPage >= numPages}
                aria-label="Next page"
                style={{
                  position:       'absolute',
                  right:          12,
                  top:            '50%',
                  transform:      'translateY(-50%)',
                  zIndex:         1,
                  width:          40,
                  height:         40,
                  borderRadius:   '50%',
                  border:         '1px solid rgba(255,255,255,0.12)',
                  background:     'rgba(255,255,255,0.05)',
                  color:          currentPage >= numPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                  cursor:         currentPage >= numPages ? 'default' : 'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  transition:     'background 0.15s, color 0.15s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Bottom: watermark credit + keyboard hint */}
          <div style={{
            height:         32,
            flexShrink:     0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            width:          '100%',
            padding:        '0 20px',
          }}>
            <span style={{
              fontSize:      9,
              color:         'rgba(255,255,255,0.18)',
              letterSpacing: '0.14em',
              fontFamily:    'Montserrat, sans-serif',
            }}>
              www.fylym.com
            </span>
            {numPages > 1 && (
              <span style={{
                fontSize:      9,
                color:         'rgba(255,255,255,0.18)',
                letterSpacing: '0.1em',
                fontFamily:    'Montserrat, sans-serif',
              }}>
                ← → to navigate · Esc to close
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
