'use client';

import { useRef, useState, useTransition } from 'react';
import { upsertProducerProject } from '@/lib/actions';

const PIPELINE_STAGES = [
  { key: 'saved',       label: 'Saved' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'in_review',   label: 'In Review' },
  { key: 'meeting_set', label: 'Meeting Set' },
  { key: 'deal_active', label: 'Deal Active' },
];

interface Props {
  projectId:   string;
  currentStatus?: string | null;
  rating?:     number | null;
  notes?:      string | null;
}

export default function PipelineStageForm({ projectId, currentStatus, rating, notes }: Props) {
  const [selected,  setSelected]  = useState(currentStatus ?? 'saved');
  const [confirmed, setConfirmed] = useState(false);
  const [pending,   startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const S = {
    ink:  '#1A1815',
    ash:  '#8A857C',
    gold: '#BF9953',
    line: 'rgba(26,24,21,0.07)',
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await upsertProducerProject(fd);
      setConfirmed(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setConfirmed(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="rating"     value={rating ?? ''} />
      <input type="hidden" name="notes"      value={notes  ?? ''} />

      {PIPELINE_STAGES.map((s) => {
        const isActive = selected === s.key;
        return (
          <label key={s.key} style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '9px 12px',
            borderRadius: 6,
            border:       `1px solid ${isActive ? 'rgba(191,153,83,0.40)' : S.line}`,
            background:   isActive ? 'rgba(191,153,83,0.07)' : 'transparent',
            cursor:       'pointer',
            transition:   'background 0.15s, border-color 0.15s',
          }}>
            <input
              type="radio"
              name="status"
              value={s.key}
              checked={selected === s.key}
              onChange={() => { setSelected(s.key); setConfirmed(false); }}
              style={{ accentColor: S.gold, width: 14, height: 14, flexShrink: 0 }}
            />
            <span style={{
              fontSize:      12,
              color:         isActive ? S.ink : S.ash,
              fontWeight:    isActive ? 600 : 400,
              letterSpacing: '0.04em',
              fontFamily:    'Montserrat, sans-serif',
            }}>
              {s.label}
            </span>
          </label>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop:     10,
          padding:       '10px 0',
          background:    confirmed ? 'rgba(46,107,78,0.1)' : S.ink,
          color:         confirmed ? '#2E6B4E' : '#FAFAF8',
          border:        confirmed ? '1px solid rgba(46,107,78,0.3)' : 'none',
          borderRadius:  6,
          fontSize:      11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight:    700,
          cursor:        pending ? 'default' : 'pointer',
          fontFamily:    'Montserrat, sans-serif',
          transition:    'background 0.25s, color 0.25s, border 0.25s',
          opacity:       pending ? 0.6 : 1,
        }}
      >
        {confirmed ? '✓ Updated in Pipeline' : pending ? 'Saving…' : 'Update Stage'}
      </button>
    </form>
  );
}
