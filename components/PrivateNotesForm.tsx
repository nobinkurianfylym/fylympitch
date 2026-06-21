'use client';

import { useRef, useState, useTransition } from 'react';
import { saveProducerNotes } from '@/lib/actions';

interface Props {
  projectId:    string;
  initialNotes?: string | null;
}

export default function PrivateNotesForm({ projectId, initialNotes }: Props) {
  const [notes,     setNotes]     = useState(initialNotes ?? '');
  const [status,    setStatus]    = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pending,   startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const S = {
    ash:    '#8A857C',
    ink:    '#1A1815',
    line:   'rgba(26,24,21,0.07)',
    surface:'#FFFFFF',
  };

  function handleSave() {
    if (pending) return;
    startTransition(async () => {
      setStatus('saving');
      const result = await saveProducerNotes(projectId, notes);
      if (result.error) {
        setStatus('error');
      } else {
        setStatus('saved');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setStatus('idle'), 3000);
      }
    });
  }

  const btnLabel =
    status === 'saving' ? 'Saving…'
    : status === 'saved'  ? '✓ Notes saved'
    : status === 'error'  ? 'Error — retry'
    : 'Save notes';

  const btnColor =
    status === 'saved'  ? '#2E6B4E'
    : status === 'error' ? '#dc2626'
    : S.ash;

  const btnBg =
    status === 'saved'  ? 'rgba(46,107,78,0.08)'
    : status === 'error' ? 'rgba(220,38,38,0.06)'
    : 'transparent';

  const btnBorder =
    status === 'saved'  ? '1px solid rgba(46,107,78,0.25)'
    : status === 'error' ? '1px solid rgba(220,38,38,0.25)'
    : `1px solid ${S.line}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); if (status !== 'idle') setStatus('idle'); }}
        rows={5}
        placeholder="Only you can see these notes…"
        style={{
          width:        '100%',
          padding:      '10px 12px',
          borderRadius: 6,
          border:       `1px solid ${S.line}`,
          background:   S.surface,
          fontSize:     13,
          lineHeight:   1.65,
          color:        S.ink,
          resize:       'vertical',
          fontFamily:   'Montserrat, sans-serif',
          outline:      'none',
          boxSizing:    'border-box',
          transition:   'border-color 0.15s',
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(191,153,83,0.5)')}
        onBlur={e  => (e.target.style.borderColor = S.line)}
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        style={{
          padding:       '8px 0',
          background:    btnBg,
          border:        btnBorder,
          borderRadius:  6,
          fontSize:      11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:         btnColor,
          cursor:        pending ? 'default' : 'pointer',
          fontFamily:    'Montserrat, sans-serif',
          fontWeight:    status === 'saved' ? 600 : 400,
          transition:    'color 0.2s, background 0.2s, border 0.2s',
          opacity:       pending ? 0.6 : 1,
        }}
      >
        {btnLabel}
      </button>
    </div>
  );
}
