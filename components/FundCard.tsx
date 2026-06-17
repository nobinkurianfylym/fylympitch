"use client";

interface FundCardProps {
  link: string | null;
  children: React.ReactNode;
  className?: string;
}

export default function FundCard({ link, children, className = "" }: FundCardProps) {
  return (
    <div
      onClick={() => link && window.open(link, "_blank", "noopener,noreferrer")}
      className={`${className} ${link ? "cursor-pointer" : ""}`}
    >
      {children}
    </div>
  );
}
