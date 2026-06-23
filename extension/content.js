/**
 * PITCH.FYLYM Extension — Content Script
 *
 * Two jobs:
 *  1. On pitch.fylym.com/extension-connect → relay auth token to background
 *  2. On any page → fill form fields when asked by background/popup
 */

// ── 1. Auth relay (only on FYLYM domain) ─────────────────────────────────────

if (location.hostname === "pitch.fylym.com") {
  window.addEventListener("message", (e) => {
    if (e.origin !== "https://pitch.fylym.com") return;
    if (e.data?.type !== "FYLYM_EXTENSION_AUTH") return;
    chrome.runtime.sendMessage({
      type:   "STORE_AUTH",
      token:  e.data.token,
      userId: e.data.userId,
    });
  });
}

// ── 2. Form fill helpers ──────────────────────────────────────────────────────

/**
 * Fill a single DOM element. Handles React controlled inputs (native setter
 * trick), plain HTML inputs, textareas, and selects.
 */
function fillElement(el, value) {
  if (!el || value == null || value === "") return false;

  const tag = el.tagName.toLowerCase();
  const str = String(value);

  if (tag === "select") {
    // Try exact value match first, then case-insensitive text match
    const opts = Array.from(el.options);
    const hit  = opts.find((o) => o.value === str)
               ?? opts.find((o) => o.value.toLowerCase() === str.toLowerCase())
               ?? opts.find((o) => o.text.toLowerCase().includes(str.toLowerCase()));
    if (!hit) return false;
    el.value = hit.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (tag === "input" || tag === "textarea") {
    // React-aware: bypass controlled value lock via native setter
    try {
      const proto  = tag === "textarea"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(el, str);
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur",   { bubbles: true }));
        return true;
      }
    } catch {}
    // Fallback for plain HTML forms
    el.value = str;
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (el.isContentEditable) {
    el.textContent = str;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Common selector fallbacks when a fund has no form_field_map yet.
 * Tries the most common field name patterns across grant/fund websites.
 */
const SMART_PATTERNS = {
  title: [
    'input[name*="title"]', 'input[id*="title"]', 'input[name*="project_name"]',
    'input[placeholder*="project title" i]', 'input[name="name"][type="text"]:first-of-type',
  ],
  logline: [
    'textarea[name*="logline"]', 'textarea[id*="logline"]',
    'input[name*="logline"]', 'textarea[placeholder*="logline" i]',
    'textarea[name*="short_description"]',
  ],
  synopsis: [
    'textarea[name*="synopsis"]', 'textarea[id*="synopsis"]',
    'textarea[name*="description"]', 'textarea[id*="description"]',
    'textarea[placeholder*="synopsis" i]', 'textarea[name*="summary"]',
  ],
  director_name: [
    'input[name*="director"]', 'input[id*="director"]',
    'input[placeholder*="director" i]',
  ],
  genre: [
    'input[name*="genre"]', 'select[name*="genre"]',
    'input[id*="genre"]',
  ],
  language: [
    'input[name*="language"]', 'select[name*="language"]',
    'input[id*="language"]',
  ],
  country: [
    'input[name*="country"]', 'select[name*="country"]',
    'input[id*="country"]',
  ],
  budget_usd: [
    'input[name*="budget"]', 'input[id*="budget"]',
    'input[type="number"][name*="budget"]',
  ],
  stage: [
    'select[name*="stage"]', 'select[id*="stage"]',
    'select[name*="development"]',
  ],
  writer_name: [
    'input[name*="writer"]', 'input[id*="writer"]',
    'input[name*="screenwriter"]',
  ],
};

/**
 * Wait for an element to appear in DOM (handles SPA lazy renders).
 */
function waitFor(selector, timeout = 4000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
  });
}

/** Inline toast notification injected into the page */
function showToast(message, ok = true) {
  const existing = document.getElementById("fylym-toast");
  if (existing) existing.remove();

  const t = document.createElement("div");
  t.id = "fylym-toast";
  t.style.cssText = [
    "position:fixed", "bottom:24px", "right:24px", "z-index:2147483647",
    "padding:12px 18px", "border-radius:3px",
    `background:${ok ? "#1A1815" : "#7f1d1d"}`,
    "color:#F5F5F0", "font-family:-apple-system,sans-serif",
    "font-size:13px", "letter-spacing:0.04em",
    "box-shadow:0 4px 20px rgba(0,0,0,0.35)",
    "display:flex", "align-items:center", "gap:10px",
  ].join(";");

  const dot = document.createElement("span");
  dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${ok ? "#BF9953" : "#f87171"};flex-shrink:0`;
  t.appendChild(dot);
  t.appendChild(document.createTextNode(message));
  document.body.appendChild(t);

  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.4s"; }, 2800);
  setTimeout(() => t.remove(), 3200);
}

// ── Context-aware fill (SmartyGrants, Fluxx, custom form builders) ───────────
// SmartyGrants uses <p> paragraphs as visual labels — NOT <label> elements.
// Strategy: for every input/textarea on page, read surrounding text context,
// match against keyword map, fill the winner.

const LABEL_KEYWORDS = {
  title: [
    "project title", "film title", "title of the project", "title of your project",
    "name of project", "project name", "name of film", "title of film",
    "name of the project", "what is the title",
  ],
  logline: [
    "logline", "logline synopsis", "one-line synopsis", "one line synopsis",
    "elevator pitch", "one sentence", "25 words or less", "50 words or less",
  ],
  synopsis: [
    "one-paragraph synopsis", "paragraph synopsis", "synopsis of your project",
    "project description", "description of your project", "story synopsis",
    "synopsis of the project", "brief synopsis", "project synopsis",
    "about your project", "describe your project",
  ],
  director_statement: [
    "director's statement", "director statement", "creative vision",
    "artistic statement", "creative statement", "your vision",
  ],
  director_name: [
    "director", "directed by", "name of director", "director's name",
    "director full name", "key creative: director", "lead director",
    "director/filmmaker",
  ],
  writer_name: [
    "writer", "screenwriter", "written by", "script writer",
    "writer's name", "writer/creator", "name of writer", "author",
    "screenplay by", "key creative: writer",
  ],
  producer_info: [
    "producer", "production company", "producing entity",
    "key producer", "lead producer", "producer's name",
  ],
  genre: [
    "genre", "primary genre", "film genre", "project genre",
    "type of project", "what genre",
  ],
  language: [
    "primary language", "original language", "language of",
    "principal language", "main language", "dialogue language",
  ],
  country: [
    "country of origin", "country of production", "country of principal",
    "country of filming", "production country", "principal country",
  ],
  budget_usd: [
    "total budget", "project budget", "estimated budget",
    "total project budget", "production budget", "budget of the project",
    "total cost", "what is the budget", "budget amount",
  ],
  format: [
    "project format", "film format", "format of the project",
    "format of project", "what format", "type of content",
  ],
  stage: [
    "stage of development", "production stage", "development stage",
    "current stage", "what stage", "stage of production",
    "where is the project", "project stage",
  ],
};

/**
 * Get text context around an input element — checks:
 *  1. Associated <label for="id">
 *  2. Preceding sibling <p>, <div>, <span>, <strong>, <h3>, <h4>
 *  3. Parent container text (excluding the input itself)
 *  4. aria-label or placeholder attributes
 */
function getInputContext(input) {
  const parts = [];

  // Direct attributes
  if (input.getAttribute("aria-label"))  parts.push(input.getAttribute("aria-label"));
  if (input.getAttribute("placeholder")) parts.push(input.getAttribute("placeholder"));
  if (input.getAttribute("name"))        parts.push(input.getAttribute("name").replace(/[_-]/g, " "));

  // associated <label>
  if (input.id) {
    const lbl = document.querySelector(`label[for="${input.id}"]`);
    if (lbl) parts.push(lbl.textContent);
  }

  // Climb DOM tree up to 6 levels — collect text of siblings/ancestors
  // that don't contain the input itself (catches SmartyGrants <p> labels)
  let el = input.parentElement;
  let levels = 0;
  while (el && levels < 6) {
    const siblings = Array.from(el.childNodes).filter(
      (n) => n !== input && !n.contains?.(input)
    );
    const text = siblings.map((n) => n.textContent ?? "").join(" ")
      .replace(/\s+/g, " ").trim();
    if (text.length > 3 && text.length < 500) parts.push(text);
    el = el.parentElement;
    levels++;
  }

  return parts.join(" ").toLowerCase();
}

function fillByContext(project) {
  const inputs = Array.from(
    document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea")
  );

  let filled = 0;
  const filledInputs = new Set();

  // For each FYLYM field, find the best matching input on the page
  for (const [field, keywords] of Object.entries(LABEL_KEYWORDS)) {
    const value = project[field];
    if (value == null) continue;

    let bestInput = null;
    let bestScore = 0;

    for (const input of inputs) {
      if (filledInputs.has(input)) continue;
      const context = getInputContext(input);
      let score = 0;
      for (const kw of keywords) {
        if (context.includes(kw.toLowerCase())) {
          // Longer keyword = more specific = higher score
          score = Math.max(score, kw.length);
        }
      }
      if (score > bestScore) { bestScore = score; bestInput = input; }
    }

    if (bestInput && bestScore > 0 && fillElement(bestInput, value)) {
      filledInputs.add(bestInput);
      filled++;
    }
  }

  return filled;
}


// ── 3. Fill handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "FILL_FORM") return;

  (async () => {
    const { project, fieldMap, fundTitle } = msg;
    let filled = 0;
    let skipped = 0;

    if (fieldMap && Object.keys(fieldMap).length > 0) {
      // ── Strategy 1: Mapped fill — fund-specific CSS selector map ──────────
      for (const [selector, projectField] of Object.entries(fieldMap)) {
        const value = project[projectField];
        if (value == null) { skipped++; continue; }
        const el = await waitFor(selector);
        if (el && fillElement(el, value)) filled++;
        else skipped++;
      }
    } else {
      // ── Strategy 2: Smart fill — common name/id/placeholder selectors ─────
      for (const [field, selectors] of Object.entries(SMART_PATTERNS)) {
        const value = project[field];
        if (value == null) continue;
        let hit = false;
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && fillElement(el, value)) { hit = true; filled++; break; }
        }
        if (!hit) skipped++;
      }

      // ── Strategy 3: Context-aware fill — SmartyGrants, Fluxx, custom ─────
      const ctxFilled = fillByContext(project);
      filled += ctxFilled;
      skipped = Math.max(0, skipped - ctxFilled);
    }

    const msg2 = filled > 0
      ? `PITCH.FYLYM filled ${filled} field${filled > 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} skipped)` : ""}`
      : "No matching fields found — try mapping fields in admin";

    showToast(msg2, filled > 0);
    sendResponse({ ok: filled > 0, filled, skipped });
  })();

  return true; // async
});
