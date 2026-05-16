/**
 * ingest-knowledge.ts
 *
 * Reads .txt and .md files from the knowledge/ directory, chunks them by
 * paragraph (~500 words, 50-word overlap), embeds each chunk via Gemini
 * text-embedding-004, and upserts rows into knowledge_chunks in Supabase.
 *
 * Idempotent: deletes existing rows for each source file before inserting,
 * so re-running after editing a file produces clean results.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
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
const GEMINI_API_KEY           = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const KNOWLEDGE_DIR   = path.join(process.cwd(), 'knowledge');
const WORDS_PER_CHUNK = 500;
const OVERLAP_WORDS   = 50;
const EMBED_DELAY_MS  = 100; // Gemini free tier: 1500 RPD

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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini Embedding API error ${response.status}: ${body}`);
  }

  const data = await response.json() as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;

  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error(`Unexpected embedding dimensions: got ${values?.length ?? 0}, expected 768`);
  }

  return values;
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

    const { error: insertError } = await supabase.from('knowledge_chunks').insert({
      content: chunks[i],
      source: filename,
      category,
      embedding,
    });

    if (insertError) {
      throw new Error(`Failed to insert chunk ${i + 1} of ${filename}: ${insertError.message}`);
    }

    console.log(' done');

    // Rate limit: Gemini free tier 1500 RPD ≈ ~1 req/58s sustained, but
    // burst is allowed. 100ms delay keeps us well within limits.
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

  console.log(`Found ${files.length} file(s) to ingest.`);

  for (const file of files) {
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
