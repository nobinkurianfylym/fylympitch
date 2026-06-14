import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const GENRES = ["Drama","Comedy","Thriller","Horror","Romance","Action","Documentary","Family","Crime","Sci-Fi","Fantasy","Musical"];

export async function POST(req: NextRequest) {
  // Auth check — only signed-in users
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI extraction not configured" }, { status: 503 });

  const body = await req.json();
  const { pdf } = body as { pdf?: string };
  if (!pdf) return NextResponse.json({ error: "No PDF data" }, { status: 400 });

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf,
              },
            },
            {
              type: "text",
              text: `You are extracting structured data from a film pitch deck. Return ONLY a valid JSON object — no markdown, no explanation, no preamble.

Extract and return:
{
  "title": "film title (string)",
  "genre": "exactly one of: ${GENRES.join(", ")}",
  "format": "exactly one of: feature, short, documentary, series, animation",
  "language": "primary language of the film",
  "country": "primary country of production",
  "budget_usd": number or null (total budget converted to USD — approximate if needed),
  "funding_needed_usd": number or null (funding gap / amount still needed, in USD),
  "stage": "exactly one of: development, pre_production, production, post_production, completed",
  "logline": "one sentence that captures the story — max 480 characters",
  "synopsis": "2–4 paragraph story synopsis",
  "director_statement": "director's artistic vision statement if present, else empty string",
  "producer_info": "producer names, production company, prior credits if present, else empty string"
}

Rules:
- Every key must be present. Use null for missing numbers, "" for missing strings.
- logline must be under 480 characters.
- genre and format and stage must be exactly one of the listed values.
- Return ONLY the JSON object.`,
            },
          ],
        },
      ],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    const clean = raw.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[ai-extract]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
