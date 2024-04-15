import { COSEALG } from './cose.ts';
import { isoCrypto, isoUint8Array } from './iso/index.ts';

/**
 * Returns hash digest of the given data, using the given algorithm when provided. Defaults to using
 * SHA-256.
 */
export function toHash(
  data: Uint8Array | string,
  algorithm: COSEALG = -7,
): Promise<Uint8Array> {
  if (typeof data === 'string') {
    data = isoUint8Array.fromUTF8String(data);
  }

  const digest = isoCrypto.digest(data, algorithm);

  return digest;
}
