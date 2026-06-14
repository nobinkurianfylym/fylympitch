"use client";

import { useState, useTransition } from "react";
import { makeOffer } from "@/lib/actions";

export default function OfferForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p className="text-[14px] text-gold font-normal tracking-wide">
        Offer sent. The filmmaker has been notified.
      </p>
    );
  }

  if (!open) {
    return (
      <button className="btn-gold" onClick={() => setOpen(true)}>
        Make an offer
      </button>
    );
  }

  return (
    <form
      className="space-y-4 border border-line rounded-[14px] p-5 bg-white/40"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("project_id", projectId);
        setError(null);
        start(async () => {
          const res = await makeOffer(fd);
          if (res?.error) setError(res.error);
          else setDone(true);
        });
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="eyebrow">Offer type</span>
          <select name="offer_type" className="field mt-1.5" defaultValue="investment">
            <option value="investment">Investment</option>
            <option value="co_production">Co-production</option>
            <option value="distribution">Distribution</option>
            <option value="acquisition">Acquisition</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Amount (USD, optional)</span>
          <input
            name="amount_usd"
            type="number"
            min={0}
            step={1000}
            placeholder="e.g. 50000"
            className="field mt-1.5"
          />
        </label>
      </div>
      <label className="block">
        <span className="eyebrow">Message to the filmmaker</span>
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Introduce yourself, what interests you in this project, and the terms you have in mind."
          className="field mt-1.5"
        />
      </label>
      {error && <p className="text-[14px] text-red-700 font-normal">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-gold disabled:opacity-50">
          {pending ? "Sending…" : "Send offer"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
