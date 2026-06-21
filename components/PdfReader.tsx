'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────
const THUMB_SCALE  = 0.13;
const ZOOM_STEP    = 0.15;
const ZOOM_MIN     = 0.3;
const ZOOM_MAX     = 3.0;
const STORAGE_KEY  = (id: string) => `fyp_deck_pg_${id}`;

const CAREER_LABEL: Record<string, string> = {
  debut:        'Debut filmmaker',
  second_film:  '2nd feature',
  established:  'Established director',
  veteran:      'Veteran director',
};

// ─── Types ────────────────────────────────────────────────────────────────
type LoadState = 'loading' | 'ready' | 'error';
type ZoomMode  = 'fitWidth' | 'fitPage' | 'custom';

interface FilmmakerInfo {
  full_name:    string;
  avatar_url?:  string | null;
  career_stage?: string | null;
}

export interface PdfReaderProps {
  deckUrl:       string;
  projectId:     string;
  title:         string;
  genre?:        string | null;
  format?:       string | null;
  stage?:        string | null;
  country?:      string | null;
  language?:     string | null;
  logline?:      string | null;
  synopsis?:     string | null;
  filmmaker?:    FilmmakerInfo | null;
  budgetDisplay?: string | null;
  isProducer?:   boolean;
  isOwnProject?: boolean;
  isLoggedIn?:   boolean;
  contactHref?:  string | null;
  editHref?:     string | null;
  backHref?:     string;
  onSave?:       () => void;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────
const Icon = {
  ChevLeft:  () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ChevRight: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ZoomIn:    () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 11l3 3M5.5 7h3M7 5.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  ZoomOut:   () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 11l3 3M5.5 7h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  FitWidth:  () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M2 8h12" stroke="currentColor" strokeWidth="1.4"/></svg>,
  FitPage:   () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="1.5" width="9" height="13" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>,
  Rotate:    () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M8 1v4l3-2-3-2z" fill="currentColor"/></svg>,
  Search:    () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Fullscreen:() => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ExitFS:    () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Print:     () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M5 6V3h6v3M5 10h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="9" r="0.8" fill="currentColor"/></svg>,
  Download:  () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Close:     () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Sidebar:   () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2" width="13" height="12" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 2v12" stroke="currentColor" strokeWidth="1.4"/></svg>,
  Thumbs:    () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2" width="13" height="12" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 2v12" stroke="currentColor" strokeWidth="1.4"/></svg>,
};

// ─── Toolbar button ───────────────────────────────────────────────────────
function TBtn({
  onClick, title, active = false, disabled = false, children,
}: {
  onClick: () => void; title: string; active?: boolean;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={title}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          30,
        height:         30,
        borderRadius:   6,
        border:         'none',
        background:     active ? 'rgba(191,153,83,0.12)' : 'transparent',
        color:          active ? '#BF9953' : disabled ? '#C8C3BB' : '#8A857C',
        cursor:         disabled ? 'default' : 'pointer',
        flexShrink:     0,
        transition:     'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled && !active) (e.currentTarget as HTMLButtonElement).style.color = '#1A1815'; }}
      onMouseLeave={e => { if (!disabled && !active) (e.currentTarget as HTMLButtonElement).style.color = '#8A857C'; }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'rgba(26,24,21,0.1)', flexShrink: 0 }} />;
}

// ─── Component ───────────────────────────────────────────────────────────
export default function PdfReader({
  deckUrl, projectId, title, genre, format, stage, country,
  language, logline, synopsis, filmmaker, budgetDisplay,
  isProducer, isOwnProject, isLoggedIn, contactHref, editHref,
  backHref = '/projects',
}: PdfReaderProps) {

  // ── Load state ────────────────────────────────────────────
  const [loadState, setLoadState]   = useState<LoadState>('loading');
  const [numPages,  setNumPages]    = useState(0);
  const [fileSize,  setFileSize]    = useState('');

  // ── View state ────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [scale,       setScale]       = useState(1.0);
  const [zoomMode,    setZoomMode]    = useState<ZoomMode>('fitWidth');
  const [rotation,    setRotation]    = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── UI toggles ────────────────────────────────────────────
  const [thumbsOpen,  setThumbsOpen]  = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits,  setSearchHits]  = useState<Set<number>>(new Set());
  const [searching,   setSearching]   = useState(false);

  // ── Page input ────────────────────────────────────────────
  const [pageInput, setPageInput] = useState('1');

  // ── Refs ──────────────────────────────────────────────────
  const readerRef     = useRef<HTMLDivElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const thumbsRef     = useRef<HTMLDivElement>(null);
  const pdfRef        = useRef<any>(null);
  const pageEls       = useRef<Map<number, HTMLDivElement>>(new Map());
  const canvasEls     = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const thumbEls      = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedPages = useRef<Set<number>>(new Set());
  const baseWidth     = useRef<number>(800);
  const baseHeight    = useRef<number>(1131);
  const pageTexts     = useRef<Map<number, string>>(new Map());
  const searchRef     = useRef<HTMLInputElement>(null);
  const observerRef   = useRef<IntersectionObserver | null>(null);

  // ── Render a single page to a canvas ──────────────────────
  const renderPageToCanvas = useCallback(async (
    pageNum: number,
    canvas: HTMLCanvasElement,
    s: number,
    rot: number,
  ) => {
    if (!pdfRef.current) return;
    try {
      const page    = await pdfRef.current.getPage(pageNum);
      const dpr     = window.devicePixelRatio || 1;
      const vp      = page.getViewport({ scale: s * dpr, rotation: rot });
      canvas.width  = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width  = `${Math.floor(vp.width  / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp } as any).promise;
    } catch { /* page already destroyed or cancelled */ }
  }, []);

  // ── Calculate fit-to-width scale ──────────────────────────
  const calcFitWidth = useCallback(() => {
    if (!scrollRef.current) return 1;
    const avail = scrollRef.current.clientWidth - 48; // 24px padding each side
    return Math.max(0.3, avail / baseWidth.current);
  }, []);

  const calcFitPage = useCallback(() => {
    if (!scrollRef.current) return 1;
    const aw = scrollRef.current.clientWidth  - 48;
    const ah = scrollRef.current.clientHeight - 48;
    const sw = aw / baseWidth.current;
    const sh = ah / baseHeight.current;
    return Math.max(0.3, Math.min(sw, sh));
  }, []);

  // ── Re-render all visible pages after scale / rotation changes ──
  const reRenderVisible = useCallback(async (s: number, rot: number) => {
    renderedPages.current.clear();
    for (const [pageNum, canvas] of canvasEls.current) {
      const el = pageEls.current.get(pageNum);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 300 && rect.bottom > -300) {
        await renderPageToCanvas(pageNum, canvas, s, rot);
        renderedPages.current.add(pageNum);
      }
    }
  }, [renderPageToCanvas]);

  // ── Scroll to page ────────────────────────────────────────
  const goToPage = useCallback((num: number) => {
    const n = Math.max(1, Math.min(num, numPages));
    const el = pageEls.current.get(n);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    }
    setCurrentPage(n);
    setPageInput(String(n));
    try { localStorage.setItem(STORAGE_KEY(projectId), String(n)); } catch { /* ignore */ }
    // Sync thumbnail scroll
    const thumbEl = thumbEls.current.get(n);
    if (thumbEl && thumbsRef.current) {
      thumbEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [numPages, projectId]);

  // ── Load PDF ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({ url: deckUrl }).promise;
        if (cancelled) return;

        pdfRef.current = pdf;
        setNumPages(pdf.numPages);

        // Grab page 1 dimensions for scale calculations
        const page1 = await pdf.getPage(1);
        if (cancelled) return;
        const vp1 = page1.getViewport({ scale: 1 });
        baseWidth.current  = vp1.width;
        baseHeight.current = vp1.height;

        // Set initial fit-width scale
        const initScale = scrollRef.current
          ? Math.max(0.3, (scrollRef.current.clientWidth - 48) / vp1.width)
          : 1.0;
        if (!cancelled) setScale(initScale);

        setLoadState('ready');

        // Restore last-viewed page
        let startPage = 1;
        try {
          const saved = localStorage.getItem(STORAGE_KEY(projectId));
          if (saved) startPage = Math.min(parseInt(saved, 10) || 1, pdf.numPages);
        } catch { /* ignore */ }

        // Render thumbnails for all pages (background, small)
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const canvas = thumbEls.current.get(i);
          if (!canvas) continue;
          const pg  = await pdf.getPage(i);
          const tvp = pg.getViewport({ scale: THUMB_SCALE });
          canvas.width  = Math.floor(tvp.width);
          canvas.height = Math.floor(tvp.height);
          const ctx = canvas.getContext('2d');
          if (ctx) await pg.render({ canvasContext: ctx, viewport: tvp } as any).promise;
        }

        // Extract text for search (background)
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const pg = await pdf.getPage(i);
          const tc = await pg.getTextContent();
          const text = (tc.items as any[]).map((it: any) => it.str || '').join(' ');
          pageTexts.current.set(i, text.toLowerCase());
        }

        if (!cancelled && startPage > 1) {
          setTimeout(() => goToPage(startPage), 100);
        }
      } catch {
        if (!cancelled) setLoadState('error');
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckUrl, projectId]);

  // ── IntersectionObserver: render pages when they scroll into view ──
  useEffect(() => {
    if (loadState !== 'ready' || !scrollRef.current) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          const pageNum = parseInt((entry.target as HTMLElement).dataset.page || '0', 10);
          if (!pageNum) return;
          if (entry.isIntersecting) {
            // Current page tracking
            if (entry.intersectionRatio > 0.4) {
              setCurrentPage(pageNum);
              setPageInput(String(pageNum));
              try { localStorage.setItem(STORAGE_KEY(projectId), String(pageNum)); } catch { /* ignore */ }
            }
            // Render if not already done
            if (!renderedPages.current.has(pageNum)) {
              const canvas = canvasEls.current.get(pageNum);
              if (canvas) {
                await renderPageToCanvas(pageNum, canvas, scale, rotation);
                renderedPages.current.add(pageNum);
              }
            }
          }
        });
      },
      { root: scrollRef.current, threshold: [0.1, 0.4], rootMargin: '200px 0px' }
    );

    pageEls.current.forEach((el) => observerRef.current!.observe(el));

    return () => observerRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, numPages]);

  // ── Re-render on scale / rotation change ──────────────────
  useEffect(() => {
    if (loadState !== 'ready') return;
    reRenderVisible(scale, rotation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, rotation]);

  // ── Fullscreen listener ────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowLeft':  case 'ArrowUp':   case 'j': goToPage(currentPage - 1); break;
        case 'ArrowRight': case 'ArrowDown': case 'k': goToPage(currentPage + 1); break;
        case '+': case '=': handleZoomIn();  break;
        case '-':           handleZoomOut(); break;
        case 'f': case 'F': if (!e.ctrlKey && !e.metaKey) { setZoomMode('fitWidth');  setScale(calcFitWidth()); } break;
        case 'p': case 'P': if (!e.ctrlKey && !e.metaKey) { setZoomMode('fitPage');   setScale(calcFitPage());  } break;
        case 'r': case 'R': setRotation(r => (r + 90) % 360); break;
        case '/': e.preventDefault(); setSearchOpen(s => !s); setTimeout(() => searchRef.current?.focus(), 50); break;
        case 'Escape':
          if (searchOpen)      { setSearchOpen(false); setSearchQuery(''); setSearchHits(new Set()); }
          else if (isFullscreen) document.exitFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages, scale, searchOpen, isFullscreen]);

  // ── Zoom helpers ──────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    setZoomMode('custom');
    setScale(s => Math.min(s + ZOOM_STEP, ZOOM_MAX));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoomMode('custom');
    setScale(s => Math.max(s - ZOOM_STEP, ZOOM_MIN));
  }, []);

  // ── Search ────────────────────────────────────────────────
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchHits(new Set()); return; }
    setSearching(true);
    const query = q.toLowerCase().trim();
    const hits = new Set<number>();
    pageTexts.current.forEach((text, pageNum) => {
      if (text.includes(query)) hits.add(pageNum);
    });
    setSearchHits(hits);
    setSearching(false);
    // Jump to first hit
    if (hits.size > 0) {
      const first = Math.min(...hits);
      goToPage(first);
    }
  }, [goToPage]);

  // ── Print ─────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const w = window.open(deckUrl);
    if (w) setTimeout(() => w.print(), 1500);
  }, [deckUrl]);

  // ── Download ──────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href     = deckUrl;
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-pitch-deck.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [deckUrl, title]);

  // ── Fullscreen ────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!readerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else readerRef.current.requestFullscreen();
  }, []);

  // ── Computed ──────────────────────────────────────────────
  const metaLine = [format, genre, country, language, stage]
    .filter(Boolean).join(' · ');

  // ── Render page placeholder (registered with refs) ────────
  function PagePlaceholder({ num }: { num: number }) {
    const aspect = baseHeight.current / baseWidth.current;
    return (
      <div
        ref={el => { if (el) pageEls.current.set(num, el); }}
        data-page={num}
        style={{
          display:        'flex',
          justifyContent: 'center',
          padding:        '12px 24px',
        }}
      >
        <canvas
          ref={el => { if (el) canvasEls.current.set(num, el); }}
          style={{
            display:    'block',
            maxWidth:   '100%',
            background: '#fff',
            boxShadow:  '0 1px 8px rgba(26,24,21,0.10), 0 0 0 1px rgba(26,24,21,0.05)',
            /* Placeholder size while loading */
            width:      Math.floor(baseWidth.current  * scale),
            height:     Math.floor(baseWidth.current  * scale * aspect),
          }}
          aria-label={`Page ${num} of ${numPages}`}
        />
      </div>
    );
  }

  // ── Thumbnail item ────────────────────────────────────────
  function ThumbItem({ num }: { num: number }) {
    const isActive = num === currentPage;
    const hasHit   = searchHits.has(num);
    return (
      <button
        onClick={() => goToPage(num)}
        title={`Page ${num}`}
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           4,
          padding:       '8px 6px',
          border:        'none',
          background:    'transparent',
          cursor:        'pointer',
          width:         '100%',
          position:      'relative',
        }}
      >
        <div style={{
          border:     `2px solid ${isActive ? '#BF9953' : 'transparent'}`,
          borderRadius: 4,
          overflow:   'hidden',
          transition: 'border-color 0.15s',
          lineHeight: 0,
        }}>
          <canvas
            ref={el => { if (el) thumbEls.current.set(num, el); }}
            style={{
              display:  'block',
              width:    Math.floor(baseWidth.current  * THUMB_SCALE),
              height:   Math.floor(baseHeight.current * THUMB_SCALE),
              maxWidth: 96,
              background: '#fafaf9',
            }}
          />
        </div>
        <span style={{
          fontSize:      9,
          color:         isActive ? '#BF9953' : '#8A857C',
          fontFamily:    'Montserrat, sans-serif',
          letterSpacing: '0.08em',
          fontWeight:    isActive ? 600 : 400,
        }}>
          {num}
        </span>
        {hasHit && (
          <span style={{
            position:   'absolute',
            top:        6,
            right:      4,
            width:      7,
            height:     7,
            background: '#BF9953',
            borderRadius: '50%',
          }} />
        )}
      </button>
    );
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <div
      ref={readerRef}
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        'calc(100vh - 65px)',
        background:    '#F5F5F0',
        overflow:      'hidden',
        fontFamily:    'Montserrat, sans-serif',
      }}
    >

      {/* ══════════════════════════════════════════════════════
          TOOLBAR
      ══════════════════════════════════════════════════════ */}
      <div style={{
        height:       48,
        flexShrink:   0,
        display:      'flex',
        alignItems:   'center',
        gap:          4,
        padding:      '0 12px',
        background:   '#F5F5F0',
        borderBottom: '1px solid rgba(26,24,21,0.1)',
        overflow:     'hidden',
      }}>
        {/* Back */}
        <Link href={backHref || '/projects'} style={{
          display:    'flex',
          alignItems: 'center',
          gap:        4,
          fontSize:   11,
          color:      '#8A857C',
          textDecoration: 'none',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          flexShrink: 0,
          marginRight: 4,
        }}>
          <Icon.ChevLeft /> Back
        </Link>

        {/* Title */}
        <span style={{
          fontFamily:   "'Playfair Display', Georgia, serif",
          fontSize:     14,
          fontWeight:   700,
          color:        '#1A1815',
          letterSpacing: '-0.01em',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          maxWidth:     200,
          flexShrink:   1,
        }}>
          {title.toUpperCase()}
        </span>

        <Divider />

        {/* Page navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <TBtn onClick={() => goToPage(currentPage - 1)} title="Previous page (←)" disabled={currentPage <= 1}>
            <Icon.ChevLeft />
          </TBtn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') goToPage(parseInt(pageInput, 10) || 1); }}
              onBlur={() => goToPage(parseInt(pageInput, 10) || 1)}
              style={{
                width:       32,
                textAlign:   'center',
                fontSize:    12,
                border:      '1px solid rgba(26,24,21,0.15)',
                borderRadius: 4,
                padding:     '2px 4px',
                background:  '#fff',
                color:       '#1A1815',
                fontFamily:  'Montserrat, sans-serif',
              }}
              aria-label="Current page"
            />
            <span style={{ fontSize: 11, color: '#8A857C' }}>/ {numPages || '—'}</span>
          </div>
          <TBtn onClick={() => goToPage(currentPage + 1)} title="Next page (→)" disabled={currentPage >= numPages}>
            <Icon.ChevRight />
          </TBtn>
        </div>

        <Divider />

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <TBtn onClick={handleZoomOut} title="Zoom out (−)" disabled={scale <= ZOOM_MIN}><Icon.ZoomOut /></TBtn>
          <span style={{ fontSize: 11, color: '#1A1815', minWidth: 36, textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>
            {Math.round(scale * 100)}%
          </span>
          <TBtn onClick={handleZoomIn}  title="Zoom in (+)" disabled={scale >= ZOOM_MAX}><Icon.ZoomIn /></TBtn>
          <TBtn
            onClick={() => { setZoomMode('fitWidth'); setScale(calcFitWidth()); renderedPages.current.clear(); }}
            title="Fit to width (F)"
            active={zoomMode === 'fitWidth'}
          ><Icon.FitWidth /></TBtn>
          <TBtn
            onClick={() => { setZoomMode('fitPage'); setScale(calcFitPage()); renderedPages.current.clear(); }}
            title="Fit page (P)"
            active={zoomMode === 'fitPage'}
          ><Icon.FitPage /></TBtn>
        </div>

        <Divider />

        {/* Tools */}
        <TBtn onClick={() => setRotation(r => (r + 90) % 360)} title="Rotate (R)"><Icon.Rotate /></TBtn>
        <TBtn
          onClick={() => { setSearchOpen(s => !s); setTimeout(() => searchRef.current?.focus(), 50); }}
          title="Search (/)"
          active={searchOpen}
        ><Icon.Search /></TBtn>

        {/* Search bar */}
        {searchOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search deck…"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width:       160,
                fontSize:    12,
                border:      '1px solid rgba(191,153,83,0.5)',
                borderRadius: 4,
                padding:     '3px 8px',
                background:  '#fff',
                color:       '#1A1815',
                fontFamily:  'Montserrat, sans-serif',
                outline:     'none',
              }}
              aria-label="Search in PDF"
            />
            {searchQuery && (
              <span style={{ fontSize: 10, color: '#8A857C', flexShrink: 0 }}>
                {searching ? '…' : searchHits.size === 0 ? 'No results' : `${searchHits.size} page${searchHits.size > 1 ? 's' : ''}`}
              </span>
            )}
            <TBtn onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchHits(new Set()); }} title="Close search">
              <Icon.Close />
            </TBtn>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Panels */}
        <TBtn onClick={() => setThumbsOpen(t => !t)} title="Toggle thumbnail panel" active={thumbsOpen}><Icon.Thumbs /></TBtn>
        <TBtn onClick={() => setSidebarOpen(s => !s)} title="Toggle sidebar" active={sidebarOpen}><Icon.Sidebar /></TBtn>

        <Divider />

        <TBtn onClick={handlePrint}    title="Print"><Icon.Print /></TBtn>
        <TBtn onClick={handleDownload} title="Download pitch deck"><Icon.Download /></TBtn>
        <TBtn onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Icon.ExitFS /> : <Icon.Fullscreen />}
        </TBtn>
      </div>

      {/* ══════════════════════════════════════════════════════
          BODY: THUMBS | PAGES | SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: Thumbnails ─────────────────────────────── */}
        {thumbsOpen && (
          <div
            ref={thumbsRef}
            style={{
              width:       112,
              flexShrink:  0,
              overflowY:   'auto',
              borderRight: '1px solid rgba(26,24,21,0.08)',
              background:  '#EFECE5',
              paddingBottom: 16,
            }}
          >
            <div style={{
              position:      'sticky',
              top:           0,
              background:    '#EFECE5',
              padding:       '8px 6px 6px',
              borderBottom:  '1px solid rgba(26,24,21,0.08)',
              marginBottom:  4,
            }}>
              <span style={{
                fontSize:      8,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color:         '#8A857C',
                fontWeight:    600,
              }}>Pages</span>
            </div>
            {loadState === 'ready' && Array.from({ length: numPages }, (_, i) => (
              <ThumbItem key={i + 1} num={i + 1} />
            ))}
            {loadState === 'loading' && Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ margin: '8px 6px', height: Math.floor(baseHeight.current * THUMB_SCALE), background: 'rgba(26,24,21,0.06)', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* ── Centre: Main scroll area ─────────────────────── */}
        <div
          ref={scrollRef}
          style={{
            flex:       1,
            overflowY:  'auto',
            overflowX:  'hidden',
            background: '#D8D4CC',
            padding:    '16px 0 40px',
          }}
          role="main"
          aria-label="PDF document"
        >
          {loadState === 'loading' && (
            <div style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              gap:            16,
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ color: '#BF9953' }}>
                <rect x="4" y="2" width="22" height="30" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 10h14M9 15h14M9 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A857C', marginBottom: 4 }}>Loading pitch deck</p>
                <p style={{ fontSize: 10, color: 'rgba(138,133,124,0.6)', letterSpacing: '0.1em' }}>{title.toUpperCase()}</p>
              </div>
              {/* Animated bar */}
              <div style={{ width: 120, height: 2, background: 'rgba(191,153,83,0.2)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{
                  height:    '100%',
                  width:     '40%',
                  background: '#BF9953',
                  borderRadius: 1,
                  animation: 'fyp-slide 1.2s ease-in-out infinite',
                }} />
              </div>
            </div>
          )}

          {loadState === 'error' && (
            <div style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              gap:            12,
            }}>
              <p style={{ fontSize: 12, color: '#8A857C', letterSpacing: '0.1em' }}>Unable to load pitch deck</p>
              <a href={deckUrl} target="_blank" rel="noreferrer" style={{
                fontSize:    11,
                color:       '#BF9953',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}>Open in browser ↗</a>
            </div>
          )}

          {loadState === 'ready' && Array.from({ length: numPages }, (_, i) => (
            <PagePlaceholder key={i + 1} num={i + 1} />
          ))}
        </div>

        {/* ── Right: Sidebar ────────────────────────────────── */}
        {sidebarOpen && (
          <div style={{
            width:       268,
            flexShrink:  0,
            overflowY:   'auto',
            borderLeft:  '1px solid rgba(26,24,21,0.08)',
            background:  '#F5F5F0',
            padding:     '16px 16px 32px',
            display:     'flex',
            flexDirection: 'column',
            gap:         16,
          }}>

            {/* Film title */}
            <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(26,24,21,0.08)' }}>
              <h2 style={{
                fontFamily:   "'Playfair Display', Georgia, serif",
                fontSize:     18,
                fontWeight:   700,
                color:        '#1A1815',
                lineHeight:   1.1,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>{title}</h2>
              {metaLine && (
                <p style={{ fontSize: 10, color: '#8A857C', letterSpacing: '0.12em', lineHeight: 1.5, textTransform: 'uppercase' }}>
                  {metaLine}
                </p>
              )}
              {logline && (
                <p style={{
                  marginTop:   8,
                  fontFamily:  "'Playfair Display', Georgia, serif",
                  fontStyle:   'italic',
                  fontSize:    13,
                  color:       '#1A1815',
                  lineHeight:  1.55,
                }}>
                  {logline}
                </p>
              )}
              {budgetDisplay && (
                <p style={{ marginTop: 6, fontSize: 11, color: '#BF9953', letterSpacing: '0.1em' }}>
                  Budget — {budgetDisplay}
                </p>
              )}
            </div>

            {/* File info */}
            <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(26,24,21,0.08)' }}>
              <p style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A857C', fontWeight: 600, marginBottom: 8 }}>
                Deck
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A857C' }}>
                  <span>Pages</span>
                  <span style={{ color: '#1A1815' }}>{numPages || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A857C' }}>
                  <span>Current page</span>
                  <span style={{ color: '#1A1815' }}>{currentPage}</span>
                </div>
                {searchHits.size > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A857C' }}>
                    <span>Search hits</span>
                    <span style={{ color: '#BF9953' }}>{searchHits.size} page{searchHits.size > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Filmmaker */}
            {filmmaker && (
              <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(26,24,21,0.08)' }}>
                <p style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A857C', fontWeight: 600, marginBottom: 8 }}>
                  Filmmaker
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width:        36,
                    height:       36,
                    borderRadius: '50%',
                    overflow:     'hidden',
                    background:   '#EFECE5',
                    border:       '1px solid rgba(26,24,21,0.1)',
                    flexShrink:   0,
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                  }}>
                    {filmmaker.avatar_url ? (
                      <img src={filmmaker.avatar_url} alt={filmmaker.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: '#8A857C' }}>
                        {filmmaker.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: '#1A1815', fontWeight: 500, lineHeight: 1.2 }}>{filmmaker.full_name}</p>
                    {filmmaker.career_stage && (
                      <p style={{ fontSize: 10, color: '#8A857C', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                        {CAREER_LABEL[filmmaker.career_stage] ?? filmmaker.career_stage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Synopsis snippet */}
            {synopsis && (
              <div style={{ paddingBottom: 14, borderBottom: '1px solid rgba(26,24,21,0.08)' }}>
                <p style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A857C', fontWeight: 600, marginBottom: 8 }}>
                  Synopsis
                </p>
                <p style={{ fontSize: 12, color: '#1A1815', lineHeight: 1.65 }}>
                  {synopsis.length > 220 ? synopsis.slice(0, 220) + '…' : synopsis}
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
              {isProducer && contactHref && (
                <Link href={contactHref} style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '9px 16px',
                  background:     '#BF9953',
                  color:          '#fff',
                  borderRadius:   6,
                  fontSize:       11,
                  fontWeight:     600,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  textDecoration: 'none',
                  transition:     'opacity 0.15s',
                }}>
                  Contact Filmmaker
                </Link>
              )}
              {!isLoggedIn && (
                <Link href="/signup" style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  padding:        '9px 16px',
                  background:     '#BF9953',
                  color:          '#fff',
                  borderRadius:   6,
                  fontSize:       11,
                  fontWeight:     600,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  textDecoration: 'none',
                }}>
                  Join PITCH.FYLYM
                </Link>
              )}
              <button
                onClick={handleDownload}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            6,
                  padding:        '9px 16px',
                  background:     'transparent',
                  border:         '1px solid rgba(26,24,21,0.2)',
                  color:          '#1A1815',
                  borderRadius:   6,
                  fontSize:       11,
                  fontWeight:     600,
                  letterSpacing:  '0.14em',
                  textTransform:  'uppercase',
                  cursor:         'pointer',
                  transition:     'border-color 0.15s',
                  fontFamily:     'Montserrat, sans-serif',
                }}
              >
                <Icon.Download /> Download deck
              </button>
              {isOwnProject && editHref && (
                <Link href={editHref} style={{
                  textAlign:      'center',
                  padding:        '8px 16px',
                  border:         '1px solid rgba(26,24,21,0.15)',
                  borderRadius:   6,
                  fontSize:       11,
                  color:          '#8A857C',
                  textDecoration: 'none',
                  letterSpacing:  '0.12em',
                  textTransform:  'uppercase',
                }}>
                  Edit project
                </Link>
              )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div style={{
              marginTop:   8,
              padding:     10,
              background:  'rgba(26,24,21,0.03)',
              borderRadius: 6,
              border:      '1px solid rgba(26,24,21,0.06)',
            }}>
              <p style={{ fontSize: 8.5, color: '#8A857C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>Shortcuts</p>
              {[
                ['←  →', 'Navigate pages'],
                ['+  −', 'Zoom'],
                ['F',    'Fit to width'],
                ['/',    'Search'],
                ['R',    'Rotate'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#8A857C', marginBottom: 3 }}>
                  <span style={{ fontFamily: 'monospace', color: '#1A1815', fontSize: 9 }}>{key}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>

      <style>{`
        @keyframes fyp-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 0.3; }
        }
        /* Mobile: hide thumbs + sidebar panels */
        @media (max-width: 768px) {
          .fyp-pdf-thumbs   { display: none !important; }
          .fyp-pdf-sidebar  { display: none !important; }
        }
        /* Scrollbar styling for main area */
        [data-fyp-scroll]::-webkit-scrollbar { width: 5px; }
        [data-fyp-scroll]::-webkit-scrollbar-track { background: transparent; }
        [data-fyp-scroll]::-webkit-scrollbar-thumb { background: rgba(26,24,21,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}
