export { TareefClient, createClient } from './client.js';
export { toBlobPart } from './files.js';
export {
  TareefError,
  AuthenticationError,
  QuotaExceededError,
  ValidationError,
  NoFaceDetectedError,
  FaceAlreadyExistsError,
  ServiceUnavailableError,
  errorFromResponse,
} from './errors.js';
