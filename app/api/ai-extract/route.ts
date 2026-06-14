import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFParse } from "pdf-parse";

const GENRES = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "AI extraction not configured" }, { status: 503 });

  const body = await req.json();
  const { pdf } = body as { pdf?: string };
  if (!pdf) return NextResponse.json({ error: "No PDF data" }, { status: 400 });

  try {
    const buffer = Buffer.from(pdf, "base64");
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText({ first: 10 });
    const text = textResult.pages.map(p => p.text).join("\n\n").slice(0, 12000);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text — try a text-based PDF rather than a scanned image." },
        { status: 422 }
      );
    }

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
  "budget_usd": number or null,
  "funding_needed_usd": number or null,
  "stage": "exactly one of: development, pre_production, production, post_production, completed",
  "logline": "one sentence logline, max 480 characters",
  "synopsis": "2–4 paragraph story synopsis",
  "director_statement": "director vision statement if present, else empty string",
  "producer_info": "producer and production company info if present, else empty string"
}

Every key must be present. Use null for missing numbers, "" for missing strings. logline must be under 480 characters.

PITCH DECK TEXT:
${text}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[ai-extract] OpenAI error:", await res.text());
      return NextResponse.json({ error: "AI extraction failed" }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    return NextResponse.json(JSON.parse(raw));
  } catch (err: unknown) {
    console.error("[ai-extract]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
