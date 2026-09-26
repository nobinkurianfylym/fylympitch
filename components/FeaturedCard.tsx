// components/FeaturedCard.tsx
//
// The narrow column beside the hero. Server component: one query,
// and the whole card is still a link. The share control is the only
// client JavaScript on it, and only when there is something on this
// site to share.
//
// Light rather than dark on purpose. A dark plate here competes
// with the headline, and the headline has to win.

import Link from "next/link";
import { getFeaturedToday } from "@/lib/featured";
import ShareLinkButton from "@/components/ShareLinkButton";

export default async function FeaturedCard() {
  const card = await getFeaturedToday();
  if (!card) return null;

  // Opens in a new tab so the hero stays put. Someone reading the homepage
  // has not decided to leave it yet, and sending them away to look at one
  // fund loses the page they were actually on.
  //
  // A custom card can point anywhere, so an off-site link gets a plain
  // anchor: next/link would try to prefetch a domain it does not own, and
  // rel="noreferrer" keeps the new tab from reaching back through
  // window.opener.
  const external = /^https?:\/\//i.test(card.href);

  // A share button cannot live inside the card's <a>: a button nested in an
  // anchor is invalid, and a click on it would follow the link. So the anchor
  // stops wrapping the content and becomes an overlay stretched across the
  // card instead — the whole card stays clickable, and the share button sits
  // one layer above it and keeps its own clicks. The anchor carries an
  // aria-label because it no longer contains any text of its own.
  const shell =
    "group relative rounded-card border border-line bg-white p-[18px] pb-4 transition-colors hover:border-gold";
  const shadow = { boxShadow: "0 14px 34px -26px rgba(26,24,21,0.55)" };

  // ShareLinkButton builds `${siteUrl}${path}`, so an off-site custom card has
  // nothing shareable: passing an absolute URL would produce
  // pitch.fylym.com/https://… There is no page of ours to send anyone to, so
  // the control is simply absent rather than broken.
  const shareText = [card.title, card.subtitle]
    .filter(Boolean)
    .concat("featured today on PITCH.FYLYM")
    .join(" · ");
  const linkLabel = `${card.title} — ${card.ctaLabel}`;

  const body = (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[8.5px] tracking-[0.22em] uppercase text-gold">
          {card.kindLabel}
        </span>
        <span className="text-[8.5px] tracking-[0.14em] uppercase text-ash/60">
          Today
        </span>
      </div>

      {/* A poster is the reason someone looks at this card, so when there is
          one it gets the top of the card at full width rather than sitting
          beside the title as a thumbnail. Capped in height so the card still
          fits inside a 100svh hero on a laptop. */}
      {card.imageUrl && (
        <div className="-mx-[18px] -mt-1 mb-3.5 overflow-hidden border-y border-line bg-parchment">
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full object-cover"
            style={{ aspectRatio: "4 / 5", maxHeight: 300 }}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {!card.imageUrl && (
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] text-gold"
            style={{ border: "1px solid rgba(191,153,83,0.4)", background: "rgba(191,153,83,0.08)" }}
          >
            {card.kind === "producer" ? "◆" : card.kind === "project" ? "▶" : "◈"}
          </span>
        )}

        <div className="min-w-0">
          <p className="font-display text-[19px] font-normal leading-[1.2] group-hover:text-gold transition-colors">
            {card.title}
          </p>
          {card.subtitle && (
            <p className="mt-0.5 text-[10.5px] capitalize text-ash">{card.subtitle}</p>
          )}
        </div>
      </div>

      {card.rows.length > 0 && (
        <dl className="mt-3.5 border-t border-line pt-2.5">
          {card.rows.map((r, i) => (
            <div key={i} className="flex justify-between gap-2.5 py-[3.5px]">
              <dt className="whitespace-nowrap text-[9px] tracking-[0.14em] uppercase text-ash">
                {r.label}
              </dt>
              <dd className={`text-right text-[11.5px] ${r.gold ? "text-gold" : "text-ink"}`}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {card.hook && (
        <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-[1.55] text-ash">
          {card.hook}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {/* No z-index, so the overlay link covers it: clicking the call to
            action follows the card, exactly as it did before. */}
        <span className="border-b border-gold pb-[3px] text-[9.5px] tracking-[0.16em] uppercase text-ink">
          {card.ctaLabel} ↗
        </span>

        {!external && (
          <div className="relative z-[2] shrink-0">
            <ShareLinkButton
              path={card.href}
              title={card.title}
              text={shareText}
              label={`Share this ${card.kind === "custom" ? "feature" : card.kind}`}
              compact
            />
          </div>
        )}
      </div>
    </>
  );

  const overlay = "absolute inset-0 z-[1] rounded-card";

  return (
    <div className={shell} style={shadow}>
      {body}

      {external ? (
        <a
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={linkLabel}
          className={overlay}
        />
      ) : (
        <Link
          href={card.href}
          target="_blank"
          rel="noopener"
          aria-label={linkLabel}
          className={overlay}
        />
      )}
    </div>
  );
}
