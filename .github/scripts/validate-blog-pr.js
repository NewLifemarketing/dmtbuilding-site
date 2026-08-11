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
for (const c of changes) {
  if (newPostRe.test(c.path)) {
    if (c.status !== "A") problems.push(`Blog post file ${c.path} must be ADDED, not modified/renamed (status ${c.status}).`);
    newPosts.push(c.path);
  } else if (allowedModify.has(c.path)) {
    if (c.status !== "M" && c.status !== "A") problems.push(`${c.path} changed with disallowed status ${c.status}.`);
  } else if (allowedAddOther.has(c.path)) {
    if (c.status !== "A") problems.push(`${c.path} must be ADDED once, not modified (status ${c.status}).`);
  } else {
    problems.push(`Disallowed file changed: ${c.path} (${c.status}). A blog PR may only add /blog/{slug}/index.html and static/blog-post.css, and edit blog/index.html + sitemap.xml.`);
  }
}

if (newPosts.length === 0) {
  problems.push("No new /blog/{slug}/index.html was added — nothing to publish.");
} else if (newPosts.length > 1) {
  problems.push(`More than one new post in a single PR (${newPosts.join(", ")}). One post per PR.`);
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
