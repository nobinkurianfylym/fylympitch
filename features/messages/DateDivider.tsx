"use client";
// features/messages/DateDivider.tsx

import React from "react";
import { getDateLabel } from "./message.utils";

interface Props {
  isoDate: string;
}

export const DateDivider = React.memo(function DateDivider({ isoDate }: Props) {
  return (
    <div
      role="separator"
      aria-label={getDateLabel(isoDate)}
      className="flex items-center gap-4 my-6"
    >
      <div className="flex-1 border-t border-line" />
      <span className="text-[10px] tracking-[0.18em] text-ash font-medium uppercase select-none">
        {getDateLabel(isoDate)}
      </span>
      <div className="flex-1 border-t border-line" />
    </div>
  );
});
