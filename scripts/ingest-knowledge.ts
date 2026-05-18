/**
 * ingest-knowledge.ts
 *
 * Reads .txt and .md files from the knowledge/ directory, chunks them by
 * paragraph (~500 words, 50-word overlap), embeds each chunk via OpenAI
 * text-embedding-3-small (768-dim), and upserts rows into knowledge_chunks
 * in Supabase.
 *
 * Resumable: skips files that already have rows in knowledge_chunks, so
 * re-running after a crash picks up where it left off. To force re-ingest
 * a file, delete its rows first or pass it explicitly as an argument.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
 *     npx tsx scripts/ingest-knowledge.ts
 *
 * Optional: pass filenames as arguments to ingest only specific files:
 *   npx tsx scripts/ingest-knowledge.ts exercises_phase1.txt
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY           = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const KNOWLEDGE_DIR   = path.join(process.cwd(), 'knowledge');
const WORDS_PER_CHUNK = 500;
const OVERLAP_WORDS   = 50;
// OpenAI free tier: 3000 RPM. 50ms between chunks keeps us ~1200 req/min.
const EMBED_DELAY_MS  = 50;
const MAX_EMBED_RETRIES = 3;

// ─── Category inference from filename ─────────────────────────────────────────

function inferCategory(filename: string): string | null {
  const base = path.basename(filename).toLowerCase();
  if (base.startsWith('exercises_'))   return 'exercises';
  if (base.startsWith('principles_'))  return 'clinical_principles';
  if (base.startsWith('progressions_')) return 'progressions';
  return null;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Splits text into overlapping chunks by paragraph, targeting ~500 words each.
 * Paragraphs are split on double newlines. Single paragraphs longer than the
 * target are split at word boundaries.
 */
function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let currentWords: string[] = [];

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/);

    // If a single paragraph exceeds the chunk size, split it directly
    if (paraWords.length > WORDS_PER_CHUNK) {
      if (currentWords.length > 0) {
        chunks.push(currentWords.join(' '));
        currentWords = currentWords.slice(-OVERLAP_WORDS);
      }
      for (let i = 0; i < paraWords.length; i += WORDS_PER_CHUNK - OVERLAP_WORDS) {
        const slice = paraWords.slice(i, i + WORDS_PER_CHUNK);
        chunks.push(slice.join(' '));
      }
      currentWords = paraWords.slice(-OVERLAP_WORDS);
      continue;
    }

    if (currentWords.length + paraWords.length > WORDS_PER_CHUNK && currentWords.length > 0) {
      chunks.push(currentWords.join(' '));
      // Keep overlap from end of previous chunk
      currentWords = currentWords.slice(-OVERLAP_WORDS);
    }

    currentWords = currentWords.concat(paraWords);
  }

  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' '));
  }

  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  for (let attempt = 0; attempt <= MAX_EMBED_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small',
          dimensions: 768,
        }),
      });
    } catch (networkErr) {
      // Transient network error (ECONNRESET, ETIMEDOUT, etc.) — retry with backoff
      if (attempt === MAX_EMBED_RETRIES) {
        throw new Error(`Network error after ${MAX_EMBED_RETRIES} retries: ${(networkErr as Error).message}`);
      }
      const backoffMs = Math.min(5_000 * Math.pow(2, attempt), 30_000); // 5s, 10s, 20s, 30s cap
      console.warn(`\n  [network] ${(networkErr as Error).message}. Retrying in ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${MAX_EMBED_RETRIES})...`);
      await sleep(backoffMs);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === MAX_EMBED_RETRIES) {
        const body = await response.text();
        throw new Error(`OpenAI Embedding API error ${response.status} after ${MAX_EMBED_RETRIES} retries: ${body}`);
      }
      const backoffMs = response.status === 429
        ? Math.min(10_000 * Math.pow(2, attempt), 60_000)
        : Math.min(5_000 * Math.pow(2, attempt), 30_000);
      console.warn(`\n  [${response.status}] Retrying in ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${MAX_EMBED_RETRIES})...`);
      await sleep(backoffMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI Embedding API error ${response.status}: ${body}`);
    }

    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    const values = data.data?.[0]?.embedding;

    if (!Array.isArray(values) || values.length !== 768) {
      throw new Error(`Unexpected embedding dimensions: got ${values?.length ?? 0}, expected 768`);
    }

    return values;
  }

  throw new Error('embedText: exhausted retries');
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Ingest a single file ─────────────────────────────────────────────────────

async function ingestFile(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const chunks = chunkText(content);
  const category = inferCategory(filename);

  console.log(`\nIngesting ${filename} (${chunks.length} chunks, category: ${category ?? 'none'})`);

  // Idempotent: delete existing rows for this source
  const { error: deleteError } = await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('source', filename);

  if (deleteError) {
    throw new Error(`Failed to delete existing chunks for ${filename}: ${deleteError.message}`);
  }

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  chunk ${i + 1}/${chunks.length}...`);

    const embedding = await embedText(chunks[i]);

    // Retry insert on transient network errors
    let insertError = null;
    for (let attempt = 0; attempt <= MAX_EMBED_RETRIES; attempt++) {
      try {
        const result = await supabase.from('knowledge_chunks').insert({
          content: chunks[i],
          source: filename,
          category,
          embedding,
        });
        insertError = result.error;
        break;
      } catch (networkErr) {
        if (attempt === MAX_EMBED_RETRIES) throw networkErr;
        const backoffMs = Math.min(5_000 * Math.pow(2, attempt), 30_000);
        console.warn(`\n  [network/insert] ${(networkErr as Error).message}. Retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
      }
    }

    if (insertError) {
      throw new Error(`Failed to insert chunk ${i + 1} of ${filename}: ${insertError.message}`);
    }

    console.log(' done');

    if (i < chunks.length - 1) {
      await sleep(EMBED_DELAY_MS);
    }
  }

  console.log(`  ✓ ${filename} complete`);
}

// ─── File discovery ───────────────────────────────────────────────────────────

/**
 * Recursively collects all .txt and .md files under a directory.
 * README.md files are excluded.
 */
function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (
      (entry.name.endsWith('.txt') || entry.name.endsWith('.md')) &&
      entry.name !== 'README.md'
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let files: string[];

  if (args.length > 0) {
    // Each arg can be a directory or a specific file
    files = [];
    for (const arg of args) {
      const resolved = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        files.push(...collectFiles(resolved));
      } else {
        files.push(resolved);
      }
    }
  } else {
    // Default: all .txt and .md files under knowledge/ (recursive)
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      console.error(`knowledge/ directory not found at ${KNOWLEDGE_DIR}`);
      process.exit(1);
    }
    files = collectFiles(KNOWLEDGE_DIR);
  }

  if (files.length === 0) {
    console.log('No files to ingest. Add .txt or .md files to knowledge/ and re-run.');
    return;
  }

  // Resume support: skip files already present in knowledge_chunks
  const { data: existingRows } = await supabase
    .from('knowledge_chunks')
    .select('source');
  const alreadyIngested = new Set((existingRows ?? []).map((r: { source: string }) => r.source));

  const pending = files.filter((f) => !alreadyIngested.has(path.basename(f)));
  const skipped = files.length - pending.length;

  console.log(`Found ${files.length} file(s). Skipping ${skipped} already ingested. Processing ${pending.length} remaining.`);

  if (pending.length === 0) {
    console.log('All files already ingested.');
    return;
  }

  for (const file of pending) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    await ingestFile(file);
  }

  console.log('\nIngestion complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
