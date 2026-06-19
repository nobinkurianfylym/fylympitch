"use client";

import { useState } from "react";
import { saveFilmmakerCredit } from "@/lib/actions";

const FESTIVALS = [
  "Cannes","Berlin","Venice","Sundance","TIFF","Rotterdam","Tribeca",
  "IFFR","Hot Docs","Locarno","San Sebastián","Busan","IDFA",
  "BFI London","Palm Springs","Frameline","AFI Fest",
];
const FORMATS = ["Feature","Series","Documentary","Animation"];

export default function AddCreditForm() {
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    await saveFilmmakerCredit(formData);
    setOpen(false);
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="btn-ghost !py-2.5 !px-5 text-[11px]"
        >
          + Add a credit
        </button>
      ) : (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-[0.22em] uppercase text-ash">New credit</p>
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-ash hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>

          <form action={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="field-label mb-1 block">Film / Project title *</label>
                <input name="title" required placeholder="The Goat Road" className="field w-full" />
              </div>
              <div>
                <label className="field-label mb-1 block">Year</label>
                <input name="year" type="number" min="1900" max="2030" placeholder="2024" className="field w-full" />
              </div>
            </div>

            <div>
              <label className="field-label mb-2 block">Format</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <label key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-ash cursor-pointer hover:border-ink/30">
                    <input type="radio" name="format" value={f} className="w-3 h-3 accent-[#BF9953]" />
                    {f}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label mb-2 block">Festival selections</label>
              <div className="flex flex-wrap gap-2">
                {FESTIVALS.map((f) => (
                  <label key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-ash cursor-pointer hover:border-ink/30 hover:text-ink">
                    <input type="checkbox" name="festivals" value={f} className="w-3 h-3 accent-[#BF9953]" />
                    {f}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label mb-1 block">
                Awards <span className="font-normal text-ash">(one per line)</span>
              </label>
              <textarea name="awards_text" rows={2} placeholder="Best Director — Kerala Film Academy 2024" className="field w-full" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-ash cursor-pointer">
                <input type="checkbox" name="is_featured" value="true" className="w-4 h-4 accent-[#BF9953]" />
                Feature this credit prominently
              </label>
            </div>

            <button type="submit" className="btn-gold">Add credit</button>
          </form>
        </div>
      )}
    </div>
  );
}
