// Type definitions for the Tareef Node.js SDK.

export interface TareefOptions {
  /** API key. Falls back to `process.env.TAREEF_API_KEY`. */
  apiKey?: string;
  /** Server root. Falls back to `process.env.TAREEF_BASE_URL`, then defaults to `http://tareef.g4t.io`. The `/api/<version>` prefix is added for you. */
  baseUrl?: string;
  /** API version segment. Defaults to `"v1"`. */
  apiVersion?: string;
  /** Per-request timeout in milliseconds. Defaults to `30000`. */
  timeoutMs?: number;
  /** Custom fetch implementation. Defaults to the global `fetch` (Node 18+). */
  fetch?: typeof fetch;
}

/** Anything the SDK can turn into an uploaded image. */
export type ImageInput =
  | string
  | Uint8Array
  | Blob
  | { data: Uint8Array | Blob; filename?: string; contentType?: string };

export interface RegisterParams {
  name: string;
  phone?: string;
  images: ImageInput | ImageInput[];
}

export interface VerifyResult {
  success: boolean;
  status: string;
  uuid: string | null;
  name?: string;
  phone?: string;
  /** Best single-image cosine distance (lower is closer). */
  distance?: number;
  /** Aggregated match score (lower is closer). */
  score?: number;
  /** How many of the person's images supported the match. */
  samples?: number;
  [key: string]: unknown;
}

export interface CompareResult {
  success: boolean;
  status: string;
  /** True when the two faces are the same person (per the app's threshold). */
  match: boolean | null;
  /** Cosine distance (lower = closer). */
  distance?: number;
  /** 1 − distance (1.0 = identical). */
  similarity?: number;
  /** The threshold the match decision used. */
  threshold?: number;
  [key: string]: unknown;
}

export interface RegisterResult {
  success: boolean;
  status: string;
  uuid: string | null;
  images_registered?: number;
  images_skipped?: number;
  [key: string]: unknown;
}

export interface Person {
  uuid: string;
  name: string;
  phone?: string | null;
  image_count?: number;
  images?: string[];
  [key: string]: unknown;
}

export interface ListPeopleResult {
  people?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface TareefErrorOptions {
  status?: number;
  code?: string;
  body?: unknown;
  cause?: unknown;
}

export class TareefError extends Error {
  status?: number;
  code?: string;
  body?: unknown;
  constructor(message: string, options?: TareefErrorOptions);
}

export class AuthenticationError extends TareefError {}
export class QuotaExceededError extends TareefError {}
export class ValidationError extends TareefError {}
export class NoFaceDetectedError extends TareefError {}
export class FaceAlreadyExistsError extends TareefError {
  /** UUID of the already-enrolled person. */
  uuid: string | null;
}
export class ServiceUnavailableError extends TareefError {}

export function errorFromResponse(status: number, body: unknown): TareefError;

export class TareefClient {
  readonly baseUrl: string;
  constructor(options?: TareefOptions);
  register(params: RegisterParams): Promise<RegisterResult>;
  verify(image: ImageInput): Promise<VerifyResult>;
  compare(imageA: ImageInput, imageB: ImageInput): Promise<CompareResult>;
  addImages(personUuid: string, images: ImageInput | ImageInput[]): Promise<Record<string, unknown>>;
  listPeople(params?: { limit?: number }): Promise<ListPeopleResult>;
  getPerson(personUuid: string): Promise<Person>;
  deletePerson(personUuid: string): Promise<Record<string, unknown>>;
  health(): Promise<{ status: string }>;
}

export function createClient(options?: TareefOptions): TareefClient;
export function toBlobPart(input: ImageInput): Promise<{ blob: Blob; filename: string }>;
