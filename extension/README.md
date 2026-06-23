# PITCH.FYLYM — One Click Apply Extension

Chrome Extension (Manifest V3) that auto-fills film fund application forms
using project data from PITCH.FYLYM.

## How It Works

```
Filmmaker clicks "One Click Apply" on PITCH.FYLYM
      ↓
New tab opens → fund's application form
      ↓
Extension detects the URL matches a known fund form
      ↓
Popup shows gold badge + "Fill This Form" button
      ↓
Extension fills every field using project data
      ↓
Filmmaker reviews and submits
```

## Install (Development)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `/extension` folder from this repo

## Connect to PITCH.FYLYM

1. Click the extension icon in Chrome toolbar
2. Click **Connect to PITCH.FYLYM**
3. A tab opens at `pitch.fylym.com/extension-connect`
4. If you're logged in, it connects automatically
5. Close the tab — extension is ready

## How Fields Are Filled

**Mapped funds** (`form_field_map` set in DB):
Exact CSS selector → project field mapping. Reliable.

**Unmapped funds** (`form_field_map` is null):
Smart fill mode — tries ~30 common selector patterns per field.
Works on most plain HTML and React forms.

## Mapping a New Fund

In Supabase SQL Editor:

```sql
UPDATE opportunities
SET
  apply_method   = 'one_click',
  form_url       = 'https://fund-website.com/apply',
  form_field_map = '{
    "input[name=''projectTitle'']": "title",
    "textarea[name=''synopsis'']":  "synopsis",
    "input[name=''director'']":     "director_name",
    "input[name=''genre'']":        "genre",
    "input[name=''budget'']":       "budget_usd",
    "select[name=''stage'']":       "stage",
    "input[name=''language'']":     "language",
    "input[name=''country'']":      "country",
    "textarea[name=''logline'']":   "logline"
  }'::jsonb
WHERE title = 'Fund Name Here';
```

### Available project fields

| Field | Value |
|---|---|
| `title` | Project title |
| `logline` | One-line description |
| `synopsis` | Full synopsis |
| `director_statement` | Director's statement |
| `director_name` | Director full name |
| `writer_name` | Writer full name |
| `genre` | Genre string |
| `stage` | development / pre_production / production / post_production |
| `format` | feature / short / documentary / series / animation |
| `language` | Primary language |
| `country` | Country of origin |
| `budget_usd` | Total budget in USD |

## File Structure

```
extension/
  manifest.json   — MV3 manifest
  background.js   — Service worker: auth, cache, badge, routing
  content.js      — Form filler + auth relay
  popup.html      — Extension popup UI
  popup.js        — Popup logic
  popup.css       — FYLYM design tokens
  icons/          — 16, 48, 128px icons (add before publishing)
  README.md
```

## Publish to Chrome Web Store

1. Add proper icons to `icons/` (PNG, square)
2. Zip the `extension/` folder
3. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Review takes 3–7 business days

## API Endpoint

`GET https://pitch.fylym.com/api/autofill/context`
`Authorization: Bearer <supabase_access_token>`

Returns:
```json
{
  "projects": [...],
  "opportunities": [{ "id", "title", "form_url", "form_field_map" }]
}
```
