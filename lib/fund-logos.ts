// lib/fund-logos.ts
//
// The funder logo for an opportunity, when we hold one in /public/logos.
//
// Matched on the opportunity's title, because that is where the funder's name
// lives in the catalogue ("Hubert Bals Fund — Script and Project Development").
// Order matters: the more specific names come first, so "Hubert Bals" (IFFR's
// fund) wins over anything that merely mentions Rotterdam. Patterns are kept
// narrow on purpose: a logo belongs to one organisation or programme, and a
// broad match ("Locarno", "Red Sea") would put that mark on its neighbours.
//
// null means "no logo on file". Callers show a monogram instead — never a
// guessed logo, because the wrong funder's mark on a card is a false claim.

const LOGOS: [RegExp, string][] = [
  [/hubert\s*bals/i,                                         "hubert-bals-fund"],
  [/torino\s*film\s*lab|\btfl\b/i,                           "torinofilmlab"],
  [/creative\s*europe|\bmedia\s*(programme|sub-?programme|development|slate)/i, "creative-europe-media"],
  [/eurimages/i,                                             "eurimages"],
  [/sundance/i,                                              "sundance-institute"],
  [/\bbfi\b|british\s*film\s*institute/i,                    "bfi"],
  [/doha\s*film/i,                                           "doha-film-institute"],
  [/red\s*sea\s*fund/i,                                     "red-sea-fund"],
  [/telefilm/i,                                              "telefilm-canada"],
  [/cnc\s*romania|centrul\s*na[țt]ional\s*al\s*cinematografiei/i, "cnc-romania"],
  [/aide\s*aux\s*cin[ée]mas\s*du\s*monde/i,                  "aide-aux-cinemas-du-monde"],
  [/\bcnc\b|centre\s*national\s*du\s*cin[ée]ma/i,            "cnc-france"],
  [/s[øo]r\s*fond/i,                                         "sor-fond"],
  [/\bvaf\b|flanders\s*audiovisual/i,                        "vaf"],
  [/northern\s*ireland\s*screen/i,                           "northern-ireland-screen"],
  [/creative\s*scotland/i,                                   "creative-scotland"],
  [/kofic|korean\s*film\s*council/i,                         "kofic"],
  [/\bnfvf\b|national\s*film\s*and\s*video\s*foundation/i,   "nfvf"],
  [/deutscher\s*filmf[öo]rderfonds|\bdfff\b/i,               "deutscher-filmfoerderfonds"],
  [/\bffa\b|filmf[öo]rderungsanstalt/i,                      "ffa-germany"],
  [/catapult/i,                                              "catapult-film-fund"],
  [/justfilms|ford\s*foundation/i,                           "ford-foundation-justfilms"],
  [/international\s*media\s*support|\bims\b/i,               "ims"],
  [/pulitzer/i,                                              "pulitzer-center"],
  [/national\s*film\s*cent(re|er)\s*(of\s*)?latvia/i,        "national-film-centre-latvia"],
  [/lietuvos\s*kino|lithuanian\s*film\s*cent/i,              "lietuos-kino-centras"],
  [/taicca|taiwan\s*creative\s*content/i,                    "taicca"],
  [/singapore\s*film\s*commission/i,                         "singapore-film-commission"],
  [/film\s*development\s*fund.*hong\s*kong|hong\s*kong.*film\s*development\s*fund/i, "film-development-fund-hk"],
  [/tfcia/i,                                                 "tfcia"],
  [/tribeca\s*film\s*institute/i,                           "tribeca-film-institute"],
  [/filmmakers\s*without\s*borders/i,                        "filmmakers-without-borders"],
  [/international\s*documentary\s*association|\bida\b/i,     "ida"],
  [/ace\s*producers/i,                                       "ace-producers"],
  [/open\s*doors/i,                                         "locarno-open-doors"],
  [/cin[ée]fondation/i,                                      "cinefondation"],
  [/ikusmira/i,                                              "ikusmira-berriak"],
  [/rlns/i,                                                  "rlns-institute"],
  [/africdoc/i,                                              "africdoc"],
  [/film\s*london/i,                                         "iffr-london"],
  [/film\s*independent/i,                                    "film-independent"],
  [/doc\s*society/i,                                         "doc-society"],
  [/whickers/i,                                              "the-whickers"],
  [/durban\s*filmmart/i,                                     "durban-filmmart"],
  [/asian\s*cinema\s*fund|\bacf\b/i,                         "acf-busan"],
  [/acp-?ue|acp\s*culture/i,                                 "awa-acp"],
  [/visual\s*industry\s*promotion|\bvipo\b/i,                "vpo"],
];

export function fundLogo(title: string | null | undefined): string | null {
  if (!title) return null;
  for (const [re, file] of LOGOS) if (re.test(title)) return `/logos/${file}.webp`;
  return null;
}

/** Two letters for the monogram shown when no logo is on file. */
export function fundMonogram(title: string): string {
  const words = title
    .replace(/[—–-].*$/, "")          // the funder, not the programme after the dash
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w) && !/^(the|of|and|for|de|du|la|le|des)$/i.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? title).slice(0, 2)).toUpperCase();
}
