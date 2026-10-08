# Money Tracker — todo

## 1. Scaffold
- [x] git, package.json, tsconfig, .env.example, .gitignore
- [x] SQLite schema + migrations (node:sqlite, no native deps)
- [x] CRUD API: transactions, categories, rules, summary
- [x] Web: Month, Transactions, Add/Edit sheet

## 2. Mail
- [x] IMAP sync of the label with UID cursor + 6-month backfill
- [x] Raw email store, `npm run parse-report`

## 3. Parsing
- [x] Bank parsers: HDFC, ICICI, Axis, SBI, Kotak
- [x] Kind (spend/refund/excluded) + dedupe
- [x] Vitest fixtures per format

## 4. Categorisation
- [x] Merchant normalisation + seed map + learned rules
- [x] Ollama fallback (qwen2.5:3b)
- [x] Review screen

## 5. Ship
- [x] PWA manifest + service worker
- [x] Settings page
- [x] install-mac.sh + launchd plist + Tailscale serve

## Waiting on you
- [ ] Gmail app password in `.env`, then `npm run parse-report` against real mail
- [ ] Tune parsers for any formats the report flags (fixtures are reconstructed, not real samples)
- [ ] Deploy on the M1 mini: `scripts/install-mac.sh`

## Review
- 48 tests: one fixture per bank format, plus pipeline (dedupe, edits survive re-read, learned rules), API (refund netting, exclusions, validation), and the Ollama fallback with a stubbed `fetch`.
- Checked in the browser against a seeded demo DB: mobile 375px and desktop, light and dark, add, edit + "always use for merchant", Review.
- Code review fixed:
  - refund wording in a footer flipping a debit
  - one bad MIME message blocking sync forever
  - re-reading without Ollama deleting spends the LLM made
  - unescaped regex from own-account input
  - installer aborting under pipefail
- Mid-month "vs last month" now compares to the same day last month.
- Not verified here:
  - real Gmail IMAP (no credentials on this machine)
  - real Ollama inference (not installed here)
  - launchd + Tailscale (meant for the mini, not this Mac)
