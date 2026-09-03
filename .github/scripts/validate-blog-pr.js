#!/usr/bin/env node
"use strict";

// validate-blog-pr.js — companion to auto-publish.yml. INSTALL in the SITE repo
// at .github/scripts/validate-blog-pr.js.
//
// Validates a pipeline-generated blog PR against DMT's hard limits before the
// workflow is allowed to auto-merge it. Exits 0 (pass) or 1 (fail); prints a
// human-readable report either way. Run as:
//   node .github/scripts/validate-blog-pr.js <baseSha> <headSha>

const { execFileSync } = require("child_process");
const fs = require("fs");

const [, , baseSha, headSha] = process.argv;
if (!baseSha || !headSha) {
  console.error("Usage: validate-blog-pr.js <baseSha> <headSha>");
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const problems = [];
const notes = [];

// 1. Which files changed, and how.
const raw = git(["diff", "--name-status", `${baseSha}`, `${headSha}`]);
const changes = raw
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, ...rest] = line.split(/\t/);
    return { status: status[0], path: rest.join("\t") };
  });

// 2. Every changed path must be one of the allowed shapes.
const newPostRe = /^blog\/[a-z0-9-]+\/index\.html$/;
const allowedModify = new Set(["blog/index.html", "sitemap.xml"]);
const allowedAddOther = new Set(["static/blog-post.css"]);

const newPosts = [];
// Existing posts modified ONLY to wire prev/next nav. Added 2026-09-03, ported
// from A&R's validator, which already had it. Without this the validator
// rejected the pipeline's own documented behaviour -- site-publisher.md tells the
// run to wire the previous post's nav-next, which arrives as status M while the
// rule below demanded status A.
const navEdits = [];
for (const c of changes) {
  if (newPostRe.test(c.path)) {
    if (c.status === "A") newPosts.push(c.path);
    else if (c.status === "M") navEdits.push(c.path);
    else problems.push(`Blog post ${c.path} has disallowed status ${c.status}.`);
  } else if (allowedModify.has(c.path)) {
    if (c.status !== "M" && c.status !== "A") problems.push(`${c.path} changed with disallowed status ${c.status}.`);
  } else if (allowedAddOther.has(c.path)) {
    if (c.status !== "A") problems.push(`${c.path} must be ADDED once, not modified (status ${c.status}).`);
  } else {
    problems.push(`Disallowed file changed: ${c.path} (${c.status}). A blog PR may only add /blog/{slug}/index.html and static/blog-post.css, edit blog/index.html + sitemap.xml, and wire ONE previous post's nav.`);
  }
}

if (newPosts.length === 0) {
  problems.push("No new /blog/{slug}/index.html was added — nothing to publish.");
} else if (newPosts.length > 1) {
  problems.push(`More than one new post in a single PR (${newPosts.join(", ")}). One post per PR.`);
}
if (navEdits.length > 1) {
  problems.push(`More than one existing post modified (${navEdits.join(", ")}); only the immediately-previous post nav may be wired.`);
}

// A modified existing post may ONLY have changed its prev/next nav. The allowance
// is deliberately narrow: it lets the pipeline do the one edit it needs without
// opening the door to quietly editing published copy.
for (const p of navEdits) {
  const diff = git(["diff", baseSha, headSha, "--", p]);
  const changedLines = diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const offending = changedLines.filter((l) => !/nav-next|nav-prev|post-nav|Newest post/.test(l));
  if (offending.length) {
    problems.push(`${p}: a previous post may only change its prev/next nav, but other lines changed: ${offending.slice(0, 4).join(" | ")}`);
  }
}

// 3. Validate the new post's HTML content.
for (const postPath of newPosts) {
  let html = "";
  try {
    html = fs.readFileSync(postPath, "utf8");
  } catch (err) {
    problems.push(`Could not read ${postPath}: ${err.message}`);
    continue;
  }

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count !== 1) problems.push(`${postPath}: expected exactly one <h1>, found ${h1Count}.`);

  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push(`${postPath}: missing <title>.`);
  if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) problems.push(`${postPath}: missing meta description.`);
  if (!/<link\s+rel="canonical"/i.test(html)) problems.push(`${postPath}: missing canonical link.`);
  if (!/G-KFQEJ9F267/.test(html)) problems.push(`${postPath}: missing GA4 tag (G-KFQEJ9F267).`);
  if (!/application\/ld\+json/i.test(html)) problems.push(`${postPath}: missing JSON-LD structured data.`);
  if (/\[NEEDS SOURCE/i.test(html)) problems.push(`${postPath}: still contains a [NEEDS SOURCE] marker — fact-checker did not finish.`);
  if (/href="\.\.\//.test(html)) notes.push(`${postPath}: contains a relative "../" href — confirm asset paths are root-relative.`);
}

// 4. Report.
console.log(`Changed files (${changes.length}):`);
for (const c of changes) console.log(`  ${c.status}  ${c.path}`);
console.log("");

if (notes.length) {
  console.log("Notes:");
  for (const n of notes) console.log(`  • ${n}`);
  console.log("");
}

if (problems.length) {
  console.log(`VALIDATION FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}

console.log("VALIDATION PASSED — post is within the hard limits and has required SEO elements.");
process.exit(0);
