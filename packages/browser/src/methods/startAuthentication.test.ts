import {
  AuthenticationCredential,
  AuthenticationExtensionsClientInputs,
  AuthenticationExtensionsClientOutputs,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

import { browserSupportsWebAuthn } from '../helpers/browserSupportsWebAuthn';
import { browserSupportsWebAuthnAutofill } from '../helpers/browserSupportsWebAuthnAutofill';
import { base64URLStringToBuffer } from '../helpers/base64URLStringToBuffer';
import { bufferToBase64URLString } from '../helpers/bufferToBase64URLString';
import { WebAuthnError } from '../helpers/webAuthnError';
import { generateCustomError } from '../helpers/__jest__/generateCustomError';
import { WebAuthnAbortService } from '../helpers/webAuthnAbortService';

import { startAuthentication } from './startAuthentication';

jest.mock('../helpers/browserSupportsWebAuthn');
jest.mock('../helpers/browserSupportsWebAuthnAutofill');

const mockNavigatorGet = window.navigator.credentials.get as jest.Mock;
const mockSupportsWebAuthn = browserSupportsWebAuthn as jest.Mock;
const mockSupportsAutofill = browserSupportsWebAuthnAutofill as jest.Mock;

const mockAuthenticatorData = 'mockAuthenticatorData';
const mockClientDataJSON = 'mockClientDataJSON';
const mockSignature = 'mockSignature';
const mockUserHandle = 'f4pdy3fpA34';

// With ASCII challenge
const goodOpts1: PublicKeyCredentialRequestOptionsJSON = {
  challenge: '1T6uHri4OAQ',
  allowCredentials: [
    {
      id: 'C0VGlvYFratUdAV1iCw-ULpUW8E-exHPXQChBfyVeJZCMfjMFcwDmOFgoMUz39LoMtCJUBW8WPlLkGT6q8qTCg',
      type: 'public-key',
      transports: ['nfc'],
    },
  ],
  timeout: 1,
};

// With UTF-8 challenge
const goodOpts2UTF8: PublicKeyCredentialRequestOptionsJSON = {
  challenge: bufferToBase64URLString(new TextEncoder().encode('やれやれだぜ')),
  allowCredentials: [],
  timeout: 1,
};

beforeEach(() => {
  // Stub out a response so the method won't throw
  mockNavigatorGet.mockImplementation((): Promise<unknown> => {
    return new Promise((resolve) => {
      resolve({
        response: {},
        getClientExtensionResults: () => ({}),
      });
    });
  });

  mockSupportsWebAuthn.mockReturnValue(true);
  mockSupportsAutofill.mockResolvedValue(true);

  // Reset the abort service so we get an accurate call count
  WebAuthnAbortService.cancelCeremony();
});

afterEach(() => {
  mockNavigatorGet.mockReset();
  mockSupportsWebAuthn.mockReset();
  mockSupportsAutofill.mockReset();
});

test('should convert options before passing to navigator.credentials.get(...)', async () => {
  await startAuthentication(goodOpts1);

  const argsPublicKey = mockNavigatorGet.mock.calls[0][0].publicKey;
  const credId = argsPublicKey.allowCredentials[0].id;

  expect(new Uint8Array(argsPublicKey.challenge)).toEqual(
    new Uint8Array([213, 62, 174, 30, 184, 184, 56, 4]),
  );
  // Make sure the credential ID is an ArrayBuffer with a length of 64
  expect(credId instanceof ArrayBuffer).toEqual(true);
  expect(credId.byteLength).toEqual(64);
});

test('should support optional allowCredential', async () => {
  await startAuthentication({
    challenge: '1T6uHri4OAQ',
    timeout: 1,
  });

  expect(mockNavigatorGet.mock.calls[0][0].allowCredentials).toEqual(undefined);
});

test('should convert allow allowCredential to undefined when empty', async () => {
  await startAuthentication({
    challenge: '1T6uHri4OAQ',
    timeout: 1,
    allowCredentials: [],
  });
  expect(mockNavigatorGet.mock.calls[0][0].allowCredentials).toEqual(undefined);
});

test('should return base64url-encoded response values', async () => {
  mockNavigatorGet.mockImplementation((): Promise<AuthenticationCredential> => {
    return new Promise((resolve) => {
      resolve({
        id: 'foobar',
        rawId: Buffer.from('foobar', 'ascii'),
        response: {
          authenticatorData: Buffer.from(mockAuthenticatorData, 'ascii'),
          clientDataJSON: Buffer.from(mockClientDataJSON, 'ascii'),
          signature: Buffer.from(mockSignature, 'ascii'),
          userHandle: base64URLStringToBuffer(mockUserHandle),
        },
        getClientExtensionResults: () => ({}),
        type: 'public-key',
        authenticatorAttachment: '',
      });
    });
  });

  const response = await startAuthentication(goodOpts1);

  expect(response.rawId).toEqual('Zm9vYmFy');
  expect(response.response.authenticatorData).toEqual(
    'bW9ja0F1dGhlbnRpY2F0b3JEYXRh',
  );
  expect(response.response.clientDataJSON).toEqual('bW9ja0NsaWVudERhdGFKU09O');
  expect(response.response.signature).toEqual('bW9ja1NpZ25hdHVyZQ');
  expect(response.response.userHandle).toEqual('f4pdy3fpA34');
});

test("should throw error if WebAuthn isn't supported", async () => {
  mockSupportsWebAuthn.mockReturnValue(false);

  await expect(startAuthentication(goodOpts1)).rejects.toThrow(
    'WebAuthn is not supported in this browser',
  );
});

test('should throw error if assertion is cancelled for some reason', async () => {
  mockNavigatorGet.mockImplementation((): Promise<null> => {
    return new Promise((resolve) => {
      resolve(null);
    });
  });

  await expect(startAuthentication(goodOpts1)).rejects.toThrow(
    'Authentication was not completed',
  );
});

test('should handle UTF-8 challenges', async () => {
  await startAuthentication(goodOpts2UTF8);

  const argsPublicKey = mockNavigatorGet.mock.calls[0][0].publicKey;

  expect(new Uint8Array(argsPublicKey.challenge)).toEqual(
    new Uint8Array([
      227,
      130,
      132,
      227,
      130,
      140,
      227,
      130,
      132,
      227,
      130,
      140,
      227,
      129,
      160,
      227,
      129,
      156,
    ]),
  );
});

test('should send extensions to authenticator if present in options', async () => {
  const extensions: AuthenticationExtensionsClientInputs = {
    credProps: true,
    appid: 'appidHere',
    // @ts-ignore: Send arbitrary extensions
    uvm: true,
    // @ts-ignore: Send arbitrary extensions
    appidExclude: 'appidExcludeHere',
  };
  const optsWithExts: PublicKeyCredentialRequestOptionsJSON = {
    ...goodOpts1,
    extensions,
  };
  await startAuthentication(optsWithExts);

  const argsExtensions = mockNavigatorGet.mock.calls[0][0].publicKey.extensions;

  expect(argsExtensions).toEqual(extensions);
});

test('should not set any extensions if not present in options', async () => {
  await startAuthentication(goodOpts1);

  const argsExtensions = mockNavigatorGet.mock.calls[0][0].publicKey.extensions;

  expect(argsExtensions).toEqual(undefined);
});

test('should include extension results', async () => {
  const extResults: AuthenticationExtensionsClientOutputs = {
    appid: true,
    credProps: {
      rk: true,
    },
  };

  // Mock extension return values from authenticator
  mockNavigatorGet.mockImplementation((): Promise<unknown> => {
    return new Promise((resolve) => {
      resolve({ response: {}, getClientExtensionResults: () => extResults });
    });
  });

  // Extensions aren't present in this object, but it doesn't matter since we're faking the response
  const response = await startAuthentication(goodOpts1);

  expect(response.clientExtensionResults).toEqual(extResults);
});

test('should include extension results when no extensions specified', async () => {
  const response = await startAuthentication(goodOpts1);

  expect(response.clientExtensionResults).toEqual({});
});

test('should support "cable" transport', async () => {
  const opts: PublicKeyCredentialRequestOptionsJSON = {
    ...goodOpts1,
    allowCredentials: [
      {
        ...goodOpts1.allowCredentials![0],
        transports: ['cable'],
      },
    ],
  };

  await startAuthentication(opts);

  expect(
    mockNavigatorGet.mock.calls[0][0].publicKey.allowCredentials[0]
      .transports[0],
  ).toEqual(
    'cable',
  );
});

test('should cancel an existing call when executed again', async () => {
  const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

  // Fire off a request and immediately attempt a second one
  startAuthentication(goodOpts1);
  await startAuthentication(goodOpts1);
  expect(abortSpy).toHaveBeenCalledTimes(1);
});

test('should set up autofill a.k.a. Conditional UI', async () => {
  const opts: PublicKeyCredentialRequestOptionsJSON = {
    ...goodOpts1,
    allowCredentials: [
      {
        ...goodOpts1.allowCredentials![0],
        transports: ['cable'],
      },
    ],
  };
  document.body.innerHTML = `
    <form>
      <label for="username">Username</label>
      <input type="text" name="username" autocomplete="username webauthn" />
      <button type="submit">Submit</button>
    </form>
  `;

  await startAuthentication(opts, true);

  // The most important bit
  expect(mockNavigatorGet.mock.calls[0][0].mediation).toEqual('conditional');
  // The latest version of https://github.com/w3c/webauthn/pull/1576 says allowCredentials should
  // be an "empty list", as opposed to being undefined
  expect(mockNavigatorGet.mock.calls[0][0].publicKey.allowCredentials)
    .toBeDefined();
  expect(mockNavigatorGet.mock.calls[0][0].publicKey.allowCredentials.length)
    .toEqual(0);
});

test('should set up conditional UI if "webauthn" is the only autocomplete token', async () => {
  /**
   * According to WHATWG "webauthn" can be the only token in the autocomplete attribute:
   * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens
   */
  document.body.innerHTML = `
    <form>
      <label for="username">Username</label>
      <input type="text" name="username" autocomplete="webauthn" />
      <button type="submit">Submit</button>
    </form>
  `;

  await expect(startAuthentication(goodOpts1, true)).resolves;
});

test('should throw error if autofill not supported', async () => {
  mockSupportsAutofill.mockResolvedValue(false);

  const rejected = await expect(startAuthentication(goodOpts1, true)).rejects;
  rejected.toThrow(Error);
  rejected.toThrow(/does not support webauthn autofill/i);
});

test('should throw error if no acceptable <input> is found', async () => {
  // <input> is missing "webauthn" from the autocomplete attribute
  document.body.innerHTML = `
    <form>
      <label for="username">Username</label>
      <input type="text" name="username" autocomplete="username" />
      <button type="submit">Submit</button>
    </form>
  `;

  const rejected = await expect(startAuthentication(goodOpts1, true)).rejects;
  rejected.toThrow(Error);
  rejected.toThrow(/no <input>/i);
});

test('should throw error if "webauthn" is not final autocomplete token', async () => {
  /**
   * According to WHATWG "webauthn" must be the final token in the autocomplete attribute when
   * multiple tokens are present:
   * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens
   */
  document.body.innerHTML = `
    <form>
      <label for="username">Username</label>
      <input type="text" name="username" autocomplete="webauthn username" />
      <button type="submit">Submit</button>
    </form>
  `;

  const rejected = await expect(startAuthentication(goodOpts1, true)).rejects;
  rejected.toThrow(Error);
  rejected.toThrow(/no <input>/i);
});

test('should return authenticatorAttachment if present', async () => {
  // Mock extension return values from authenticator
  mockNavigatorGet.mockImplementation((): Promise<unknown> => {
    return new Promise((resolve) => {
      resolve({
        response: {},
        getClientExtensionResults: () => {},
        authenticatorAttachment: 'cross-platform',
      });
    });
  });

  const response = await startAuthentication(goodOpts1);

  expect(response.authenticatorAttachment).toEqual('cross-platform');
});

describe('WebAuthnError', () => {
  describe('AbortError', () => {
    const AbortError = generateCustomError('AbortError');

    /**
     * We can't actually test this because nothing in startAuthentication() propagates the abort
     * signal. But if you invoked WebAuthn via this and then manually sent an abort signal I guess
     * this will catch.
     *
     * As a matter of fact I couldn't actually get any browser to respect the abort signal...
     */
    test.skip('should identify abort signal', async () => {
      mockNavigatorGet.mockRejectedValueOnce(AbortError);

      const rejected = await expect(startAuthentication(goodOpts1)).rejects;
      rejected.toThrow(WebAuthnError);
      rejected.toThrow(/abort signal/i);
      rejected.toHaveProperty('name', 'AbortError');
      rejected.toHaveProperty('code', 'ERROR_CEREMONY_ABORTED');
      rejected.toHaveProperty('cause', AbortError);
    });
  });

  describe('NotAllowedError', () => {
    test('should pass through error message (iOS Safari - Operation failed)', async () => {
      /**
       * Thrown when biometric is not enrolled, or a Safari bug prevents conditional UI from being
       * aborted properly between page reloads.
       *
       * See https://github.com/MasterKale/SimpleWebAuthn/discussions/350#discussioncomment-4896572
       */
      const NotAllowedError = generateCustomError(
        'NotAllowedError',
        'Operation failed.',
      );
      mockNavigatorGet.mockRejectedValueOnce(NotAllowedError);

      const rejected = await expect(startAuthentication(goodOpts1)).rejects;
      rejected.toThrow(Error);
      rejected.toThrow(/operation failed/i);
      rejected.toHaveProperty('name', 'NotAllowedError');
      rejected.toHaveProperty('code', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY');
      rejected.toHaveProperty('cause', NotAllowedError);
    });

    test('should pass through error message (Chrome M110 - Bad TLS Cert)', async () => {
      /**
       * Starting from Chrome M110, WebAuthn is blocked if the site is being displayed on a URL with
       * TLS certificate issues. This includes during development.
       *
       * See https://github.com/MasterKale/SimpleWebAuthn/discussions/351#discussioncomment-4910458
       */
      const NotAllowedError = generateCustomError(
        'NotAllowedError',
        'WebAuthn is not supported on sites with TLS certificate errors.',
      );
      mockNavigatorGet.mockRejectedValueOnce(NotAllowedError);

      const rejected = await expect(startAuthentication(goodOpts1)).rejects;
      rejected.toThrow(Error);
      rejected.toThrow(/sites with TLS certificate errors/i);
      rejected.toHaveProperty('name', 'NotAllowedError');
      rejected.toHaveProperty('code', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY');
      rejected.toHaveProperty('cause', NotAllowedError);
    });
  });

  describe('SecurityError', () => {
    const SecurityError = generateCustomError('SecurityError');

    let _originalHostName: string;

    beforeEach(() => {
      _originalHostName = window.location.hostname;
    });

    afterEach(() => {
      window.location.hostname = _originalHostName;
    });

    test('should identify invalid domain', async () => {
      window.location.hostname = '1.2.3.4';

      mockNavigatorGet.mockRejectedValueOnce(SecurityError);

      const rejected = await expect(startAuthentication(goodOpts1)).rejects;
      rejected.toThrowError(WebAuthnError);
      rejected.toThrow(/1\.2\.3\.4/);
      rejected.toThrow(/invalid domain/i);
      rejected.toHaveProperty('name', 'SecurityError');
      rejected.toHaveProperty('code', 'ERROR_INVALID_DOMAIN');
      rejected.toHaveProperty('cause', SecurityError);
    });

    test('should identify invalid RP ID', async () => {
      window.location.hostname = 'simplewebauthn.com';

      mockNavigatorGet.mockRejectedValueOnce(SecurityError);

      const rejected = await expect(startAuthentication(goodOpts1)).rejects;
      rejected.toThrowError(WebAuthnError);
      rejected.toThrow(goodOpts1.rpId);
      rejected.toThrow(/invalid for this domain/i);
      rejected.toHaveProperty('name', 'SecurityError');
      rejected.toHaveProperty('code', 'ERROR_INVALID_RP_ID');
      rejected.toHaveProperty('cause', SecurityError);
    });
  });

  describe('UnknownError', () => {
    const UnknownError = generateCustomError('UnknownError');

    test('should identify potential authenticator issues', async () => {
      mockNavigatorGet.mockRejectedValueOnce(UnknownError);

      const rejected = await expect(startAuthentication(goodOpts1)).rejects;
      rejected.toThrow(WebAuthnError);
      rejected.toThrow(/authenticator/i);
      rejected.toThrow(/unable to process the specified options/i);
      rejected.toThrow(/could not create a new assertion signature/i);
      rejected.toHaveProperty('name', 'UnknownError');
      rejected.toHaveProperty('code', 'ERROR_AUTHENTICATOR_GENERAL_ERROR');
      rejected.toHaveProperty('cause', UnknownError);
    });
  });
});
