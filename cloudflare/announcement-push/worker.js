import { parseAnnouncements } from '../../content-lib/announcements.ts';
import { PUSH_TOKEN, subscription, targets, messageFor, publicationInstant, eligibleForPush } from './core.js';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
const SOURCE = 'https://vedantayojana.org/announcements.json';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/_push/status' && request.method === 'GET') return response({ available: true });
    if (path !== '/_push/subscription' || !['POST', 'DELETE'].includes(request.method)) return response({ error: 'Not found' }, 404);
    if (Number(request.headers.get('Content-Length') ?? 0) > 4096) return response({ error: 'Too large' }, 413);
    const origin = request.headers.get('Origin');
    if (origin && origin !== 'https://vedantayojana.org') return response({ error: 'Forbidden origin' }, 403);
    // Cloudflare's edge rate limit stores counters, not tokens or IPs in our database.
    const limit = await env.REGISTRATION_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' });
    if (!limit.success) return response({ error: 'Try later' }, 429);
    const text = await request.text();
    if (text.length > 4096) return response({ error: 'Too large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return response({ error: 'Invalid JSON' }, 400); }
    if (request.method === 'POST' ? !subscription(body) : !PUSH_TOKEN.test(body?.token)) return response({ error: 'Invalid subscription' }, 400);
    const stub = env.PUSH_STORE.get(env.PUSH_STORE.idFromName('announcements'));
    return stub.fetch(new Request('https://internal/subscription', { method: request.method, body: JSON.stringify(body) }));
  },
  async scheduled(_event, env, ctx) {
    const stub = env.PUSH_STORE.get(env.PUSH_STORE.idFromName('announcements'));
    ctx.waitUntil(stub.fetch(new Request('https://internal/tick', { method: 'POST' })).then(r => {
      if (!r.ok) throw new Error(`Announcement push tick failed (${r.status})`);
    }));
  },
};

/** SQLite Durable Object: one serialized queue, tokens never exposed or logged. */
export class AnnouncementPushStore {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql; this.processing = Promise.resolve();
    this.sql.exec('CREATE TABLE IF NOT EXISTS subscribers (token TEXT PRIMARY KEY, platform TEXT NOT NULL, language TEXT NOT NULL, joined INTEGER NOT NULL, refreshed INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.sql.exec("CREATE TABLE IF NOT EXISTS queue (announcement TEXT, token TEXT, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_try INTEGER NOT NULL DEFAULT 0, receipt TEXT, created INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (announcement, token))");
  }
  async fetch(request) {
    const result = this.processing.then(async () => {
      if (new URL(request.url).pathname === '/tick') {
        try { await this.tick(); return response({ ok: true }); }
        catch (error) { console.error('push.tick.failed', { stage: this.stage ?? 'unknown', reason: error instanceof Error ? error.message : 'unknown error' }); return response({ error: 'Push processing failed' }, 503); }
      }
      const value = await request.json();
      if (request.method === 'DELETE') {
        this.sql.exec('DELETE FROM subscribers WHERE token = ?', value.token);
        this.sql.exec('DELETE FROM queue WHERE token = ?', value.token);
        return response({ enabled: false });
      }
      const s = subscription(value);
      if (!s) return response({ error: 'Invalid subscription' }, 400);
      const now = Date.now();
      this.sql.exec('INSERT INTO subscribers (token, platform, language, joined, refreshed) VALUES (?, ?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET platform=excluded.platform, language=excluded.language, refreshed=excluded.refreshed', s.token, s.platform, s.language, now, now);
      return response({ enabled: true });
    });
    this.processing = result.catch(() => {});
    return result;
  }
  async tick() {
    const now = Date.now();
    this.stage = 'cleanup';
    // Expire dormant subscriptions; the app renews on launch/foreground.
    this.sql.exec('DELETE FROM subscribers WHERE refreshed < ?', now - 180 * 86400000);
    this.sql.exec('DELETE FROM queue WHERE token NOT IN (SELECT token FROM subscribers)');
    this.stage = 'source-fetch';
    const remote = await fetch(SOURCE, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(10000) });
    if (!remote.ok) throw new Error('Announcement source unavailable');
    this.stage = 'source-parse';
    const list = parseAnnouncements(await remote.json());
    if (!list) throw new Error('Invalid announcement source');
    this.stage = 'announcement-discovery';
    const initialized = this.sql.exec("SELECT value FROM meta WHERE key='initialized'").toArray().length > 0;
    // The first cron establishes a baseline; deploying never blasts historical notices.
    let discovered = 0;
    let enqueued = 0;
    for (const a of [...list].reverse()) {
      if (publicationInstant(a) > now) continue;
      if (this.sql.exec('SELECT id FROM announcements WHERE id=?', a.id).toArray().length) continue;
      discovered++;
      this.ctx.storage.transactionSync(() => {
        if (initialized && eligibleForPush(a, now)) {
          for (const sub of this.sql.exec('SELECT * FROM subscribers').toArray()) {
            if (targets(a, sub.platform)) { this.sql.exec('INSERT OR IGNORE INTO queue (announcement, token, payload, created) VALUES (?, ?, ?, ?)', a.id, sub.token, JSON.stringify(messageFor(a, sub)), now); enqueued++; }
          }
        }
        this.sql.exec('INSERT OR IGNORE INTO announcements (id) VALUES (?)', a.id);
      });
    }
    this.sql.exec("INSERT OR IGNORE INTO meta (key,value) VALUES ('initialized','yes')");
    this.sql.exec('DELETE FROM queue WHERE created < ?', now - 2 * 86400000);
    // Receipt checks precede sends. Expo accepting a ticket is not device delivery.
    this.stage = 'receipt-check';
    const receipts = this.sql.exec("SELECT * FROM queue WHERE status='ticket' AND next_try <= ? LIMIT 100", now).toArray();
    if (receipts.length) {
      const result = await this.expo('getReceipts', { ids: receipts.map(x => x.receipt) });
      for (const row of receipts) {
        const receipt = result.data?.[row.receipt];
        if (!receipt) { this.sql.exec('UPDATE queue SET next_try=? WHERE announcement=? AND token=?', now + 900000, row.announcement, row.token); continue; }
        if (receipt.details?.error === 'DeviceNotRegistered') this.remove(row.token);
        else {
          if (receipt.status !== 'ok') console.error('push.receipt.rejected', { error: receipt.details?.error ?? 'unknown', status: receipt.status ?? 'unknown' });
          this.sql.exec("UPDATE queue SET status=? WHERE announcement=? AND token=?", receipt.status === 'ok' ? 'accepted' : 'failed', row.announcement, row.token);
        }
      }
    }
    this.stage = 'ticket-send';
    const pending = this.sql.exec("SELECT * FROM queue WHERE status='pending' AND attempts < 5 AND next_try <= ? LIMIT 100", now).toArray();
    if (pending.length) {
      const result = await this.expo('send', pending.map(row => JSON.parse(row.payload)));
      if (!Array.isArray(result.data) || result.data.length !== pending.length) throw new Error('Invalid Expo ticket response');
      result.data.forEach((ticket, i) => {
        const row = pending[i];
        if (ticket.details?.error === 'DeviceNotRegistered') this.remove(row.token);
        else if (ticket.status === 'ok' && ticket.id) this.sql.exec("UPDATE queue SET status='ticket', receipt=?, next_try=? WHERE announcement=? AND token=?", ticket.id, now + 900000, row.announcement, row.token);
        else {
          console.error('push.ticket.rejected', { error: ticket.details?.error ?? 'unknown', status: ticket.status ?? 'unknown' });
          this.sql.exec("UPDATE queue SET status='failed' WHERE announcement=? AND token=?", row.announcement, row.token);
        }
      });
    }
    const counts = this.sql.exec("SELECT status, COUNT(*) AS count FROM queue GROUP BY status").toArray();
    console.info('push.tick.summary', { initialized, subscribers: this.sql.exec('SELECT COUNT(*) AS count FROM subscribers').toArray()[0]?.count ?? 0, discovered, enqueued, receiptsChecked: receipts.length, pendingSent: pending.length, queue: Object.fromEntries(counts.map(x => [x.status, x.count])) });
    this.sql.exec("DELETE FROM queue WHERE status IN ('accepted','failed') OR attempts >= 5");
    this.stage = 'complete';
  }
  remove(token) {
    this.sql.exec('DELETE FROM subscribers WHERE token=?', token);
    this.sql.exec('DELETE FROM queue WHERE token=?', token);
  }
  async expo(action, body) {
    // Backoff persisted before I/O, including ambiguous network outcomes; bounded retries.
    if (action === 'send') for (const message of body) this.sql.exec("UPDATE queue SET attempts=attempts+1, next_try=? WHERE token=? AND announcement=?", Date.now() + 600000, message.to, message.data.announcementId);
    const result = await fetch(`https://exp.host/--/api/v2/push/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${this.env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) throw new Error(`Expo request failed (${result.status})`);
    return result.json();
  }
}
