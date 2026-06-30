import { errorFromResponse, ServiceUnavailableError, TareefError } from './errors.js';
import { toBlobPart } from './files.js';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_BASE_URL = 'http://tareef.g4t.io';

/**
 * Client for the Tareef face recognition REST API.
 *
 * @example
 * const tareef = new TareefClient({
 *   apiKey: process.env.TAREEF_API_KEY,
 *   baseUrl: 'https://your-tareef-host',
 * });
 * const result = await tareef.verify('./selfie.jpg');
 */
export class TareefClient {
  /**
   * @param {import('../types/index.js').TareefOptions} [options]
   */
  constructor(options = {}) {
    const apiKey = options.apiKey ?? process.env.TAREEF_API_KEY ?? '';
    // Defaults to the hosted Tareef instance; override with { baseUrl } or TAREEF_BASE_URL.
    const root = String(options.baseUrl ?? process.env.TAREEF_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

    if (!apiKey) {
      throw new TareefError('An apiKey is required (pass { apiKey } or set TAREEF_API_KEY).');
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new TareefError('No global fetch found. Use Node 18+, or pass { fetch }.');
    }

    /** @private */ this.apiKey = apiKey;
    /** Base URL including the versioned API prefix, e.g. https://host/api/v1 */
    this.baseUrl = `${root}/api/${options.apiVersion ?? 'v1'}`;
    /** @private */ this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    /** @private */ this._fetch = fetchImpl;
  }

  /**
   * Enroll a new person from one or more reference photos.
   * @param {import('../types/index.js').RegisterParams} params
   * @returns {Promise<import('../types/index.js').RegisterResult>}
   */
  async register({ name, phone, images } = {}) {
    if (!name) throw new TareefError('register: `name` is required.');
    const list = Array.isArray(images) ? images : images != null ? [images] : [];
    if (list.length === 0) throw new TareefError('register: at least one image is required.');

    const form = new FormData();
    form.append('type', 'file');
    form.append('name', name);
    form.append('phone', phone ?? '');
    await this._appendImages(form, list);

    return this._request('POST', '/people', { form });
  }

  /**
   * Identify a face against your enrolled library.
   * @param {import('../types/index.js').ImageInput} image
   * @returns {Promise<import('../types/index.js').VerifyResult>}
   */
  async verify(image) {
    const form = new FormData();
    form.append('type', 'file');
    const { blob, filename } = await toBlobPart(image);
    form.append('file', blob, filename);

    return this._request('POST', '/verify', { form });
  }

  /**
   * Compare two faces directly (1:1) — how similar are these two images?
   * No enrolment, no library lookup. Great for KYC (selfie vs ID photo).
   * @param {import('../types/index.js').ImageInput} imageA
   * @param {import('../types/index.js').ImageInput} imageB
   * @returns {Promise<import('../types/index.js').CompareResult>}
   */
  async compare(imageA, imageB) {
    const form = new FormData();
    form.append('type', 'file');
    const a = await toBlobPart(imageA);
    const b = await toBlobPart(imageB);
    form.append('file1', a.blob, a.filename);
    form.append('file2', b.blob, b.filename);

    return this._request('POST', '/compare', { form });
  }

  /**
   * Attach more reference photos to an existing person.
   * @param {string} personUuid
   * @param {import('../types/index.js').ImageInput | import('../types/index.js').ImageInput[]} images
   * @returns {Promise<Record<string, unknown>>}
   */
  async addImages(personUuid, images) {
    if (!personUuid) throw new TareefError('addImages: `personUuid` is required.');
    const list = Array.isArray(images) ? images : images != null ? [images] : [];
    if (list.length === 0) throw new TareefError('addImages: at least one image is required.');

    const form = new FormData();
    form.append('type', 'file');
    await this._appendImages(form, list);

    return this._request('POST', `/people/${encodeURIComponent(personUuid)}/images`, { form });
  }

  /**
   * List enrolled people (newest first).
   * @param {{ limit?: number }} [params]
   * @returns {Promise<import('../types/index.js').ListPeopleResult>}
   */
  listPeople({ limit } = {}) {
    return this._request('GET', '/people', { query: { limit } });
  }

  /**
   * Fetch a single person record.
   * @param {string} personUuid
   * @returns {Promise<import('../types/index.js').Person>}
   */
  getPerson(personUuid) {
    if (!personUuid) throw new TareefError('getPerson: `personUuid` is required.');
    return this._request('GET', `/people/${encodeURIComponent(personUuid)}`);
  }

  /**
   * Permanently delete a person and their embeddings.
   * @param {string} personUuid
   * @returns {Promise<Record<string, unknown>>}
   */
  deletePerson(personUuid) {
    if (!personUuid) throw new TareefError('deletePerson: `personUuid` is required.');
    return this._request('DELETE', `/people/${encodeURIComponent(personUuid)}`);
  }

  /**
   * Service health check.
   * @returns {Promise<{ status: string }>}
   */
  health() {
    return this._request('GET', '/health');
  }

  /**
   * @private
   * @param {FormData} form
   * @param {import('../types/index.js').ImageInput[]} images
   */
  async _appendImages(form, images) {
    for (let i = 0; i < images.length; i++) {
      const { blob, filename } = await toBlobPart(images[i]);
      // The API accepts the first image under `file` and any extras under
      // `files` — repeating `files` is also fine, but this matches the
      // single + multi shape the server documents.
      form.append(i === 0 ? 'file' : 'files', blob, filename);
    }
  }

  /**
   * @private
   * @template T
   * @param {string} method
   * @param {string} path
   * @param {{ form?: FormData, query?: Record<string, string | number | undefined | null> }} [opts]
   * @returns {Promise<T>}
   */
  async _request(method, path, { form, query } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await this._fetch(url, {
        method,
        // Note: don't set Content-Type for FormData — fetch adds the
        // multipart boundary automatically.
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new TareefError(`Request timed out after ${this.timeoutMs}ms.`, { code: 'timeout', cause: err });
      }
      throw new ServiceUnavailableError('Could not reach the Tareef API.', { cause: err });
    } finally {
      clearTimeout(timer);
    }

    let body = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    if (!res.ok) throw errorFromResponse(res.status, body);
    return body;
  }
}

/**
 * Convenience factory.
 * @param {import('../types/index.js').TareefOptions} [options]
 * @returns {TareefClient}
 */
export function createClient(options) {
  return new TareefClient(options);
}
