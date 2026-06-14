"use client";

import { useState, useEffect, useRef } from "react";

const ENGINE_STEPS = [
  { label: "Saving your project",                            dur: 380  },
  { label: "Loading active opportunities",                   dur: 620  },
  { label: "Scoring matches across funds, grants and labs",  dur: 1100 },
  { label: "Calculating your funding readiness score",       dur: 860  },
  { label: "Mapping funding sources for your budget",        dur: 820  },
  { label: "Identifying financing obstacles",                dur: 760  },
  { label: "Building your roadmap to production",            dur: 720  },
  { label: "Matching producers and investors",               dur: 680  },
  { label: "Generating your Executive Producer brief",       dur: 2600 },
  { label: "Finalising your intelligence report",            dur: 700  },
];

const RESULTS = [
  { title: "NFDC Film Equity Funding",          type: "Film Fund",              score: 93 },
  { title: "WAVES Film Bazaar Screenwriters' Lab", type: "Lab",                score: 91 },
  { title: "Asian Cinema Fund (ACF)",            type: "Film Fund · up to $30K", score: 88 },
  { title: "Hubert Bals Fund",                   type: "Film Fund · up to €10K", score: 84 },
];

export default function EngineDemo() {
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState(false);
  const [dots, setDots] = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Start on scroll into view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setTimeout(run, 400);
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Blinking dots on active step
  useEffect(() => {
    if (step < 0 || done) return;
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => clearInterval(id);
  }, [step, done]);

  function clearAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function run() {
    clearAll();
    setStep(0);
    setDone(false);
    let elapsed = 0;
    ENGINE_STEPS.forEach((s, i) => {
      const t = setTimeout(() => setStep(i), elapsed);
      timers.current.push(t);
      elapsed += s.dur;
    });
    const fin = setTimeout(() => { setStep(ENGINE_STEPS.length); setDone(true); }, elapsed + 400);
    timers.current.push(fin);
  }

  function replay() {
    setStep(-1);
    setDone(false);
    setTimeout(run, 200);
  }

  const progress = done
    ? 100
    : step < 0
    ? 0
    : Math.min(96, Math.round((step / (ENGINE_STEPS.length - 1)) * 100));

  return (
    <div ref={sectionRef} className="mt-20 rounded-[16px] bg-deep overflow-hidden">
      <div className="px-8 md:px-12 py-10 md:py-14">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <p className="eyebrow text-gold mb-3">Live demo</p>
            <h3 className="font-display text-ivory text-[24px] md:text-[30px] leading-tight">
              Watch the engine match a project.
            </h3>
          </div>
          {done && (
            <button
              onClick={replay}
              className="shrink-0 mt-1 text-[11px] tracking-[0.18em] uppercase text-ivory/40 border border-ivory/10 px-4 py-2.5 rounded-md hover:text-gold hover:border-gold/40 transition-colors"
            >
              Replay
            </button>
          )}
        </div>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">

          {/* Left — project card + results */}
          <div>
            {/* Project being analysed */}
            <div className="border border-ivory/10 rounded-xl px-6 py-5 mb-6 bg-ivory/[0.03]">
              <p className="text-[11px] tracking-[0.2em] uppercase text-gold mb-4">Project submitted</p>
              <p className="font-display text-ivory text-[22px] mb-2">The Last Monsoon</p>
              <p className="text-[11px] tracking-[0.14em] uppercase text-ivory/35">
                Drama · Feature · Development · Kerala, India
              </p>
              <p className="text-[11px] tracking-[0.14em] uppercase text-gold/80 mt-1.5">
                Seeking ₹25,00,000
              </p>
            </div>

            {/* Results — fade in when done */}
            <div
              className="transition-opacity duration-700"
              style={{ opacity: done ? 1 : 0 }}
            >
              <p className="text-[11px] tracking-[0.2em] uppercase text-ivory/35 mb-4">
                47 opportunities found
              </p>
              {RESULTS.map((r, i) => (
                <div
                  key={r.title}
                  className="border-t border-ivory/10 py-4 flex items-center justify-between gap-4"
                  style={{
                    transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
                    opacity: done ? 1 : 0,
                    transform: done ? "translateY(0)" : "translateY(10px)",
                  }}
                >
                  <div>
                    <p className="text-ivory text-[13px] mb-1">{r.title}</p>
                    <p className="text-[11px] tracking-[0.12em] uppercase text-ivory/30">{r.type}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] text-gold"
                      style={{ border: "1px solid rgba(191,153,83,0.4)" }}
                    >
                      {r.score}
                    </span>
                    <span className="text-[10px] tracking-[0.18em] uppercase text-gold/80 hidden sm:block">
                      {r.score >= 90 ? "Excellent" : "Strong"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — engine steps */}
          <div>
            {/* Progress bar */}
            <div className="h-[2px] bg-ivory/10 rounded-full mb-8 overflow-hidden">
              <div
                className="h-full bg-gold rounded-full"
                style={{
                  width: `${progress}%`,
                  transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-[17px]">
              {ENGINE_STEPS.map(({ label }, i) => {
                const isDone    = done || i < step;
                const isActive  = !done && i === step;
                const isPending = !done && i > step;
                return (
                  <div
                    key={label}
                    className="flex items-center gap-3.5"
                    style={{
                      opacity: isPending ? 0.2 : 1,
                      transition: "opacity 0.4s ease",
                    }}
                  >
                    <span
                      className="w-3.5 text-center text-[12px] shrink-0"
                      style={{ color: isDone ? "rgba(247,244,238,0.35)" : "#BF9953" }}
                    >
                      {isDone ? "✓" : isActive ? "›" : ""}
                    </span>
                    <span
                      className="text-[13px]"
                      style={{
                        color: isDone
                          ? "rgba(247,244,238,0.35)"
                          : isActive
                          ? "#F7F4EE"
                          : "rgba(247,244,238,0.35)",
                        fontWeight: isActive ? 500 : 300,
                      }}
                    >
                      {label}
                      {isActive && (
                        <span style={{ color: "rgba(247,244,238,0.3)", fontWeight: 300 }}>
                          {"." .repeat(dots)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Done message */}
            {done && (
              <div
                className="mt-8 pt-6 border-t border-ivory/10"
                style={{ opacity: done ? 1 : 0, transition: "opacity 0.6s ease" }}
              >
                <p className="font-display text-ivory italic text-[18px]">
                  Your results are ready.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
