// Guards the Google Ads conversion tracking (Tag Manager container GTM-WT63QQ2F).
// See TRACKING.md for what each check protects and why.
//
//   node scripts/check-tracking.mjs
//
// FAIL (exit 1): something that would silently stop conversions being counted
//                and will not fix itself.
// WARN (exit 0): pages missing the GTM snippet. The "Tracking guard" workflow
//                adds it on main automatically (scripts/add-gtm.mjs --write),
//                so a new blog post in a PR is expected to warn here.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GTM = "GTM-WT63QQ2F";
const GA4 = "G-KFQEJ9F267";
const PHONE = "tel:+17053333329";
const FORM_WIDGET = "leadconnectorhq.com/widget/form/";

const fails = [], warns = [];
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : null);
const need = (rel, ok, msg) => { const s = read(rel); if (s === null) fails.push(`${rel}: file is missing (${msg})`); else if (!ok(s)) fails.push(`${rel}: ${msg}`); };
const count = (s, needle) => s.split(needle).length - 1;

// 1. Form Lead: the quote form must stay a GoHighLevel form embed. GTM's
//    "Listener - GoHighLevel Forms + Calendar" counts its submit message.
need("contact/index.html", (s) => s.includes(FORM_WIDGET),
  "the quote form is no longer the GoHighLevel form embed. The Form Lead conversion listens for GHL's submit message; a different form tool needs a new listener in GTM.");

// 2. Phone Click: the number must stay a clickable tel: link.
for (const f of ["index.html", "contact/index.html"]) {
  need(f, (s) => s.includes(PHONE), `must keep the phone number as a link to ${PHONE} (Phone Click conversion).`);
}

// 3. GA4 stays hardcoded in the page. The GA4 tag inside GTM is paused because
//    of this; removing it here would silently stop GA4.
for (const f of ["index.html", "contact/index.html"]) {
  need(f, (s) => s.includes(GA4), `lost the GA4 tag ${GA4}.`);
}

// 4. GTM snippet: exactly one, and the right container.
const html = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter((f) => f && !f.startsWith("static/") && !f.startsWith("assets/"));
const missing = [];
for (const f of html) {
  const s = read(f);
  if (!s || /http-equiv=["']refresh["']/i.test(s) || !/<head(\s[^>]*)?>/i.test(s)) continue;
  const ids = [...new Set(s.match(/GTM-[A-Z0-9]{6,}/g) || [])];
  if (ids.some((id) => id !== GTM)) fails.push(`${f}: contains another Tag Manager container (${ids.join(", ")}). DMT uses only ${GTM}.`);
  else if (count(s, `'${GTM}'`) > 1) fails.push(`${f}: loads ${GTM} more than once (conversions would double count).`);
  else if (!ids.length) missing.push(f);
  if (/AW-\d{6,}/.test(s)) fails.push(`${f}: has a raw Google Ads AW- tag. All Ads tags live inside GTM, or conversions double count.`);
}
if (missing.length) {
  warns.push(`${missing.length} page(s) don't load ${GTM} yet. They are added automatically once merged to main; to do it now run: node scripts/add-gtm.mjs --write`);
  missing.slice(0, 10).forEach((f) => warns.push(`  - ${f}`));
}

for (const w of warns) console.log(`::warning::${w}`);
for (const f of fails) console.log(`::error::${f}`);
console.log(fails.length ? `\nTracking check FAILED (${fails.length}). See TRACKING.md.` : "\nTracking check passed.");
process.exit(fails.length ? 1 : 0);
