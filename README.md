<p align="center">
  <a href="https://tareef.g4t.io">
    <img src="https://github.com/hussein4alaa/tareef-laravel/raw/main/banner.png" alt="Tareef — Face recognition API" width="100%">
  </a>
</p>

# @g4t/tareef — Node.js SDK

Official Node.js / TypeScript SDK for the **Tareef** face recognition API. A thin,
typed wrapper over the REST endpoints — multipart uploads, JSON responses, bearer
auth, and typed errors.

- Zero dependencies (uses the built-in `fetch`/`FormData`/`Blob`)
- Works in Node **18+**, ESM
- Ships TypeScript types
- Flexible image inputs: file path, `Buffer`, `Blob`/`File`, or raw bytes

## Install

```bash
npm install @g4t/tareef
```

## Quick start

```js
import { TareefClient } from '@g4t/tareef';

const tareef = new TareefClient({
  apiKey: process.env.TAREEF_API_KEY,   // frs_live_…
  // baseUrl defaults to http://tareef.g4t.io — pass it only to point elsewhere
});

// Enroll
const person = await tareef.register({
  name: 'Jane Doe',
  phone: '+15555550123',
  images: ['./jane-1.jpg', './jane-2.jpg'],
});

// Verify
const result = await tareef.verify('./selfie.jpg');
if (result.success) {
  console.log(result.name, result.score); // lower score = closer match
}
```

`apiKey` falls back to `TAREEF_API_KEY` and `baseUrl` to `TAREEF_BASE_URL`, so
`new TareefClient()` works when the key is in the environment. Only `apiKey` is
required — `baseUrl` defaults to the hosted instance.

## Configuration

```js
new TareefClient({
  apiKey: 'frs_live_…',            // required (or TAREEF_BASE_URL/TAREEF_API_KEY env)
  baseUrl: 'http://tareef.g4t.io', // default; the /api/v1 prefix is added for you
  apiVersion: 'v1',                // default
  timeoutMs: 30000,                // default
  fetch: customFetch,              // optional override
});
```

## Image inputs

Every method that takes an image accepts any of:

```js
'./photo.jpg'                                   // filesystem path
await fs.readFile('./photo.jpg')                // Buffer / Uint8Array
new Blob([bytes], { type: 'image/jpeg' })       // Blob / File
{ data: bytes, filename: 'photo.jpg', contentType: 'image/jpeg' }
```

## API

| Method | Description |
|--------|-------------|
| `register({ name, phone?, images })` | Enroll a person from one or more photos. |
| `verify(image)` | Identify a face against your library. |
| `addImages(personUuid, images)` | Add more reference photos to a person. |
| `listPeople({ limit? })` | List enrolled people. |
| `getPerson(personUuid)` | Fetch one person. |
| `deletePerson(personUuid)` | Delete a person and their embeddings. |
| `health()` | Service health check. |

All methods return the parsed JSON response.

### Reading a verify result

`score` is a cosine distance — **lower is closer**. `success` is `true` on a match.

```js
const r = await tareef.verify('./selfie.jpg');
// { success: true, status: 'ok', uuid, name, distance, score, samples }
// or { success: false, status: 'not_identical' | 'no_data' | 'no_face', uuid: null }
```

## Errors

Failures throw a `TareefError` (or a subclass). Business outcomes that the API
returns with `200` (like "no match" on verify) do **not** throw.

```js
import {
  TareefError,
  AuthenticationError,    // 401 — bad/revoked key
  QuotaExceededError,     // 429 — monthly verify quota hit
  ValidationError,        // 422 — malformed request
  NoFaceDetectedError,    // 422 no_face
  FaceAlreadyExistsError, // 422 face_exists (has .uuid of the match)
  ServiceUnavailableError // 5xx / network / timeout
} from '@g4t/tareef';

try {
  await tareef.register({ name: 'Jane', images: ['./jane.jpg'] });
} catch (e) {
  if (e instanceof FaceAlreadyExistsError) {
    console.log('Already enrolled as', e.uuid);
  } else if (e instanceof NoFaceDetectedError) {
    console.log('No face in the photo.');
  } else if (e instanceof TareefError) {
    console.error(e.status, e.code, e.message);
  } else {
    throw e;
  }
}
```

Every `TareefError` carries `.status` (HTTP), `.code` (the API's `status` string),
and `.body` (the parsed response).

## CommonJS

The package is ESM-only. From CommonJS, use a dynamic import:

```js
const { TareefClient } = await import('@g4t/tareef');
```

## License

MIT
