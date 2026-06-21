'use client';

import { useState, useTransition } from 'react';
import { upsertProducerProject } from '@/lib/actions';

interface Props {
  projectId:     string;
  currentStatus?: string | null;
  currentRating?: number | null;
  notes?:        string | null;
}

export default function StarRatingForm({ projectId, currentStatus, currentRating, notes }: Props) {
  const [hover,     setHover]     = useState(0);
  const [rating,    setRating]    = useState(currentRating ?? 0);
  const [saved,     setSaved]     = useState(false);
  const [pending,   startTransition] = useTransition();

  const S = {
    gold: '#BF9953',
    ash:  '#8A857C',
    ink:  '#1A1815',
    line: 'rgba(26,24,21,0.07)',
  };

  function handleStar(n: number) {
    // Toggle off if clicking the same rating
    const next = rating === n ? 0 : n;
    setRating(next);
    setSaved(false);

    const fd = new FormData();
    fd.set('project_id', projectId);
    fd.set('status',     currentStatus ?? 'saved');
    fd.set('notes',      notes         ?? '');
    if (next > 0) fd.set('rating', String(next));

    startTransition(async () => {
      await upsertProducerProject(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const display = hover || rating;

  return (
    <div>
      {/* Stars */}
      <div
        style={{ display: 'flex', gap: 6, marginBottom: 10 }}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= display;
          return (
            <button
              key={n}
              type="button"
              onClick={() => handleStar(n)}
              onMouseEnter={() => setHover(n)}
              disabled={pending}
              aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
              style={{
                background:  'none',
                border:      'none',
                padding:     2,
                cursor:      'pointer',
                lineHeight:  1,
                transition:  'transform 0.1s',
                transform:   hover === n ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill={filled ? S.gold : 'none'}
                stroke={filled ? S.gold : 'rgba(26,24,21,0.18)'}
                strokeWidth="1.5"
              >
                <path d="M14 2l3.09 6.26L24 9.27l-5 4.87 1.18 6.88L14 17.77l-6.18 3.25L9 14.14 4 9.27l6.91-1.01L14 2z" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Label */}
      <p style={{
        fontSize:      10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily:    'Montserrat, sans-serif',
        color:         saved ? '#2E6B4E' : pending ? S.ash : rating > 0 ? S.gold : 'rgba(138,133,124,0.5)',
        transition:    'color 0.2s',
        minHeight:     16,
      }}>
        {saved    ? '✓ Rating saved'
         : pending ? 'Saving…'
         : rating  > 0
           ? ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]
           : 'Tap a star to rate'}
      </p>
    </div>
  );
}
