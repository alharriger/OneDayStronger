# Knowledge Base

This directory holds the clinical reference content that powers the RAG layer in the app. Files here are indexed into Supabase via the ingestion script and retrieved at query time to ground LLM responses in textbook material.

---

## Adding Content

1. Place `.txt` or `.md` files in this directory.
2. Follow the naming convention below — the filename determines the RAG category used during retrieval.
3. Run the ingestion script (see below).

## Naming Convention

| Prefix | Category assigned | Example |
|---|---|---|
| `exercises_*` | `exercises` | `exercises_phase1.txt` |
| `progressions_*` | `progressions` | `progressions_eccentric.txt` |
| `principles_*` | `clinical_principles` | `principles_load_management.txt` |
| (anything else) | `null` (uncategorised) | `general_pht_overview.txt` |

Files named `README.md` are excluded from ingestion automatically.

## File Format

Plain text or markdown. Structure content in clear paragraphs separated by blank lines — the chunker splits on double newlines, targeting ~500 words per chunk with 50-word overlap.

**Tips for better retrieval:**
- Start each paragraph with a clear topic sentence.
- Avoid tables or heavily formatted content — plain prose embeds and retrieves better.
- Keep related concepts in the same paragraph; the chunker won't split mid-paragraph if it fits the target size.

## Running the Ingestion Script

```bash
# Set required env vars (or use a .env file with dotenv-cli)
export SUPABASE_URL="https://rzczrwisocqlzuvouzem.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key from Supabase dashboard>"
export GEMINI_API_KEY="<your Gemini API key>"

# Ingest all files in this directory
npx tsx scripts/ingest-knowledge.ts

# Ingest specific files only
npx tsx scripts/ingest-knowledge.ts exercises_phase1.txt principles_load_management.txt
```

The script is **idempotent** — re-running after editing a file deletes the old chunks for that source and re-ingests fresh ones. Running it repeatedly is safe.

## Rate Limits

The script adds a 100ms delay between Gemini embedding calls. Gemini's free tier allows 1500 requests per day, which supports ingesting ~1500 chunks (~750,000 words) per day without hitting rate limits.
