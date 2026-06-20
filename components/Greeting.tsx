"use client";

export default function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();

  const salutation =
    hour < 5  ? "Good night"    :
    hour < 12 ? "Good morning"  :
    hour < 17 ? "Good afternoon":
    hour < 21 ? "Good evening"  :
                "Good night";

  return (
    <h1 className="font-display text-[34px] leading-tight">
      {salutation}, {name}.
    </h1>
  );
}
