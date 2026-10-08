# Money Tracker

A personal tracker for spending only. It reads bank alert emails from a Gmail label, pulls out each spend, and categorises it. You see the month broken down by category and can edit, add or delete anything. It runs on a Mac mini and you reach it from anywhere over Tailscale.

## How it works

```
Gmail label ──IMAP──▶ emails table ──▶ bank regex parser ──(no match)──▶ Ollama (qwen2.5:3b)
                                              │
                                              ▼
                   spend / refund / not-spend ▶ dedupe ▶ merchant → category ▶ transactions
                                                                 ▲
                                          rules learned from your edits
```

- **Sync:** runs every 15 minutes and from **Settings → Sync now**. The first run backfills `BACKFILL_MONTHS` (6 by default).
- **Parsers:** each bank has its own (HDFC, ICICI, Axis, SBI, Kotak) in `server/parsers/`. Alerts in an unknown format go to the local LLM. If that's off or fails, the email lands in **Review**.
- **Not counted:**
  - credit card bill payments (CRED, BillDesk, "payment received")
  - transfers to accounts listed under **Settings → Your own accounts**
  - wallet top-ups
  - incoming money

  These rows are still visible under **All → Not counted**.
- **Refunds:** subtracted from the category of the original purchase.
- **Duplicates:** two alerts with the same UPI reference count once. So do two alerts with the same amount on the same card within 15 minutes. You can override with *Not a duplicate*.
- **Categories:** your merchant rules apply first, then a built-in keyword map, then the LLM. Anything guessed or unknown waits in **Review**. Picking a category there saves a rule, so that merchant is never asked about again.
- **Your changes are final:** edits and deletes are never overwritten by a sync or a re-read.

## Setup on the Mac mini

1. **Gmail label.** Make sure your bank alerts land in the `transactions` label. If they don't, create a Gmail filter for the bank senders that applies the label, ticking "also apply to matching conversations":
   `from:(hdfcbank.net OR hdfcbank.bank.in OR icicibank.com OR axisbank.com OR sbi.co.in OR sbicard.com OR kotak.com)`
2. **App password.** This needs 2-Step Verification on your Google account. Create one at https://myaccount.google.com/apppasswords.
3. **Tailscale.** Install it on the mini and on your phone (https://tailscale.com/download) and sign in to both. In the admin console under **DNS**, enable **MagicDNS** and **HTTPS Certificates**. The PWA needs HTTPS.
4. **Install:**
   ```bash
   git clone <this repo> ~/money-tracker && cd ~/money-tracker
   scripts/install-mac.sh          # first run creates .env
   ```
5. Put `GMAIL_USER` and `GMAIL_APP_PASSWORD` into `.env`, then run `scripts/install-mac.sh` again. The script:
   - installs Node and Ollama
   - pulls `qwen2.5:3b` (about 2 GB, fine on 8 GB RAM)
   - builds the app
   - registers a launchd agent that restarts on crash and at login
   - runs `tailscale serve`
6. **Check the parsers against your real mail:**
   ```bash
   npm run parse-report
   ```
   This shows parse coverage per sender, the emails it couldn't read, and merchants it couldn't categorise. It's a dry run, so no transactions are written.
7. **On your phone,** open `https://<mini-name>.<tailnet>.ts.net`, then use Share → **Add to Home Screen** (iOS) or Install (Android).

**Mac mini settings:**
- In System Settings → Energy, turn on *Prevent automatic sleeping* and *Start up automatically after a power failure*.
- Turn on automatic login (Users & Groups). The service is a user LaunchAgent, so it starts when you log in.

## Day to day

| Task | How |
|---|---|
| Update after `git pull` | `scripts/install-mac.sh` (idempotent) |
| Restart | `launchctl kickstart -k gui/$(id -u)/com.money-tracker` |
| Logs | `tail -f ~/Library/Logs/money-tracker/server.log` |
| Back up | `sqlite3 data/money.db ".backup ~/money-backup.db"` (or let Time Machine cover `data/`) |
| Regex only, no LLM | set `OLLAMA_URL=` in `.env` and restart |

## Development

```bash
npm install
npm run dev:server   # API on :4100 (reads .env)
npm run dev:web      # Vite on :5173, proxies /api
npm test             # parsers, pipeline, API, LLM fallback
npm run typecheck
```

**When a bank email doesn't parse:**
1. Add an anonymised copy to `tests/fixtures/alerts.ts`.
2. Adjust that bank's patterns in `server/parsers/<bank>.ts`.
3. Run **Settings → Re-read all emails**.
