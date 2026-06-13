"""
FYLYMPITCH — MASTER_DATA import ETL
Reads master_data.json (dumped from MASTER_DATA.xlsx "MASTER DATABASE" sheet)
and writes supabase/migrations/005_master_data_seed.sql.

Run: python3 scripts/import_master_data.py
"""
import json
import re

SRC = "/home/claude/master_data.json"
OUT = "/home/claude/fylympitch/supabase/migrations/005_master_data_seed.sql"

SKIP_TYPES = {"Production House", "Directory / Network", "European Producer Network", "Government Body"}

STAGE_MAP = {
    "Development/Script": "development",
    "Production": "production",
    "Distribution/Sales": "completed",
    "Post-Production/WIP": "post_production",
}


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    if s in ("", "—", "-", "None"):
        return None
    return s


def parse_money(v):
    s = clean(v)
    if s is None:
        return None
    s = s.replace("$", "").replace(",", "").strip()
    try:
        n = float(s)
    except ValueError:
        return None
    return int(n) if n > 0 else None


def normalize_country(raw):
    c = clean(raw)
    if c is None:
        return None
    if "India" in c:
        return "India"
    low = c.lower()
    if any(t in low for t in ["pan-european", "eu /", "europe", "global"]):
        return None
    if c == "USA":
        return "United States"
    if c == "UK":
        return "United Kingdom"
    return c


def normalize_region(raw):
    return clean(raw)


def map_opp_type(raw):
    t = raw.lower()
    if "lab" in t:
        return "lab"
    if "market" in t:
        return "market"
    if "broadcaster" in t:
        return "broadcaster"
    if "ott" in t or "platform" in t:
        return "streamer"
    if "grant" in t or "subsidy" in t or "government" in t or "incentive" in t:
        return "grant"
    if "equity" in t:
        return "investor"
    return "fund"


def parse_genres(raw):
    s = clean(raw)
    if s is None:
        return []
    if "all genres" in s.lower():
        return []
    return [t.strip() for t in s.split(",") if t.strip()]


def parse_formats(raw):
    s = clean(raw)
    if s is None:
        return []
    low = s.lower()
    out = []
    if "feature" in low:
        out.append("feature")
    if "short" in low:
        out.append("short")
    if "doc" in low:
        out.append("documentary")
    if any(t in low for t in ["series", "tv", "web", "reality"]):
        out.append("series")
    if "anim" in low:
        out.append("animation")
    return out


def parse_career_stages(raw):
    s = clean(raw)
    if s is None or s == "All Career Stages":
        return []
    return [t.strip() for t in s.split(";") if t.strip()]


def parse_project_stages(raw):
    s = clean(raw)
    if s is None:
        return []
    out = []
    for tok in s.split(";"):
        mapped = STAGE_MAP.get(tok.strip())
        if mapped and mapped not in out:
            out.append(mapped)
    return out


def parse_match_weight(raw):
    s = clean(raw)
    if s is None:
        return None
    s = s.lower()
    return s if s in ("high", "medium", "low") else None


def parse_yesno(raw):
    s = clean(raw)
    return bool(s and s.lower() == "yes")


def build_description(org_body, notes):
    org_body = clean(org_body)
    notes = clean(notes)
    if org_body and notes:
        return f"{org_body} — {notes}"
    return notes or org_body


def ensure_scheme(url):
    s = clean(url)
    if s is None:
        return None
    if re.match(r"^https?://", s, re.I):
        return s
    return f"https://{s}"


def is_active(status):
    s = clean(status)
    return s != "CLOSED/TBA"


# ---------- SQL literal helpers ----------

def sql_str(v):
    if v is None:
        return "null"
    escaped = v.replace("'", "''")
    return f"'{escaped}'"


def sql_num(v):
    return "null" if v is None else str(v)


def sql_bool(v):
    return "true" if v else "false"


def sql_arr(values):
    if not values:
        return "'{}'"
    parts = []
    for v in values:
        esc = str(v).replace("\\", "\\\\").replace('"', '\\"')
        parts.append(f'"{esc}"')
    body = ",".join(parts)
    return f"'{{{body}}}'"


# ---------- load + dedupe ----------

rows = json.load(open(SRC))
rows = [r for r in rows if r["TYPE"] not in SKIP_TYPES]

# Dedupe by NAME, preferring the richer "🗄 FP" source row when both exist.
by_name = {}
for r in rows:
    name = r["NAME"]
    existing = by_name.get(name)
    if existing is None or (r["SOURCE"] == "🗄 FP" and existing["SOURCE"] != "🗄 FP"):
        by_name[name] = r
rows = list(by_name.values())

print(f"Importing {len(rows)} opportunities")

COLUMNS = [
    "title", "opp_type", "description", "country", "region",
    "genres", "formats", "stages", "languages",
    "min_budget_usd", "max_budget_usd", "max_award_usd", "deadline", "url", "is_active",
    "career_stages", "match_weight", "gender_focus", "copro_required",
    "festival_affiliated", "ott_affiliated",
    "contact_email", "contact_phone", "key_person", "app_link", "deadline_note",
]

value_rows = []
for r in rows:
    title = r["NAME"]
    opp_type = map_opp_type(r["TYPE"])
    description = build_description(r.get("ORG / BODY"), r.get("NOTES"))
    country = normalize_country(r.get("COUNTRY"))
    region = normalize_region(r.get("REGION"))
    genres = parse_genres(r.get("GENRES"))
    formats = parse_formats(r.get("FORMAT"))
    stages = parse_project_stages(r.get("PROJECT STAGE"))
    languages = []
    # Budget figures in MASTER_DATA represent award/grant amounts, not eligible
    # project-budget ranges — map to max_award_usd only; leave the
    # eligible-budget-range columns null (== "no budget restrictions").
    min_budget_usd = None
    max_budget_usd = None
    max_award_usd = parse_money(r.get("BUDGET MAX USD"))
    deadline = None  # NEXT DEADLINE / PERIOD is free text, see deadline_note
    url = ensure_scheme(r.get("WEBSITE"))
    active = is_active(r.get("STATUS"))
    career_stages = parse_career_stages(r.get("CAREER STAGE"))
    match_weight = parse_match_weight(r.get("MATCH WEIGHT"))
    gender_focus = clean(r.get("GENDER FOCUS"))
    copro_required = parse_yesno(r.get("COPRO REQUIRED"))
    festival_affiliated = parse_yesno(r.get("FESTIVAL"))
    ott_affiliated = parse_yesno(r.get("OTT"))
    contact_email = clean(r.get("EMAIL / CONTACT"))
    contact_phone = clean(r.get("PHONE"))
    key_person = clean(r.get("KEY PERSON"))
    app_link = ensure_scheme(r.get("APP LINK"))
    deadline_note = clean(r.get("NEXT DEADLINE / PERIOD"))

    values = [
        sql_str(title), sql_str(opp_type), sql_str(description), sql_str(country), sql_str(region),
        sql_arr(genres), sql_arr(formats), sql_arr(stages), sql_arr(languages),
        sql_num(min_budget_usd), sql_num(max_budget_usd), sql_num(max_award_usd), "null", sql_str(url), sql_bool(active),
        sql_arr(career_stages), sql_str(match_weight), sql_str(gender_focus), sql_bool(copro_required),
        sql_bool(festival_affiliated), sql_bool(ott_affiliated),
        sql_str(contact_email), sql_str(contact_phone), sql_str(key_person), sql_str(app_link), sql_str(deadline_note),
    ]
    value_rows.append("(" + ", ".join(values) + ")")

sql = f"""-- ============================================================
-- FYLYMPITCH — Migration 005: MASTER_DATA seed import
-- Run once in Supabase SQL Editor (after 004_opportunity_metadata.sql).
--
-- Imports {len(rows)} opportunities from MASTER_DATA.xlsx (funds, labs,
-- co-production markets, broadcasters, OTT platforms, government
-- subsidies/grants). Production houses, directories/networks, and
-- producer-network listings are intentionally excluded — those belong
-- in producer-matching profiles, not the opportunities table.
--
-- Idempotent: requires the unique constraint on opportunities.title
-- added in 004, and uses ON CONFLICT (title) DO NOTHING, so re-running
-- this file is a no-op after the first successful run. Two titles
-- ("Visions Sud Est", "Doha Film Institute Grants") already exist in
-- the schema.sql seed and are skipped here for that reason.
--
-- Generated by scripts/import_master_data.py — do not hand-edit.
-- ============================================================

insert into public.opportunities ({", ".join(COLUMNS)}) values
{",\n".join(value_rows)}
on conflict (title) do nothing;
"""

with open(OUT, "w") as f:
    f.write(sql)

print(f"Wrote {OUT} ({len(sql)} bytes)")
