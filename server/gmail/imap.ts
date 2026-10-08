import { convert } from 'html-to-text';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config.ts';
import { getSetting, setSetting, type DB } from '../db.ts';
import { toLocalIso } from '../parsers/common.ts';
import { DISMISSED } from '../pipeline/ingest.ts';

interface Cursor {
  uidValidity: string;
  lastUid: number;
}

export interface FetchResult {
  fetched: number;
  mailbox: string;
}

function client() {
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: config.gmail.user, pass: config.gmail.password },
    logger: false,
  });
}

/** Gmail exposes labels as folders; match the configured name case-insensitively so "Transactions" works too. */
async function resolveMailbox(imap: ImapFlow, label: string): Promise<string> {
  const boxes = await imap.list();
  const hit = boxes.find((b) => b.path === label) ?? boxes.find((b) => b.path.toLowerCase() === label.toLowerCase());
  if (!hit) throw new Error(`Gmail label "${label}" not found. Labels: ${boxes.map((b) => b.path).join(', ')}`);
  return hit.path;
}

// Prefer the HTML part: some senders' text part is a placeholder ("Default email text body") or raw CSS.
function bodyText(mail: { html: string | false; text?: string }): string {
  if (typeof mail.html === 'string' && mail.html.trim()) {
    return convert(mail.html, {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
      ],
    });
  }
  return mail.text ?? '';
}

/**
 * Pull new messages from the label into the emails table. Parsing happens separately.
 * `refetch` re-downloads the whole backfill window and refreshes stored bodies (after a body-extraction fix);
 * refreshed emails go back to pending so the next sync re-reads them. Your edits still win.
 */
export async function fetchNewEmails(db: DB, opts: { refetch?: boolean } = {}): Promise<FetchResult> {
  const imap = client();
  await imap.connect();
  try {
    const mailbox = await resolveMailbox(imap, config.gmail.label);
    const lock = await imap.getMailboxLock(mailbox, { readOnly: true });
    const raw: { uid: number; emailId: string; source: Buffer; internalDate: Date }[] = [];
    try {
      const box = imap.mailbox;
      if (!box) throw new Error('mailbox not open');
      const uidValidity = String(box.uidValidity);
      let cursor = getSetting<Cursor | null>(db, 'imap_cursor', null);
      if (cursor?.uidValidity !== uidValidity || opts.refetch) cursor = { uidValidity, lastUid: 0 };

      let range: string | number[];
      if (cursor.lastUid > 0) {
        range = `${cursor.lastUid + 1}:*`;
      } else {
        const since = new Date();
        since.setMonth(since.getMonth() - config.backfillMonths);
        const uids = await imap.search({ since }, { uid: true });
        range = uids || [];
      }

      if (typeof range === 'string' || range.length > 0) {
        for await (const msg of imap.fetch(range, { uid: true, emailId: true, source: true, internalDate: true }, { uid: true })) {
          // "N:*" always returns the newest message even when N is past it.
          if (msg.uid <= cursor.lastUid || !msg.source) continue;
          raw.push({
            uid: msg.uid,
            emailId: msg.emailId ?? `uid-${uidValidity}-${msg.uid}`,
            source: msg.source,
            internalDate: new Date(msg.internalDate ?? Date.now()),
          });
        }
      }

      const maxUid = raw.reduce((m, r) => Math.max(m, r.uid), cursor.lastUid);
      const insert = db.prepare(
        opts.refetch
          ? `INSERT INTO emails (id, uid, from_addr, subject, received_at, body_text) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET from_addr = excluded.from_addr, subject = excluded.subject, body_text = excluded.body_text,
               parse_status = CASE WHEN emails.body_text = excluded.body_text OR emails.error IS '${DISMISSED}'
                 THEN emails.parse_status ELSE 'pending' END`
          : `INSERT OR IGNORE INTO emails (id, uid, from_addr, subject, received_at, body_text) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const r of raw) {
        try {
          const mail = await simpleParser(r.source);
          const body = bodyText(mail);
          insert.run(r.emailId, r.uid, mail.from?.text ?? '', mail.subject ?? '', toLocalIso(mail.date ?? r.internalDate), body);
        } catch (e) {
          // Keep it visible in Review instead of failing every future sync on the same message.
          insert.run(r.emailId, r.uid, '', '(could not decode email)', toLocalIso(r.internalDate), `MIME parse error: ${(e as Error).message}`);
        }
      }
      setSetting(db, 'imap_cursor', { uidValidity, lastUid: maxUid });
      return { fetched: raw.length, mailbox };
    } finally {
      lock.release();
    }
  } finally {
    await imap.logout().catch(() => {});
  }
}
