import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

function isBytes(v) {
  return v instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(v));
}

/**
 * Coerce a flexible image input into a Blob + filename suitable for FormData.
 *
 * Accepts:
 *   - string                          → a filesystem path (read from disk)
 *   - Buffer / Uint8Array             → raw image bytes
 *   - Blob / File                     → used directly
 *   - { data, filename?, contentType? } → bytes or Blob with an explicit name
 *
 * @param {import('../types/index.js').ImageInput} input
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function toBlobPart(input) {
  if (input == null) {
    throw new TypeError('An image input is required.');
  }

  if (typeof input === 'string') {
    const buf = await readFile(input);
    const filename = basename(input) || 'image.jpg';
    const type = MIME[extname(input).toLowerCase()] || 'application/octet-stream';
    return { blob: new Blob([buf], { type }), filename };
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return { blob: input, filename: input.name || 'image.jpg' };
  }

  if (isBytes(input)) {
    return { blob: new Blob([input]), filename: 'image.jpg' };
  }

  if (typeof input === 'object' && 'data' in input) {
    const { data, filename = 'image.jpg', contentType } = input;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      return { blob: data, filename };
    }
    if (isBytes(data)) {
      return { blob: new Blob([data], contentType ? { type: contentType } : undefined), filename };
    }
  }

  throw new TypeError(
    'Unsupported image input. Use a file path, Buffer/Uint8Array, Blob, or { data, filename }.',
  );
}
