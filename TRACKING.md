# Conversion tracking: rules for anyone editing this site

**Read this before changing the quote form, phone links, or the `<head>` of any page.** That applies to people and to Claude sessions, including the DMT blog pipeline.

Google Ads counts DMT's leads through Google Tag Manager container **`GTM-WT63QQ2F`** (Ads account DMT Building, tag `AW-18031758609`). The container is managed in GTM itself, and its build file lives in the NewLife Ads tracking setup. It needs the four things below from this site. Break any one of them and conversions silently stop counting: the ads keep spending money, but Google can't see the leads.

| # | Keep this | Where | Feeds |
|---|---|---|---|
| 1 | The GTM snippet right after `<head>` on every page (one copy, this ID only) | every `*.html` | Everything, including the ad click ID (Conversion Linker) |
| 2 | The GoHighLevel quote form embed (`api.leadconnectorhq.com/widget/form/…`) | `contact/index.html` | **Form Lead** |
| 3 | The phone number as a link: `<a href="tel:+17053333329">` | Header, footer, and any page that shows the number | **Phone Click** |
| 4 | The hardcoded GA4 tag `G-KFQEJ9F267` | Page `<head>` | GA4. The GA4 tag inside GTM is **paused** because of this, so removing it here stops GA4 entirely. |

The third conversion, **Call from Ads**, comes from the call asset on the ad, so no website code is involved.

## Safe to change freely

You can freely change copy, design, layout, CSS, images, new sections, new pages and URLs. Fields inside the GHL form are fine too.

## Adding things

- **A new page or blog post:** nothing to do. The **Tracking guard** workflow adds the GTM snippet automatically once the page is on `main`. To add it immediately, run `node scripts/add-gtm.mjs --write`.
- **A second form:** embed a GoHighLevel form and it's tracked automatically. Any other form tool needs a new GTM listener first.
- **Landing pages hosted elsewhere** (GHL funnels and so on): add the GTM snippet in that platform's head tracking code.

## Checks

```
node scripts/check-tracking.mjs   # what CI runs on every PR
node scripts/add-gtm.mjs --check  # just the GTM snippet coverage
```

## Don't

- Don't add a second Tag Manager container, or paste Google Ads `AW-` tags straight into pages. Conversions would double count.
- Don't unpause the "Google Tag – GA4 (All Pages)" tag in GTM while GA4 is hardcoded in the pages. Every page view would count twice.
