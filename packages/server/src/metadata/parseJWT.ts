import { isoBase64URL } from '../helpers/iso/index.ts';

/**
 * Process a JWT into Javascript-friendly data structures
 */
export function parseJWT<T1, T2>(jwt: string): [T1, T2, string] {
  const parts = jwt.split('.');
  return [
    JSON.parse(isoBase64URL.toUTF8String(parts[0])) as T1,
    JSON.parse(isoBase64URL.toUTF8String(parts[1])) as T2,
    parts[2],
  ];
}
