import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GENRES = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];

const EXTRACTION_PROMPT = `Extract film project information and return a JSON object with exactly these fields:

{
  "title": "film title",
  "genre": "exactly one of: ${GENRES.join(", ")}",
  "format": "exactly one of: feature, documentary, series, animation",
  "language": "primary language of the film",
  "country": "primary country of production",
  "budget_usd": number or null,
  "funding_needed_usd": number or null,
  "stage": "exactly one of: development, pre_production, production, post_production, completed",
  "logline": "one sentence logline, max 480 characters",
  "synopsis": "2-4 paragraph story synopsis",
  "director_name": "full name of the director if explicitly stated in the deck, else empty string",
  "writer_name": "full name of the writer or screenwriter if explicitly stated in the deck, else empty string",
  "director_statement": "director vision statement if present, else empty string",
  "producer_info": "producer and production company info if present, else empty string"
}

Every key must be present. Use null for missing numbers, empty string for missing text.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "AI extraction not configured" }, { status: 503 });

  const body = await req.json();
  const { text, images } = body as { text?: string; images?: string[] };

  if (!text?.trim() && (!images || images.length === 0)) {
    return NextResponse.json({ error: "No PDF content provided" }, { status: 400 });
  }

  try {
    let messages: object[];

    if (text?.trim()) {
      // ── Text-based PDF: fast, cheap ───────────────────────────────────────
      messages = [
        {
          role: "system",
          content: "You are a film project data extractor. Extract structured information from pitch deck text and return ONLY a JSON object.",
        },
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\nPITCH DECK TEXT:\n${text.slice(0, 12000)}`,
        },
      ];
    } else {
      // ── Scanned / image-based PDF: vision fallback ────────────────────────
      // gpt-4o-mini reads text from rendered page images (OCR via vision).
      const imageContent = (images as string[]).map((b64) => ({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" },
      }));

      messages = [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `These are pages from a film pitch deck (scanned or image-based PDF). ${EXTRACTION_PROMPT}`,
            },
          ],
        },
      ];
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ai-extract] OpenAI error:", res.status, errText);
      return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const extracted = JSON.parse(raw);
    return NextResponse.json(extracted);

  } catch (err: unknown) {
    console.error("[ai-extract]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
