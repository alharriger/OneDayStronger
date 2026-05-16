/**
 * fetch-papers.ts
 *
 * Fetches open-access physical therapy and rehabilitation papers from:
 *   • OpenAlex  (no API key required)
 *   • PubMed Central Open Access subset  (no API key required)
 *
 * Coverage: all major injuries, conditions, and rehab principles — not
 * limited to PHT. The knowledge base is designed to support any
 * musculoskeletal rehab condition the app may expand to cover.
 *
 * Full-text strategy (in priority order):
 *   1. PMC XML — for any paper with a PMC ID (OpenAlex + PMC-primary)
 *   2. PDF download — only from known preprint/repo hosts (bioRxiv, etc.)
 *   3. Abstract fallback — rich abstracts are still valuable for RAG
 *
 * After this completes, run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
 *     npx tsx scripts/ingest-knowledge.ts knowledge/papers
 *
 * Usage:
 *   npx tsx scripts/fetch-papers.ts
 *
 * Optional env vars:
 *   CORE_API_KEY   — enables CORE.ac.uk as an additional source
 *   MAX_PAPERS     — cap total papers (default: 5000)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const OUTPUT_DIR     = path.join(process.cwd(), 'knowledge', 'papers');
const OPENALEX_EMAIL = 'dev@onedaystronger.app'; // polite pool — higher rate limit
const API_DELAY_MS   = 340;  // ~3 req/s — stays within PMC unauthenticated limit
const PDF_DELAY_MS   = 500;  // between PDF downloads
const MIN_WORDS      = 80;   // discard files with negligible content
const MAX_PAPERS     = parseInt(process.env.MAX_PAPERS ?? '5000', 10);
const CORE_API_KEY   = process.env.CORE_API_KEY ?? null;

/**
 * Search queries spanning all major MSK rehab conditions and principles.
 * Ordered roughly from most specific (PHT) to broadest (general rehab).
 * Deduplication by DOI ensures overlap between queries is handled cleanly.
 */
const SEARCH_QUERIES = [
  // ── PHT / proximal hamstring ──────────────────────────────────────────────
  'proximal hamstring tendinopathy rehabilitation',
  'high hamstring tendinopathy exercise',
  'ischial tuberosity tendinopathy treatment',
  'proximal hamstring injury physiotherapy return to sport',

  // ── Hamstring injury (broader) ───────────────────────────────────────────
  'hamstring strain rehabilitation exercise',
  'hamstring muscle injury return to sport',
  'Nordic hamstring curl injury prevention',
  'eccentric hamstring exercise rehabilitation',

  // ── Tendinopathy — general principles ────────────────────────────────────
  'tendinopathy load management progressive exercise',
  'isometric exercise tendon pain rehabilitation',
  'heavy slow resistance tendinopathy',
  'eccentric exercise tendinopathy treatment outcomes',
  'tendon compression load management',
  'tendinopathy pain continuum model',
  'reactive tendinopathy management exercise',

  // ── Achilles tendinopathy ─────────────────────────────────────────────────
  'Achilles tendinopathy rehabilitation eccentric',
  'Achilles tendon loading exercise physical therapy',
  'insertional Achilles tendinopathy treatment',

  // ── Patellar tendinopathy (jumper's knee) ─────────────────────────────────
  'patellar tendinopathy exercise therapy',
  'patellar tendon rehabilitation progressive loading',
  'jumper knee rehabilitation physical therapy',

  // ── Gluteal tendinopathy ──────────────────────────────────────────────────
  'gluteal tendinopathy rehabilitation exercise',
  'greater trochanteric pain syndrome treatment',
  'hip abductor tendinopathy physical therapy',

  // ── Rotator cuff ─────────────────────────────────────────────────────────
  'rotator cuff tendinopathy rehabilitation exercise',
  'shoulder impingement physiotherapy exercise',
  'rotator cuff tear conservative rehabilitation',
  'supraspinatus tendinopathy exercise therapy',

  // ── Lateral elbow / golfer's elbow ───────────────────────────────────────
  'lateral epicondylalgia rehabilitation exercise',
  'tennis elbow physical therapy progressive loading',
  'medial epicondylalgia treatment exercise',

  // ── Knee rehabilitation ───────────────────────────────────────────────────
  'knee osteoarthritis exercise rehabilitation',
  'ACL rehabilitation exercise return to sport',
  'anterior cruciate ligament reconstruction physiotherapy',
  'patellofemoral pain syndrome exercise therapy',
  'meniscus rehabilitation physical therapy exercise',
  'total knee replacement rehabilitation exercise',

  // ── Hip rehabilitation ────────────────────────────────────────────────────
  'hip osteoarthritis exercise rehabilitation',
  'femoroacetabular impingement physiotherapy',
  'total hip replacement rehabilitation exercise',
  'hip labral tear conservative rehabilitation',
  'hip flexor strain rehabilitation physical therapy',

  // ── Shoulder rehabilitation ───────────────────────────────────────────────
  'frozen shoulder physiotherapy exercise',
  'adhesive capsulitis rehabilitation stretching',
  'SLAP lesion conservative rehabilitation',
  'shoulder instability rehabilitation exercise',
  'acromioclavicular joint rehabilitation',

  // ── Lumbar spine ─────────────────────────────────────────────────────────
  'low back pain exercise rehabilitation',
  'lumbar disc herniation physiotherapy exercise',
  'lumbar stenosis rehabilitation exercise therapy',
  'chronic low back pain exercise program',
  'core stability exercise low back pain',

  // ── Cervical spine ───────────────────────────────────────────────────────
  'neck pain exercise rehabilitation physical therapy',
  'cervical radiculopathy physiotherapy exercise',
  'whiplash rehabilitation exercise program',

  // ── Ankle and foot ───────────────────────────────────────────────────────
  'ankle sprain rehabilitation exercise',
  'chronic ankle instability physical therapy',
  'plantar fasciitis rehabilitation exercise',
  'plantar fasciopathy load management',
  'ankle fracture rehabilitation physiotherapy',

  // ── Foot tendinopathy ────────────────────────────────────────────────────
  'peroneal tendinopathy rehabilitation exercise',
  'tibialis posterior tendinopathy treatment',
  'flexor hallucis longus tendinopathy',

  // ── Wrist and hand ───────────────────────────────────────────────────────
  'De Quervain tenosynovitis rehabilitation',
  'wrist tendinopathy physical therapy exercise',
  'carpal tunnel syndrome conservative rehabilitation',

  // ── Muscle strains (general) ─────────────────────────────────────────────
  'muscle strain rehabilitation progressive loading',
  'quadriceps strain rehabilitation exercise',
  'calf strain rehabilitation physical therapy',
  'groin strain rehabilitation return to sport',
  'adductor strain rehabilitation exercise',

  // ── Stress fractures / bone stress ───────────────────────────────────────
  'stress fracture rehabilitation return to sport',
  'bone stress injury rehabilitation exercise',
  'tibial stress fracture physical therapy',

  // ── Post-surgical rehabilitation ─────────────────────────────────────────
  'post-surgical rehabilitation exercise outcomes',
  'orthopaedic surgery rehabilitation physical therapy',
  'return to sport after surgery rehabilitation',

  // ── Pain science ─────────────────────────────────────────────────────────
  'pain neuroscience education rehabilitation',
  'central sensitization chronic pain physical therapy',
  'pain catastrophizing rehabilitation outcomes',
  'graded activity exposure chronic musculoskeletal pain',

  // ── Load management / training principles ────────────────────────────────
  'progressive overload rehabilitation strength training',
  'exercise prescription musculoskeletal rehabilitation',
  'load management injury prevention sports',
  'training load monitoring injury risk',
  'periodization rehabilitation program design',

  // ── Strength training rehab ───────────────────────────────────────────────
  'resistance training rehabilitation musculoskeletal',
  'strength training older adults musculoskeletal pain',
  'blood flow restriction training rehabilitation',

  // ── Running injuries ──────────────────────────────────────────────────────
  'running related injury rehabilitation exercise',
  'iliotibial band syndrome rehabilitation',
  'shin splints rehabilitation physical therapy',
  'runners knee rehabilitation exercise',

  // ── Sports-specific rehab ────────────────────────────────────────────────
  'return to play rehabilitation protocol sports',
  'athletic injury rehabilitation evidence-based',
  'sports physical therapy outcomes exercise',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaperRecord {
  doi?:      string;
  pmid?:     string; // PubMed ID — used to look up PMC full text via eLink
  pmcId?:    string;
  title:     string;
  year?:     number;
  authors:   string[];
  journal?:  string;
  abstract?: string;
  fullText?: string;
  pdfUrl?:   string;
  source:    string;
}

// ─── Dedup store ──────────────────────────────────────────────────────────────

const seenDois   = new Set<string>();
const seenPmcIds = new Set<string>(); // numeric IDs only (no PMC prefix)
let savedCount   = 0;

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sanitizeFilename(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  const safeId = id.replace(/[^a-z0-9]/gi, '').slice(-8);
  return `${base}_${safeId || 'xx'}.txt`;
}

function formatPaperText(p: PaperRecord): string {
  const lines: string[] = [
    `TITLE: ${p.title}`,
    `AUTHORS: ${p.authors.slice(0, 5).join('; ')}${p.authors.length > 5 ? ' et al.' : ''}`,
    p.journal ? `JOURNAL: ${p.journal}` : '',
    p.year    ? `YEAR: ${p.year}` : '',
    p.doi     ? `DOI: ${p.doi}` : '',
    p.pmcId   ? `PMC_ID: PMC${p.pmcId}` : '',
    `SOURCE: ${p.source}`,
    '',
  ].filter((l) => l !== null && l !== undefined);

  if (p.abstract) {
    lines.push('ABSTRACT');
    lines.push(p.abstract.trim());
    lines.push('');
  }

  if (p.fullText && p.fullText !== p.abstract) {
    lines.push('FULL TEXT');
    lines.push(p.fullText.trim());
  }

  return lines.join('\n');
}

function savePaper(paper: PaperRecord): void {
  const id = paper.doi ?? paper.pmcId ?? paper.title;
  const filename = sanitizeFilename(paper.title, id);
  const content = formatPaperText(paper);
  if (wordCount(content) < MIN_WORDS) return;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), content, 'utf-8');
  savedCount++;
}

// ─── OpenAlex ─────────────────────────────────────────────────────────────────

function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return '';
  const entries: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) entries.push([pos, word]);
  }
  entries.sort((a, b) => a[0] - b[0]);
  return entries.map((e) => e[1]).join(' ');
}

// Only attempt PDF download from hosts known to serve real binary PDFs.
// Publisher-hosted "pdf" URLs almost always redirect to HTML paywalls.
const REAL_PDF_HOSTS = ['biorxiv.org', 'medrxiv.org', 'arxiv.org/pdf', 'europepmc.org', 'zenodo.org'];

function isPreprintPdfUrl(url: string): boolean {
  return REAL_PDF_HOSTS.some((h) => url.includes(h));
}

async function fetchOpenAlexPage(
  query: string,
  cursor: string,
): Promise<{ results: unknown[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    search:     query,
    filter:     'is_oa:true',
    'per-page': '200',
    cursor,
    mailto:     OPENALEX_EMAIL,
    select: [
      'id', 'doi', 'title', 'publication_year',
      'authorships', 'primary_location',
      'best_oa_location', 'abstract_inverted_index', 'ids',
    ].join(','),
  });

  const res = await fetch(`https://api.openalex.org/works?${params}`, {
    headers: { 'User-Agent': `OneDayStronger/1.0 (${OPENALEX_EMAIL})` },
  });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);

  const data = await res.json() as {
    results: unknown[];
    meta: { next_cursor?: string | null };
  };
  return { results: data.results ?? [], nextCursor: data.meta?.next_cursor ?? null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOpenAlexWork(work: any): PaperRecord | null {
  if (!work?.title) return null;

  const doi = work.doi
    ? (work.doi as string).replace('https://doi.org/', '')
    : undefined;
  if (doi && seenDois.has(doi)) return null;

  // Extract PMID — used later to look up PMC full text via eLink
  const pmidRaw: string | undefined = work.ids?.pmid;
  const pmid = pmidRaw
    ? pmidRaw.replace('https://pubmed.ncbi.nlm.nih.gov/', '').replace(/\/$/, '')
    : undefined;

  // Extract numeric PMC ID if OpenAlex has it (rare but possible)
  const pmcIdRaw: string | undefined = work.ids?.pmcid;
  const pmcId = pmcIdRaw
    ? pmcIdRaw
        .replace('https://www.ncbi.nlm.nih.gov/pmc/articles/', '')
        .replace(/\/$/, '')
        .replace(/^PMC/i, '')
    : undefined;
  if (pmcId && seenPmcIds.has(pmcId)) return null;

  const abstract = reconstructAbstract(work.abstract_inverted_index ?? null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authors: string[] = (work.authorships ?? []).map((a: any) => a?.author?.display_name ?? '').filter(Boolean);
  const journal =
    work.primary_location?.source?.display_name ??
    work.best_oa_location?.source?.display_name ??
    undefined;

  // Only try PDF download for URLs that are actual PDFs (preprints/repos)
  const rawPdfUrl: string | undefined =
    work.best_oa_location?.pdf_url ??
    work.primary_location?.pdf_url ??
    undefined;
  const pdfUrl = rawPdfUrl && isPreprintPdfUrl(rawPdfUrl) ? rawPdfUrl : undefined;

  if (doi) seenDois.add(doi);

  return {
    doi, pmid, pmcId,
    title:    work.title,
    year:     work.publication_year ?? undefined,
    authors,
    journal,
    abstract: abstract || undefined,
    pdfUrl,
    source:   'openalex',
  };
}

async function fetchFromOpenAlex(query: string): Promise<PaperRecord[]> {
  const papers: PaperRecord[] = [];
  let cursor = '*';
  let page   = 0;

  while (savedCount + papers.length < MAX_PAPERS) {
    try {
      const { results, nextCursor } = await fetchOpenAlexPage(query, cursor);
      for (const work of results) {
        const p = parseOpenAlexWork(work);
        if (p) papers.push(p);
      }
      process.stdout.write(`    OpenAlex page ${++page}: ${results.length} works\n`);
      if (!nextCursor || results.length === 0) break;
      cursor = nextCursor;
      await sleep(API_DELAY_MS);
    } catch (err) {
      console.warn(`    OpenAlex error: ${(err as Error).message}`);
      break;
    }
  }

  return papers;
}

// ─── PDF download + extraction ────────────────────────────────────────────────

async function downloadPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `OneDayStronger/1.0 (${OPENALEX_EMAIL})`, 'Accept': 'application/pdf,*/*' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    // Magic bytes check — %PDF
    if (buffer.length < 5 || buffer.toString('ascii', 0, 4) !== '%PDF') return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string }>;
    const { text } = await pdfParse(buffer, { max: 50 });
    return text.trim() || null;
  } catch {
    return null;
  }
}

// ─── PubMed Central ───────────────────────────────────────────────────────────

const PMC_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

async function pmcSearch(query: string): Promise<{ ids: string[]; total: number }> {
  const params = new URLSearchParams({
    db:      'pmc',
    term:    `${query}[Title/Abstract]`,
    retmax:  '500',
    retmode: 'json',
    tool:    'OneDayStronger',
    email:   OPENALEX_EMAIL,
  });
  const res = await fetch(`${PMC_BASE}/esearch.fcgi?${params}`);
  if (!res.ok) throw new Error(`PMC esearch HTTP ${res.status}`);
  const data = await res.json() as { esearchresult: { count: string; idlist: string[] } };
  return {
    ids:   data.esearchresult.idlist ?? [],
    total: parseInt(data.esearchresult.count, 10),
  };
}

function stripXml(xml: string): string {
  return xml
    .replace(/<\?[^>]*\?>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches full-text XML for a batch of numeric PMC IDs.
 * Does NOT check seenPmcIds — callers manage dedup.
 */
async function fetchPmcXmlBatch(pmcIds: string[]): Promise<PaperRecord[]> {
  if (pmcIds.length === 0) return [];

  const params = new URLSearchParams({
    db:      'pmc',
    id:      pmcIds.join(','),
    rettype: 'xml',
    retmode: 'xml',
    tool:    'OneDayStronger',
    email:   OPENALEX_EMAIL,
  });

  const res = await fetch(`${PMC_BASE}/efetch.fcgi?${params}`);
  if (!res.ok) throw new Error(`PMC efetch HTTP ${res.status}`);
  const xml = await res.text();

  const papers: PaperRecord[] = [];

  // Split on article boundaries using string search (avoids regex backtracking on large XML)
  let remaining = xml;
  while (true) {
    const start = remaining.indexOf('<article ');
    if (start === -1) break;
    const end   = remaining.indexOf('</article>', start);
    if (end === -1) break;
    const articleXml = remaining.slice(start, end + '</article>'.length);
    remaining = remaining.slice(end + '</article>'.length);

    // PMC ID (stored as PMC12345678 under pub-id-type="pmcid")
    const pmcIdMatch = articleXml.match(/<article-id pub-id-type="pmcid"[^>]*>([\s\S]*?)<\/article-id>/);
    const pmcId = pmcIdMatch?.[1]?.trim().replace(/^PMC/i, '') ?? '';
    if (!pmcId) continue;

    // DOI
    const doiMatch = articleXml.match(/<article-id pub-id-type="doi"[^>]*>([\s\S]*?)<\/article-id>/);
    const doi = doiMatch?.[1]?.trim();

    // Title
    const titleMatch = articleXml.match(/<article-title[^>]*>([\s\S]*?)<\/article-title>/);
    const title = titleMatch ? stripXml(titleMatch[1]) : null;
    if (!title) continue;

    // Year
    const yearMatch = articleXml.match(/<pub-date[^>]*>[\s\S]*?<year>([\s\S]*?)<\/year>/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    // Journal
    const journalMatch = articleXml.match(/<journal-title[^>]*>([\s\S]*?)<\/journal-title>/);
    const journal = journalMatch ? stripXml(journalMatch[1]) : undefined;

    // Authors
    const surnameMatches = [...articleXml.matchAll(/<surname[^>]*>([\s\S]*?)<\/surname>/g)];
    const authors = surnameMatches.map((m) => stripXml(m[1])).filter(Boolean);

    // Abstract
    const abstractMatch = articleXml.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/);
    const abstract = abstractMatch ? stripXml(abstractMatch[1]) : undefined;

    // Body (full text)
    const bodyMatch = articleXml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    const fullText = bodyMatch ? stripXml(bodyMatch[1]) : undefined;

    papers.push({ doi, pmcId, title, year, authors, journal, abstract, fullText, source: 'pmc' });
  }

  return papers;
}

async function fetchFromPMC(query: string): Promise<PaperRecord[]> {
  try {
    const { ids, total } = await pmcSearch(query);
    if (ids.length === 0) return [];

    // Only fetch IDs not yet processed
    const newIds = ids.filter((id) => !seenPmcIds.has(id));
    if (newIds.length === 0) return [];

    process.stdout.write(`    PMC: ${total} total → ${newIds.length} new\n`);

    const papers: PaperRecord[] = [];
    for (let i = 0; i < newIds.length && savedCount + papers.length < MAX_PAPERS; i += 20) {
      const batch = newIds.slice(i, i + 20);
      await sleep(API_DELAY_MS);
      try {
        const fetched = await fetchPmcXmlBatch(batch);
        for (const p of fetched) {
          if (p.doi && seenDois.has(p.doi)) continue;
          if (seenPmcIds.has(p.pmcId!)) continue;
          if (p.doi) seenDois.add(p.doi);
          seenPmcIds.add(p.pmcId!);
          papers.push(p);
        }
        process.stdout.write(`    PMC batch ${Math.ceil(i / 20) + 1}: +${fetched.length} papers\n`);
      } catch (err) {
        console.warn(`    PMC batch error: ${(err as Error).message}`);
      }
    }
    return papers;
  } catch (err) {
    console.warn(`    PMC search error: ${(err as Error).message}`);
    return [];
  }
}

// ─── CORE (optional) ──────────────────────────────────────────────────────────

async function fetchFromCore(query: string): Promise<PaperRecord[]> {
  if (!CORE_API_KEY) return [];
  try {
    const res = await fetch('https://api.core.ac.uk/v3/search/works', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CORE_API_KEY}` },
      body: JSON.stringify({ q: query, limit: 100 }),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      results?: Array<{
        doi?: string; title?: string; yearPublished?: number;
        authors?: Array<{ name?: string }>; journals?: Array<{ title?: string }>;
        abstract?: string; downloadUrl?: string;
      }>;
    };
    const papers: PaperRecord[] = [];
    for (const item of data.results ?? []) {
      if (!item.title) continue;
      const doi = item.doi ?? undefined;
      if (doi && seenDois.has(doi)) continue;
      if (doi) seenDois.add(doi);
      papers.push({
        doi, title: item.title,
        year:    item.yearPublished,
        authors: (item.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
        journal: item.journals?.[0]?.title,
        abstract: item.abstract ?? undefined,
        pdfUrl: item.downloadUrl && isPreprintPdfUrl(item.downloadUrl) ? item.downloadUrl : undefined,
        source: 'core',
      });
    }
    return papers;
  } catch { return []; }
}

// ─── PMC eLink: PMID → PMC ID conversion ─────────────────────────────────────

/**
 * Given a list of PubMed IDs, returns a map of PMID → PMC ID for
 * those that have open full text in PubMed Central.
 * Batches up to 200 IDs per request.
 */
async function pmidsToPmcIds(pmids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (let i = 0; i < pmids.length; i += 200) {
    const batch = pmids.slice(i, i + 200);
    try {
      await sleep(API_DELAY_MS);
      const params = new URLSearchParams({
        dbfrom:  'pubmed',
        db:      'pmc',
        id:      batch.join(','),
        retmode: 'json',
        tool:    'OneDayStronger',
        email:   OPENALEX_EMAIL,
      });
      const res = await fetch(`${PMC_BASE}/elink.fcgi?${params}`);
      if (!res.ok) continue;

      const data = await res.json() as {
        linksets?: Array<{
          ids?: number[];
          linksetdbs?: Array<{ dbto: string; linkname: string; links?: number[] }>;
        }>;
      };

      for (const linkset of data.linksets ?? []) {
        const pmcLinks = linkset.linksetdbs?.find((db) => db.dbto === 'pmc' && db.linkname === 'pubmed_pmc');
        if (!pmcLinks?.links?.length) continue;
        // ids[0] is the source PMID for this linkset entry
        const pmid = String(linkset.ids?.[0] ?? '');
        const pmcId = String(pmcLinks.links[0]);
        if (pmid && pmcId) result.set(pmid, pmcId);
      }

      process.stdout.write(`  eLink batch ${Math.ceil(i / 200) + 1}: ${result.size} PMC IDs found so far\n`);
    } catch (err) {
      console.warn(`  eLink batch error: ${(err as Error).message}`);
    }
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\nFetching MSK rehabilitation papers → ${OUTPUT_DIR}`);
  console.log(`Queries: ${SEARCH_QUERIES.length} | Max papers: ${MAX_PAPERS}`);
  if (CORE_API_KEY) console.log('CORE enabled.');
  console.log('');

  const allPapers: PaperRecord[] = [];

  for (const query of SEARCH_QUERIES) {
    if (allPapers.length >= MAX_PAPERS) break;

    console.log(`\n▶ "${query}"`);

    await sleep(API_DELAY_MS);
    const oaPapers = await fetchFromOpenAlex(query);
    allPapers.push(...oaPapers);
    console.log(`  OpenAlex: +${oaPapers.length} (total ${allPapers.length})`);

    await sleep(API_DELAY_MS);
    const pmcPapers = await fetchFromPMC(query);
    allPapers.push(...pmcPapers);
    console.log(`  PMC: +${pmcPapers.length} (total ${allPapers.length})`);

    if (CORE_API_KEY) {
      await sleep(API_DELAY_MS);
      const corePapers = await fetchFromCore(query);
      allPapers.push(...corePapers);
      console.log(`  CORE: +${corePapers.length} (total ${allPapers.length})`);
    }
  }

  console.log(`\n\nCollection complete: ${allPapers.length} papers`);

  // ── Step 1: Convert OpenAlex PMIDs → PMC IDs via eLink, fetch full text ──
  const oaPapersWithPmid = allPapers.filter(
    (p) => p.source === 'openalex' && p.pmid && !p.fullText,
  );
  if (oaPapersWithPmid.length > 0) {
    console.log(`\nConverting ${oaPapersWithPmid.length} PubMed IDs → PMC IDs via eLink...`);
    const pmidToPmc = await pmidsToPmcIds(oaPapersWithPmid.map((p) => p.pmid!));
    console.log(`  Found ${pmidToPmc.size} papers with PMC full text`);

    // Assign PMC IDs back to papers (excluding any already fetched via PMC path)
    for (const paper of oaPapersWithPmid) {
      const pmcId = pmidToPmc.get(paper.pmid!);
      if (pmcId && !seenPmcIds.has(pmcId)) {
        paper.pmcId = pmcId;
      }
    }

    const toFetch = oaPapersWithPmid.filter((p) => p.pmcId && !seenPmcIds.has(p.pmcId));
    if (toFetch.length > 0) {
      console.log(`  Fetching full text XML for ${toFetch.length} papers...`);
      for (let i = 0; i < toFetch.length; i += 10) {
        const batch = toFetch.slice(i, i + 10);
        await sleep(API_DELAY_MS);
        try {
          const fetched = await fetchPmcXmlBatch(batch.map((p) => p.pmcId!));
          for (const fp of fetched) {
            const target = batch.find((p) => p.pmcId === fp.pmcId);
            if (target) {
              target.fullText = fp.fullText ?? fp.abstract;
              if (!target.abstract && fp.abstract) target.abstract = fp.abstract;
              if (fp.pmcId) seenPmcIds.add(fp.pmcId);
            }
          }
          const got = fetched.filter((f) => f.fullText).length;
          process.stdout.write(`  batch ${Math.ceil(i / 10) + 1}: ${got}/${batch.length} with full text\n`);
        } catch (err) {
          console.warn(`  PMC full text batch error: ${(err as Error).message}`);
        }
      }
    }
  }

  // ── Step 2: Download PDFs from preprint hosts ─────────────────────────────
  const pdfPapers = allPapers.filter((p) => p.pdfUrl && !p.fullText);
  if (pdfPapers.length > 0) {
    console.log(`\nDownloading ${pdfPapers.length} preprint PDFs...`);
    for (let i = 0; i < pdfPapers.length; i++) {
      const paper = pdfPapers[i];
      process.stdout.write(`  [${i + 1}/${pdfPapers.length}] ${paper.title.slice(0, 55)}...`);
      const text = await downloadPdfText(paper.pdfUrl!);
      if (text && wordCount(text) >= MIN_WORDS) {
        paper.fullText = text;
        process.stdout.write(` ✓ ${wordCount(text)} words\n`);
      } else {
        process.stdout.write(` — no text\n`);
      }
      await sleep(PDF_DELAY_MS);
    }
  }

  // ── Step 3: Save all papers ───────────────────────────────────────────────
  console.log('\nSaving text files...');
  for (const paper of allPapers) savePaper(paper);

  // ── Summary ───────────────────────────────────────────────────────────────
  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.txt'));
  const totalWords = files.reduce((acc, f) => {
    return acc + wordCount(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf-8'));
  }, 0);
  const withFullText = allPapers.filter((p) => p.fullText).length;
  const estimatedChunks = Math.ceil(totalWords / 500);
  const daysToEmbed = Math.ceil(estimatedChunks / 1500);

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`Papers saved:        ${files.length}`);
  console.log(`With full text:      ${withFullText} (${Math.round(withFullText / Math.max(allPapers.length, 1) * 100)}%)`);
  console.log(`Abstract only:       ${allPapers.length - withFullText}`);
  console.log(`Total words:         ${totalWords.toLocaleString()}`);
  console.log(`Estimated chunks:    ~${estimatedChunks.toLocaleString()}`);
  console.log(`Days to embed:       ~${daysToEmbed} (Gemini free: 1500 chunks/day)`);
  console.log('─────────────────────────────────────────────────────');
  console.log('\nNext — embed into Supabase:');
  console.log(
    '  SUPABASE_URL=https://rzczrwisocqlzuvouzem.supabase.co \\\n' +
    '  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \\\n' +
    '  GEMINI_API_KEY=<gemini-api-key> \\\n' +
    '    npx tsx scripts/ingest-knowledge.ts knowledge/papers',
  );
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
