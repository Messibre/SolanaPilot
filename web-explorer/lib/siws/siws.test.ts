import { describe, it, expect, beforeEach } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  formatSiwsMessage,
  verifySiwsMessage,
  type SiwsMessageData,
  InMemoryNonceStore,
} from "./index";

describe("Sign-In With Solana (SIWS) - T-065", () => {
  let nonceStore: InMemoryNonceStore;
  let keypair: nacl.SignKeyPair;
  let address: string;
  const expectedDomain = "localhost:3000";
  const expectedUri = "http://localhost:3000";

  beforeEach(() => {
    nonceStore = new InMemoryNonceStore();
    keypair = nacl.sign.keyPair();
    address = bs58.encode(keypair.publicKey);
  });

  async function createValidParams(overrides?: Partial<SiwsMessageData>) {
    const { nonce } = await nonceStore.createNonce();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const messageData: SiwsMessageData = {
      domain: expectedDomain,
      address,
      statement: "Sign in to SolanaPilot Explorer",
      uri: expectedUri,
      version: "1",
      nonce,
      issuedAt: now.toISOString(),
      expirationTime: expiresAt.toISOString(),
      ...overrides,
    };

    const message = formatSiwsMessage(messageData);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signature = bs58.encode(signatureBytes);

    return { message, signature, nonce, messageData };
  }

  it("1. valid: verifies valid message and signature", async () => {
    const { message, signature } = await createValidParams();
    const result = await verifySiwsMessage({
      message,
      signature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.address).toBe(address);
    }
  });

  it("2. replayed nonce: rejects reuse of already-consumed nonce", async () => {
    const { message, signature } = await createValidParams();

    // First use succeeds
    const firstResult = await verifySiwsMessage({
      message,
      signature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });
    expect(firstResult.ok).toBe(true);

    // Second use of the same message and nonce fails
    const secondResult = await verifySiwsMessage({
      message,
      signature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.error).toMatch(/nonce.*used|nonce.*invalid/i);
    }
  });

  it("3. expired: rejects message when expirationTime has passed", async () => {
    const past = new Date(Date.now() - 10000).toISOString();
    const { message, signature } = await createValidParams({
      expirationTime: past,
    });

    const result = await verifySiwsMessage({
      message,
      signature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/expired/i);
    }
  });

  it("4. wrong domain: rejects signature when domain does not match expected host", async () => {
    const { message, signature } = await createValidParams({
      domain: "attacker.com",
    });

    const result = await verifySiwsMessage({
      message,
      signature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/domain/i);
    }
  });

  it("5. wrong signature: rejects invalid signature", async () => {
    const { message } = await createValidParams();
    // Signature created by a different random keypair
    const otherKeypair = nacl.sign.keyPair();
    const wrongSignatureBytes = nacl.sign.detached(
      new TextEncoder().encode(message),
      otherKeypair.secretKey
    );
    const wrongSignature = bs58.encode(wrongSignatureBytes);

    const result = await verifySiwsMessage({
      message,
      signature: wrongSignature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/signature/i);
    }
  });

  it("6. malformed base58: rejects invalid base58 in address or signature", async () => {
    const { message } = await createValidParams();

    const badSigResult = await verifySiwsMessage({
      message,
      signature: "00OIlL-bad-base58-chars!!!",
      expectedDomain,
      expectedUri,
      nonceStore,
    });

    expect(badSigResult.ok).toBe(false);
    if (!badSigResult.ok) {
      expect(badSigResult.error).toMatch(/base58|signature/i);
    }
  });

  it("7. tampered message: rejects if message text is altered after signing", async () => {
    const { message, signature } = await createValidParams();
    // Tamper with address in message body
    const otherKeypair = nacl.sign.keyPair();
    const otherAddress = bs58.encode(otherKeypair.publicKey);
    const tamperedMessage = message.replace(address, otherAddress);

    const result = await verifySiwsMessage({
      message: tamperedMessage,
      signature,
      expectedDomain,
      expectedUri,
      nonceStore,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/signature|mismatch/i);
    }
  });

  it("8. concurrent double-use: exactly one succeeds when used concurrently", async () => {
    const { message, signature } = await createValidParams();

    const [res1, res2] = await Promise.all([
      verifySiwsMessage({
        message,
        signature,
        expectedDomain,
        expectedUri,
        nonceStore,
      }),
      verifySiwsMessage({
        message,
        signature,
        expectedDomain,
        expectedUri,
        nonceStore,
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});

