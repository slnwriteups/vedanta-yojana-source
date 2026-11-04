import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { subscription, targets, messageFor, publicationInstant, eligibleForPush, retryable } from './core.js';
import worker, { AnnouncementPushStore } from './worker.js';
const token = 'ExpoPushToken[abcdefghijklmnopqrstuv]';
const base = { id: '2026-10-31-one', date: '2026-10-31', title: 'English', body: 'Original body', platforms: ['app'], translations: { ta: { title: 'தமிழ்', body: 'தமிழ் அறிவிப்பு' } } };

test('subscriptions validate token, platform and all supported languages', () => {
  for (const language of ['en','ta','kn','hi','te']) assert.ok(subscription({ token, platform: 'ios', language }));
  for (const patch of [{ token: 'not-a-token' }, { platform: 'web' }, { language: 'xx' }]) assert.equal(subscription({ token, platform: 'ios', language: 'en', ...patch }), null);
});
test('messages localize with field fallback and do not send website or other-OS notices', () => {
  assert.equal(messageFor(base, { token, language: 'ta' }).title, 'தமிழ்');
  assert.equal(messageFor(base, { token, language: 'kn' }).title, 'English');
  assert.equal(messageFor({ ...base, body: 'x'.repeat(5000) }, { token }).body.length, 218);
  assert.deepEqual(messageFor(base, { token }).data, { announcementId: base.id });
  assert.equal(messageFor(base, { token }).priority, 'high', 'Android normal priority is held back in Doze');
  assert.equal(targets({ ...base, platforms: ['website'] }, 'ios'), false);
  assert.equal(targets({ ...base, mobilePlatforms: ['android'] }, 'ios'), false);
  assert.equal(targets(base, 'ios'), true);
});
function store() {
  const db = new DatabaseSync(':memory:');
  const sql = { exec(query, ...args) { const rows = db.prepare(query).all(...args); return { toArray: () => rows }; } };
  const ctx = { storage: { sql, transactionSync(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch(e) { db.exec('ROLLBACK'); throw e; } } } };
  return { db, sql, instance: new AnnouncementPushStore(ctx, {}) };
}
test('first deployment baselines old notices; new notices send once; unsubscribe removes queued work', async () => {
  const { instance, db, sql } = store();
  const original = globalThis.fetch; const originalNow = Date.now;
  let list = [base]; let sends = 0; let now = Date.parse('2026-10-31T15:00:00Z');
  Date.now = () => now;
  globalThis.fetch = async url => {
    if (String(url).includes('announcements.json')) return Response.json({ announcements: list });
    if (String(url).endsWith('/send')) { sends++; return Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] }); }
    return Response.json({ data: { 'ticket-1': { status: 'ok' } } });
  };
  try {
    await instance.fetch(new Request('https://internal/subscription', { method: 'POST', body: JSON.stringify({ token, platform:'ios', language:'ta' }) }));
    await instance.tick(); assert.equal(sends, 0, 'no historical blast');
    list = [{ ...base, id: '2026-10-31-new' }, base];
    await instance.tick(); assert.equal(sends, 1);
    await instance.tick(); assert.equal(sends, 1, 'same ID never requeues');
    now += 16 * 60000; await instance.tick();
    assert.equal(sql.exec('SELECT * FROM queue').toArray().length, 0, 'accepted receipt retired');
    await instance.fetch(new Request('https://internal/subscription', { method: 'DELETE', body: JSON.stringify({token}) }));
    assert.equal(sql.exec('SELECT * FROM subscribers').toArray().length, 0);
  } finally { globalThis.fetch = original; Date.now = originalNow; db.close(); }
});
test('registration API cannot trigger a broadcast and rejects disallowed origins', async () => {
  const env = { REGISTRATION_LIMIT: { limit: async () => ({ success:true }) } };
  assert.equal((await worker.fetch(new Request('https://example.org/_push/tick', {method:'POST'}), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://example.org/_push/subscription', {method:'POST',headers:{Origin:'https://evil.invalid'},body:'{}'}), env)).status,403);
  assert.equal((await worker.fetch(new Request('https://example.org/_push/subscription', {method:'POST',body:'{}'}),env)).status,400);
});
test('receipt DeviceNotRegistered deletes the subscription, and edit of existing ID does not resend', async () => {
  const { instance, db, sql } = store(); const original = globalThis.fetch; const originalNow = Date.now;
  let now = Date.parse('2026-10-31T15:00:00Z'); let list = [base]; let sends = 0;
  Date.now = () => now;
  globalThis.fetch = async url => {
    if (String(url).includes('announcements.json')) return Response.json({announcements:list});
    if (String(url).endsWith('/send')) { sends++; return Response.json({data:[{status:'ok',id:'invalid-ticket'}]}); }
    return Response.json({data:{'invalid-ticket':{status:'error',details:{error:'DeviceNotRegistered'}}}});
  };
  try {
    await instance.tick();
    await instance.fetch(new Request('https://internal/subscription',{method:'POST',body:JSON.stringify({token,platform:'ios',language:'en'})}));
    list=[{...base,body:'Edited old entry'}]; await instance.tick(); assert.equal(sends,0);
    list=[{...base,id:'new-id'},...list]; await instance.tick(); assert.equal(sends,1);
    now+=16*60000;await instance.tick();assert.equal(sql.exec('SELECT * FROM subscribers').toArray().length,0);
  } finally {globalThis.fetch=original;Date.now=originalNow;db.close();}
});

test('IST publication dates and explicit instants are globally deterministic', () => {
  const dateOnly = { date: '2026-11-01' };
  assert.equal(publicationInstant(dateOnly), Date.parse('2026-10-31T18:30:00Z'));
  assert.equal(eligibleForPush(dateOnly, Date.parse('2026-10-31T18:29:59Z')), false);
  assert.equal(eligibleForPush(dateOnly, Date.parse('2026-10-31T18:30:00Z')), true);
  assert.equal(eligibleForPush({ ...dateOnly, publishAt: '2026-11-01T09:15:00+05:30' }, Date.parse('2026-11-01T03:44:59Z')), false);
  assert.equal(eligibleForPush({ ...dateOnly, publishAt: '2026-11-01T09:15:00+05:30' }, Date.parse('2026-11-01T03:45:00Z')), true);
  assert.equal(eligibleForPush(dateOnly, Date.parse('2026-11-04T00:00:00Z')), false);
});

test('credential errors retry without using attempts, then deliver; status reports each platform', async () => {
  const { instance, db, sql } = store(); const original = globalThis.fetch; const originalNow = Date.now;
  let now = Date.parse('2026-11-04T15:00:00Z'); let list = [base]; let sends = 0; let broken = true;
  Date.now = () => now;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('announcements.json')) return Response.json({announcements:list});
    if (String(url).endsWith('/send')) {
      sends++;
      return Response.json({data: JSON.parse(init.body).map(() => broken
        ? {status:'error', message:'Unable to retrieve the FCM server key', details:{error:'InvalidCredentials'}}
        : {status:'ok', id:'t-'+sends})});
    }
    return Response.json({data: Object.fromEntries(JSON.parse(init.body).ids.map(id => [id, {status:'ok'}]))});
  };
  const status = async () => (await (await instance.fetch(new Request('https://internal/status'))).json()).delivery;
  try {
    await instance.tick();
    await instance.fetch(new Request('https://internal/subscription',{method:'POST',body:JSON.stringify({token,platform:'android',language:'en'})}));
    list=[{...base,id:'2026-11-04-ekadasi',date:'2026-11-04'},base];
    for (let i = 0; i < 8; i++) { await instance.tick(); now += 31*60000; }
    assert.equal(sends, 8, 'retried every 30 minutes');
    const [row] = sql.exec('SELECT * FROM queue').toArray();
    assert.equal(row.status, 'pending'); assert.equal(row.attempts, 0, 'credential failures do not use attempts');
    assert.equal((await status()).android.lastError, 'InvalidCredentials');
    broken = false; await instance.tick(); assert.equal(sends, 9);
    now += 16*60000; await instance.tick();
    assert.equal(sql.exec('SELECT * FROM queue').toArray().length, 0, 'delivered once credentials work');
    assert.ok((await status()).android.lastAcceptedAt);
  } finally {globalThis.fetch=original;Date.now=originalNow;db.close();}
});
test('retries stop once a notice is too old to be news, and device errors never retry', () => {
  const t = Date.parse('2026-11-04T15:00:00Z');
  assert.equal(retryable('InvalidCredentials', t, t + 11*3600000), true);
  assert.equal(retryable('InvalidCredentials', t, t + 12*3600000), false);
  assert.equal(retryable('MessageTooBig', t, t), false);
  assert.equal(retryable('DeviceNotRegistered', t, t), false);
});
test('public status reports delivery without tokens', async () => {
  const delivery = { android: { lastError: 'InvalidCredentials', lastErrorAt: '2026-11-04T15:00:00.000Z' } };
  const env = { PUSH_STORE: { idFromName: () => 'id', get: () => ({ fetch: async () => Response.json({ delivery }) }) } };
  const r = await (await worker.fetch(new Request('https://example.org/_push/status'), env)).json();
  assert.deepEqual(r, { available: true, delivery });
  const down = { PUSH_STORE: { idFromName: () => 'id', get: () => ({ fetch: async () => { throw new Error('x'); } }) } };
  assert.deepEqual(await (await worker.fetch(new Request('https://example.org/_push/status'), down)).json(), { available: true, delivery: {} });
});
