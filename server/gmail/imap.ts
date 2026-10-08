import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config.ts';
import { getSetting, setSetting, type DB } from '../db.ts';
import { toLocalIso } from '../parsers/common.ts';

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

/** Pull new messages from the label into the emails table. Parsing happens separately. */
export async function fetchNewEmails(db: DB): Promise<FetchResult> {
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
      if (cursor?.uidValidity !== uidValidity) cursor = { uidValidity, lastUid: 0 };

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
        `INSERT OR IGNORE INTO emails (id, uid, from_addr, subject, received_at, body_text) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const r of raw) {
        try {
          const mail = await simpleParser(r.source);
          const body = mail.text || (typeof mail.html === 'string' ? mail.html.replace(/<[^>]+>/g, ' ') : '') || '';
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
