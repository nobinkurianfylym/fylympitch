'use client';

import { useEffect, useState } from 'react';
import type { JourneyOpp } from '@/components/FundingJourney';

// Mirrors 9 master categories from FundingJourney
const CATEGORY_DEFS = [
  { id: 'development',        label: 'Development',          order: 0 },
  { id: 'packaging_markets',  label: 'Packaging & Markets',  order: 1 },
  { id: 'early_financing',    label: 'Early Financing',      order: 2 },
  { id: 'tax_incentives',     label: 'Tax Incentives',       order: 3 },
  { id: 'private_financing',  label: 'Private Financing',    order: 4 },
  { id: 'production',         label: 'Production',           order: 5 },
  { id: 'post_production',    label: 'Post Production',      order: 6 },
  { id: 'buyers_sales',       label: 'Buyers & Sales',       order: 7 },
  { id: 'release_distribution', label: 'Release & Distribution', order: 8 },
];
const TOTAL = CATEGORY_DEFS.length;

const ROADMAP_TO_ORDER: Record<string, number> = {
  script: 0, labs: 0, grants: 0,
  co_production: 1,
  investors: 4,
  production: 5,
};

interface Props {
  roadmap:  any;
  readiness: { score: number } | null;
}

export default function FundingJourneyMini({ roadmap, readiness }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 150); }, []);

  const currentOrder = roadmap?.current != null
    ? (ROADMAP_TO_ORDER[roadmap.current] ?? -1)
    : -1;

  const pct = readiness?.score ?? (currentOrder >= 0 ? Math.round((currentOrder / TOTAL) * 100) : 0);

  const currentCat = currentOrder >= 0 ? CATEGORY_DEFS[currentOrder] : null;
  const nextCat    = currentOrder >= 0 && currentOrder + 1 < TOTAL ? CATEGORY_DEFS[currentOrder + 1] : null;

  const DIV = '1px solid rgba(255,255,255,0.08)';

  return (
    <div style={{ background: '#1A1815', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '16px 18px 18px' }}>
        <p style={{ fontSize: 8.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.72)', fontWeight: 600, marginBottom: 14 }}>
          Funding Journey
        </p>

        {/* Progress percentage + bar */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#BF9953', lineHeight: 1 }}>
            {pct}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(245,245,240,0.5)' }}>%</span>
        </div>

        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{
            height: '100%', background: '#BF9953', borderRadius: 2,
            width: mounted ? `${pct}%` : '0%',
            transition: 'width 1.1s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>

        {/* Current Category */}
        <div style={{ borderTop: DIV, paddingTop: 12, marginBottom: 10 }}>
          <p style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.45)', marginBottom: 4 }}>
            Current Category
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F0', letterSpacing: '0.02em' }}>
            {currentCat?.label ?? 'Not yet determined'}
          </p>
        </div>

        {/* Next Recommended */}
        {nextCat && (
          <div style={{ borderTop: DIV, paddingTop: 12 }}>
            <p style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.45)', marginBottom: 4 }}>
              Next Recommended
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(191,153,83,0.6)', flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: 'rgba(245,245,240,0.75)', letterSpacing: '0.02em' }}>
                {nextCat.label}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
