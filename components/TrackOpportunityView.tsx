"use client";

import { useEffect, useRef } from "react";
import { logOpportunityView } from "@/lib/activity-actions";

/**
 * Records one activity_logs row per page view of an opportunity.
 * Ref-guarded so React StrictMode's double-invoke in development
 * does not double-count.
 */
export default function TrackOpportunityView({ opportunityId }: { opportunityId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void logOpportunityView(opportunityId);
  }, [opportunityId]);

  return null;
}
