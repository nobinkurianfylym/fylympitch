// Broadcast bodies carry their attachments as a trailer appended by
// lib/admin-messaging.ts:
//
//     <message text>
//
//     Attachments:
//     poster.png — https://…/poster.png
//     brief.pdf — https://…/brief.pdf
//
// That keeps the fan-out schema-free, but it means every surface that shows a
// broadcast has to split the text back out from the files. This does it once.

export type BroadcastFile = { name: string; url: string; isImage: boolean };

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i;

/** A line of the trailer: "name — url". Em dash is what the composer writes. */
const FILE_LINE = /^(.+?)\s+[—–-]\s+(https?:\/\/\S+)$/;

export function parseBroadcastBody(body: string): {
  text: string;
  files: BroadcastFile[];
} {
  const lines = (body ?? "").split("\n");
  const files: BroadcastFile[] = [];

  // Walk backwards: the trailer is always last, so anything before the
  // "Attachments:" header is the author's own text and is left untouched.
  let cut = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(FILE_LINE);
    if (m) {
      files.unshift({ name: m[1].trim(), url: m[2], isImage: IMAGE_EXT.test(m[2]) });
      cut = i;
      continue;
    }
    if (/^attachments?:$/i.test(line) && files.length) {
      cut = i;
    }
    break;
  }

  return { text: lines.slice(0, cut).join("\n").trimEnd(), files };
}

/** One-line summary for list views, where the raw URLs are just noise. */
export function attachmentSummary(files: BroadcastFile[]): string {
  if (!files.length) return "";
  return files.length === 1 ? "1 attachment" : `${files.length} attachments`;
}
