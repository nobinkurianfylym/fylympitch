"use client";

import { useState } from "react";
import { OpportunitiesAdminClient } from "./OpportunitiesAdminClient";
import { PendingSubmissions } from "./PendingSubmissions";
import { AdminCreateOpportunityForm } from "./AdminCreateOpportunityForm";

const TABS = [
  { id: "manage", label: "Manage Opportunities" },
  { id: "add",    label: "Add New" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  opps:        any[];
  pendingOpps: any[];
}

export function OpportunitiesAdminTabs({ opps, pendingOpps }: Props) {
  const [active, setActive] = useState<TabId>("manage");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-line mt-6 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`
              px-5 py-3 text-[11px] tracking-[0.14em] uppercase font-medium
              border-b-2 transition-colors
              ${active === tab.id
                ? "border-ink text-ink"
                : "border-transparent text-ash hover:text-ink"
              }
            `}
          >
            {tab.label}
            {tab.id === "manage" && opps.length > 0 && (
              <span className="ml-2 text-[10px] text-ash font-normal normal-case tracking-normal">
                {opps.length}
              </span>
            )}
            {tab.id === "manage" && pendingOpps.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gold text-ivory text-[9px] font-semibold">
                {pendingOpps.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Manage tab */}
      {active === "manage" && (
        <div>
          {pendingOpps.length > 0 && <PendingSubmissions items={pendingOpps} />}
          <OpportunitiesAdminClient opps={opps} />
        </div>
      )}

      {/* Add New tab */}
      {active === "add" && (
        <AdminCreateOpportunityForm />
      )}
    </div>
  );
}
