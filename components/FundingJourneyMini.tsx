'use client';

import { useEffect, useState } from 'react';
import type { JourneyOpp } from '@/components/FundingJourney';

// Mirrors STAGE_DEFS order from FundingJourney
const STAGE_DEFS = [
  { id: 'script',             label: 'Script',                order: 0  },
  { id: 'script_labs',        label: 'Script Labs',           order: 1  },
  { id: 'development_labs',   label: 'Development Labs',      order: 2  },
  { id: 'development_grants', label: 'Development Grants',    order: 3  },
  { id: 'project_packaging',  label: 'Project Packaging',     order: 4  },
  { id: 'coproduction',       label: 'Co-Production Markets', order: 5  },
  { id: 'film_markets',       label: 'Film Markets',          order: 6  },
  { id: 'production_funds',   label: 'Production Funds',      order: 7  },
  { id: 'equity',             label: 'Equity Investors',      order: 8  },
  { id: 'tax_incentives',     label: 'Tax Incentives',        order: 9  },
  { id: 'gap_financing',      label: 'Gap Financing',         order: 10 },
  { id: 'production',         label: 'Production',            order: 11 },
  { id: 'festival',           label: 'Festival Premiere',     order: 12 },
  { id: 'sales_agent',        label: 'Sales Agent',           order: 13 },
  { id: 'distribution',       label: 'Distribution',          order: 14 },
];
const TOTAL = STAGE_DEFS.length;

const ROADMAP_TO_ORDER: Record<string, number> = {
  script: 0, labs: 2, grants: 3, co_production: 5,
  investors: 7, production: 11,
};

interface Props {
  roadmap:  any;
  readiness: { score: number } | null;
}

export default function FundingJourneyMini({ roadmap, readiness }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 150); }, []);

  // Derive current stage order from roadmap
  const currentOrder = roadmap?.current != null
    ? (ROADMAP_TO_ORDER[roadmap.current] ?? -1)
    : -1;

  // Progress: use readiness score as the percentage (most accurate single number)
  const pct = readiness?.score ?? (currentOrder >= 0 ? Math.round((currentOrder / TOTAL) * 100) : 0);

  const currentStage  = currentOrder >= 0 ? STAGE_DEFS[currentOrder] : null;
  const nextStage     = currentOrder >= 0 && currentOrder + 1 < TOTAL ? STAGE_DEFS[currentOrder + 1] : null;

  const DIV = '1px solid rgba(255,255,255,0.08)';

  return (
    <div style={{
      background: '#1A1815', borderRadius: 10, overflow: 'hidden', marginBottom: 10,
    }}>
      <div style={{ padding: '16px 18px 18px' }}>
        <p style={{
          fontSize: 8.5, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: 'rgba(245,245,240,0.72)', fontWeight: 600, marginBottom: 14,
        }}>
          Funding Journey
        </p>

        {/* Progress percentage + bar */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32, fontWeight: 700, color: '#BF9953', lineHeight: 1,
          }}>
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

        {/* Current Stage */}
        <div style={{ borderTop: DIV, paddingTop: 12, marginBottom: 10 }}>
          <p style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.45)', marginBottom: 4 }}>
            Current Stage
          </p>
          <p style={{
            fontSize: 13, fontWeight: 600, color: '#F5F5F0',
            letterSpacing: '0.02em',
          }}>
            {currentStage?.label ?? 'Not yet determined'}
          </p>
        </div>

        {/* Next Recommended */}
        {nextStage && (
          <div style={{ borderTop: DIV, paddingTop: 12 }}>
            <p style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.45)', marginBottom: 4 }}>
              Next Recommended
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(191,153,83,0.6)', flexShrink: 0,
              }} />
              <p style={{ fontSize: 13, color: 'rgba(245,245,240,0.75)', letterSpacing: '0.02em' }}>
                {nextStage.label}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
