import { assertEquals } from 'https://deno.land/std@0.198.0/assert/mod.ts';

import { InvalidBackupFlags, parseBackupFlags } from './parseBackupFlags.ts';
import { assertThrows } from 'https://deno.land/std@0.198.0/assert/assert_throws.ts';

Deno.test('should return single-device cred, not backed up', () => {
  const parsed = parseBackupFlags({ be: false, bs: false });

  assertEquals(parsed.credentialDeviceType, 'singleDevice');
  assertEquals(parsed.credentialBackedUp, false);
});

Deno.test('should throw on single-device cred, backed up', () => {
  assertThrows(
    () => parseBackupFlags({ be: false, bs: true }),
    InvalidBackupFlags,
    'impossible',
  );
});

Deno.test('should return multi-device cred, not backed up', () => {
  const parsed = parseBackupFlags({ be: true, bs: false });

  assertEquals(parsed.credentialDeviceType, 'multiDevice');
  assertEquals(parsed.credentialBackedUp, false);
});

Deno.test('should return multi-device cred, backed up', () => {
  const parsed = parseBackupFlags({ be: true, bs: true });

  assertEquals(parsed.credentialDeviceType, 'multiDevice');
  assertEquals(parsed.credentialBackedUp, true);
});
