#!/usr/bin/env node
/**
 * build-sitemap-page.mjs — keep the human site map (/sitemap/) in sync with the
 * pages that actually exist on disk.
 *
 * Ported from newlifemarketing-site/scripts/build-indexes.mjs (sitemap page
 * only). sitemap.xml is NOT touched here — the blog pipeline owns that file.
 *
 * Why a generator rather than an agent instruction: an instruction is one-shot,
 * so a page it misses stays missed. This reads the filesystem, so a page that
 * slipped through last time gets picked up on the next run, and deleted pages
 * drop off.
 *
 *   node scripts/build-sitemap-page.mjs            write
 *   node scripts/build-sitemap-page.mjs --check    report only, exit 1 if stale
 *
 * Run on main only (see .github/workflows/sitemap-page.yml). A blog/{slug}
 * branch is cut from an older main, so rebuilding the list there would drop
 * every page added to main since the branch was created.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', '.claude', 'scripts', 'static', 'assets', 'images']);
const SKIP_URLS = new Set(['/404.html', '/sitemap/']);

// ------------------------------------------------------------- discovery ----
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');

const pages = [];
for (const abs of walk(ROOT)) {
  const src = fs.readFileSync(abs, 'utf8');
  if (/http-equiv=["']refresh["']/i.test(src)) continue;          // redirect stub
  if (/<meta\s+name="robots"[^>]*noindex/i.test(src)) continue;   // deliberately hidden
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const url = '/' + rel.replace(/index\.html$/, '');
  if (SKIP_URLS.has(url)) continue;
  const t = src.match(/<title>([\s\S]*?)<\/title>/i);
  const title = t ? decode(t[1].replace(/\s+/g, ' ').trim()) : url;
  // the label is the page name, without the " | Brand" tail
  const short = url === '/' ? 'Home' : title.split(/\s*\|\s*/)[0].trim();
  pages.push({ url, short });
}
pages.sort((a, b) => sortKey(a.short).localeCompare(sortKey(b.short)));

function sortKey(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
          .replace(/&[a-z]+;/gi, ' ')
          .replace(/[^0-9a-zA-Z ]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const esc = (s) => String(s ?? '')
  .replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// -------------------------------------------------------------- the list ----
const byUrl = new Map(pages.map(p => [p.url, p]));
const kids = new Map(); const top = [];
for (const p of pages) {
  const segs = p.url.replace(/^\/|\/$/g, '').split('/');
  const parent = segs.length > 1 ? '/' + segs.slice(0, -1).join('/') + '/' : null;
  if (parent && byUrl.has(parent)) {
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(p);
  } else top.push(p);
}
const li = (p) => `<li><a href="${p.url}">${esc(p.short)}</a>` +
  (kids.has(p.url) ? `<ul>${kids.get(p.url).map(li).join('')}</ul>` : '') + '</li>';
const listHtml = `<ul class="sitemap-list">${top.map(li).join('')}</ul>`;

/**
 * Find the sitemap list and its MATCHING close.
 *
 * A greedy /<ul class="sitemap-list">[\s\S]*<\/ul>/ runs past the nested
 * child lists and swallows everything to the last </ul> in the document —
 * which is in the footer. Count depth instead.
 */
function findList(html) {
  const start = html.indexOf('<ul class="sitemap-list">');
  if (start === -1) return null;
  const re = /<ul\b[^>]*>|<\/ul>/g;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html)) !== null) {
    depth += m[0] === '</ul>' ? -1 : 1;
    if (depth === 0) return { start, end: m.index + m[0].length };
  }
  return null;
}

const smPath = path.join(ROOT, 'sitemap', 'index.html');
let stale = false;
if (!fs.existsSync(smPath)) {
  console.error('  ! sitemap/index.html does not exist');
  process.exit(2);
}
const cur = fs.readFileSync(smPath, 'utf8');
const loc = findList(cur);
if (!loc) {
  console.error('  ! sitemap/index.html: could not locate the list — leaving it alone');
  process.exit(2);
}
if (cur.slice(loc.start, loc.end) !== listHtml) {
  stale = true;
  if (!CHECK) {
    const next = cur.slice(0, loc.start) + listHtml + cur.slice(loc.end);
    // never write a version that lost the footer
    if (!next.includes('<footer class="site-footer"')) {
      console.error('  ! refusing to write sitemap/index.html: footer would be lost');
      process.exit(2);
    }
    fs.writeFileSync(smPath, next, 'utf8');
  }
}

// ------------------------------------------------------------------ report --
console.log(`indexable pages: ${pages.length}`);
console.log(`sitemap/index.html : ${stale ? (CHECK ? 'STALE' : 'rewritten') : 'up to date'}`);
if (CHECK && stale) {
  console.error('\nFAIL — run: node scripts/build-sitemap-page.mjs');
  process.exit(1);
}
console.log(CHECK ? '\nOK — site map is current.' : '\nDone.');
