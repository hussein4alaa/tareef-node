import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TareefClient,
  FaceAlreadyExistsError,
  AuthenticationError,
  QuotaExceededError,
  NoFaceDetectedError,
  TareefError,
} from '../src/index.js';

/** A fetch stub that records the last call and returns a canned response. */
function stubFetch(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() {
        return JSON.stringify(body);
      },
    };
  };
  fn.calls = calls;
  return fn;
}

test('requires an apiKey', () => {
  assert.throws(() => new TareefClient({ baseUrl: 'https://x' }), TareefError);
});

test('defaults to the hosted base url when none is given', () => {
  const c = new TareefClient({ apiKey: 'k' });
  assert.equal(c.baseUrl, 'http://tareef.g4t.io/api/v1');
});

test('builds the /api/v1 base url and trims slashes', () => {
  const c = new TareefClient({ apiKey: 'k', baseUrl: 'https://x/', fetch: stubFetch(200, {}) });
  assert.equal(c.baseUrl, 'https://x/api/v1');
});

test('verify returns the parsed body and sends a bearer token', async () => {
  const fetch = stubFetch(200, { success: true, status: 'ok', uuid: 'u1', score: 0.12 });
  const c = new TareefClient({ apiKey: 'secret', baseUrl: 'https://x', fetch });
  const r = await c.verify(new Uint8Array([1, 2, 3]));
  assert.equal(r.uuid, 'u1');
  assert.equal(r.success, true);
  assert.match(fetch.calls[0].url, /\/api\/v1\/verify$/);
  assert.equal(fetch.calls[0].init.headers.Authorization, 'Bearer secret');
});

test('compare posts to /compare and returns the match result', async () => {
  const fetch = stubFetch(200, { success: true, match: true, distance: 0.21, similarity: 0.79 });
  const c = new TareefClient({ apiKey: 'k', baseUrl: 'https://x', fetch });
  const r = await c.compare(new Uint8Array([1]), new Uint8Array([2]));
  assert.equal(r.match, true);
  assert.equal(r.similarity, 0.79);
  assert.match(fetch.calls[0].url, /\/api\/v1\/compare$/);
});

test('face_exists -> FaceAlreadyExistsError carrying the uuid', async () => {
  const c = new TareefClient({
    apiKey: 'k',
    baseUrl: 'https://x',
    fetch: stubFetch(422, { success: false, status: 'face_exists', uuid: 'dup-uuid' }),
  });
  await assert.rejects(
    () => c.register({ name: 'Jane', images: [new Uint8Array([1])] }),
    (e) => e instanceof FaceAlreadyExistsError && e.uuid === 'dup-uuid' && e.status === 422,
  );
});

test('no_face -> NoFaceDetectedError', async () => {
  const c = new TareefClient({
    apiKey: 'k',
    baseUrl: 'https://x',
    fetch: stubFetch(422, { success: false, status: 'no_face' }),
  });
  await assert.rejects(() => c.register({ name: 'Jane', images: [new Uint8Array([1])] }), NoFaceDetectedError);
});

test('401 -> AuthenticationError, 429 -> QuotaExceededError', async () => {
  const auth = new TareefClient({ apiKey: 'k', baseUrl: 'https://x', fetch: stubFetch(401, { message: 'Invalid key' }) });
  await assert.rejects(() => auth.health(), AuthenticationError);

  const quota = new TareefClient({ apiKey: 'k', baseUrl: 'https://x', fetch: stubFetch(429, { status: 'quota_exceeded' }) });
  await assert.rejects(() => quota.verify(new Uint8Array([1])), QuotaExceededError);
});

test('listPeople passes the limit query param', async () => {
  const fetch = stubFetch(200, { people: [] });
  const c = new TareefClient({ apiKey: 'k', baseUrl: 'https://x', fetch });
  await c.listPeople({ limit: 25 });
  assert.match(fetch.calls[0].url, /\/api\/v1\/people\?limit=25$/);
});
