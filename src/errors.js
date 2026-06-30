/**
 * Error hierarchy for the Tareef SDK.
 *
 * Every failure surfaces as a {@link TareefError} (or a subclass). Catch the
 * base class to handle everything, or a specific subclass when you care about
 * a particular failure mode (auth, quota, duplicate face, …).
 */

export class TareefError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, body?: unknown, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'TareefError';
    /** HTTP status code, when the failure came from a response. */
    this.status = options.status;
    /** The API's stable `status` string (e.g. "face_exists"), when present. */
    this.code = options.code;
    /** The parsed response body, when available. */
    this.body = options.body;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** 401 — missing or revoked API key. */
export class AuthenticationError extends TareefError {
  constructor(m, o) { super(m, o); this.name = 'AuthenticationError'; }
}

/** 429 — monthly verification quota reached. */
export class QuotaExceededError extends TareefError {
  constructor(m, o) { super(m, o); this.name = 'QuotaExceededError'; }
}

/** 422 — request body was malformed or missing required fields. */
export class ValidationError extends TareefError {
  constructor(m, o) { super(m, o); this.name = 'ValidationError'; }
}

/** 422 `no_face` — no detectable face in the supplied image(s). */
export class NoFaceDetectedError extends TareefError {
  constructor(m, o) { super(m, o); this.name = 'NoFaceDetectedError'; }
}

/** 422 `face_exists` — the face is already enrolled. `uuid` holds the match. */
export class FaceAlreadyExistsError extends TareefError {
  constructor(m, o = {}) {
    super(m, o);
    this.name = 'FaceAlreadyExistsError';
    this.uuid = (o.body && typeof o.body === 'object' ? o.body.uuid : null) ?? null;
  }
}

/** 5xx / transport — the service was unreachable or errored. */
export class ServiceUnavailableError extends TareefError {
  constructor(m, o) { super(m, o); this.name = 'ServiceUnavailableError'; }
}

/**
 * Map an HTTP status + parsed body to the most specific error class.
 * @param {number} status
 * @param {any} body
 * @returns {TareefError}
 */
export function errorFromResponse(status, body) {
  const code =
    body && typeof body === 'object' && 'status' in body ? String(body.status) : undefined;
  const message =
    body && typeof body === 'object' && body.message
      ? String(body.message)
      : code ?? `Tareef request failed (HTTP ${status}).`;
  const options = { status, code, body };

  if (status === 401) return new AuthenticationError(message, options);
  if (status === 429) return new QuotaExceededError(message, options);
  if (status >= 500) return new ServiceUnavailableError(message, options);
  if (code === 'face_exists') return new FaceAlreadyExistsError(message, options);
  if (code === 'no_face') return new NoFaceDetectedError(message, options);
  if (status === 422) return new ValidationError(message, options);
  return new TareefError(message, options);
}
