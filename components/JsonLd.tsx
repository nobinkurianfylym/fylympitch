// Renders a JSON-LD <script> block. Server-component safe. Accepts one object
// or an array; nulls are dropped so callers can pass conditional schemas freely.

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
