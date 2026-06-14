import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// @ts-ignore — pdf-parse has no bundled types
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const GENRES = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "AI extraction not configured" }, { status: 503 });

  const body = await req.json();
  const { pdf } = body as { pdf?: string };
  if (!pdf) return NextResponse.json({ error: "No PDF data" }, { status: 400 });

  try {
    // Decode base64 → Buffer → extract text with pdf-parse
    const buffer = Buffer.from(pdf, "base64");
    const parsed = await pdfParse(buffer, { max: 10 }); // first 10 pages is plenty
    const text = parsed.text?.slice(0, 12000) ?? ""; // cap at ~3k tokens

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF — try a text-based PDF rather than a scanned image." }, { status: 422 });
    }

    // Send extracted text to OpenAI
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a film project data extractor. Extract structured information from pitch deck text and return ONLY a JSON object — no markdown, no explanation.",
          },
          {
            role: "user",
            content: `Extract film project information from this pitch deck text and return a JSON object with exactly these fields:

{
  "title": "film title",
  "genre": "exactly one of: ${GENRES.join(", ")}",
  "format": "exactly one of: feature, short, documentary, series, animation",
  "language": "primary language of the film",
  "country": "primary country of production",
  "budget_usd": number or null (total budget in USD),
  "funding_needed_usd": number or null (funding gap in USD),
  "stage": "exactly one of: development, pre_production, production, post_production, completed",
  "logline": "one sentence logline, max 480 characters",
  "synopsis": "2–4 paragraph story synopsis",
  "director_statement": "director vision statement if present, else empty string",
  "producer_info": "producer and production company info if present, else empty string"
}

Rules:
- Every key must be present. Use null for missing numbers, "" for missing strings.
- logline must be under 480 characters.
- genre, format, stage must be exactly one of the listed values.
- For budget, convert to USD if in another currency (approximate).

PITCH DECK TEXT:
${text}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ai-extract] OpenAI error:", err);
      return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";

    try {
      const extracted = JSON.parse(raw);
      return NextResponse.json(extracted);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error("[ai-extract]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
