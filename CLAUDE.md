# dmtbuilding-site

## Conversion tracking is load-bearing: read TRACKING.md first

Google Ads counts DMT's leads through Tag Manager `GTM-WT63QQ2F`. Read [TRACKING.md](TRACKING.md) before you edit the quote form (`contact/`), phone links, or any page `<head>`.

The short version: never remove these four things.

- The GTM snippet after `<head>`
- The GoHighLevel form embed on `contact/`
- `tel:+17053333329` links
- The GA4 tag `G-KFQEJ9F267`

Never add a second GTM container or a raw `AW-` Google Ads tag.

Run `node scripts/check-tracking.mjs` before opening a PR. CI runs it on every PR.
