/**
 * Client-Side True End-to-End Encryption (E2EE) Module
 * High-Performance Native Binary AES-GCM-256 + ECDH
 */

// 1. Generate an Ephemeral ECDH Key Pair
export async function generateEcdhKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// 2. Export Public Key to JWK format for WebSocket transmission
export async function exportPublicKey(key) {
  return await window.crypto.subtle.exportKey("jwk", key);
}

// 3. Import Peer's JWK Public Key
export async function importPublicKey(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    []
  );
}

// 4. Derive Shared AES-GCM 256-bit Key
export async function deriveSharedAesGcmKey(myPrivateKey, peerPublicKey) {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: peerPublicKey
    },
    myPrivateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// 5. Fast Native Binary Chunk Encryption: [12-byte IV] + [Ciphertext]
export async function encryptChunkBinary(aesKey, rawArrayBuffer) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesKey,
    rawArrayBuffer
  );

  // Combine IV (12 bytes) + Ciphertext into a single contiguous Uint8Array
  const combined = new Uint8Array(12 + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), 12);

  return combined.buffer;
}

// 6. Fast Native Binary Chunk Decryption
export async function decryptChunkBinary(aesKey, encryptedArrayBuffer) {
  const view = new Uint8Array(encryptedArrayBuffer);
  const iv = view.slice(0, 12);
  const ciphertext = view.slice(12);

  return await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesKey,
    ciphertext
  );
}

// Legacy Base64 helpers for backward compatibility
export async function encryptChunk(aesKey, rawArrayBuffer) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    rawArrayBuffer
  );
  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

export async function decryptChunk(aesKey, base64Ciphertext, base64Iv) {
  const ciphertextBuffer = base64ToArrayBuffer(base64Ciphertext);
  const ivBuffer = base64ToArrayBuffer(base64Iv);
  return await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
    aesKey,
    ciphertextBuffer
  );
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}
