/** Native OpenSSL AES-256-GCM; wire records contain ciphertext followed by the 16-byte tag. */
import { createCipheriv, createDecipheriv, createSecretKey } from 'node:crypto';
import type { AesKey } from './secure-channel.js';

export async function importAesKey(bytes: Uint8Array): Promise<AesKey> {
  if (bytes.length !== 32) throw new Error('invalid_aes_key');
  const key = createSecretKey(bytes);
  return {
    async encrypt(plaintext, nonce, additionalData) {
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      cipher.setAAD(additionalData);
      return new Uint8Array(Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]));
    },
    async decrypt(ciphertext, nonce, additionalData) {
      const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      decipher.setAAD(additionalData);
      decipher.setAuthTag(ciphertext.subarray(-16));
      // Never expose update()'s plaintext before final() authenticates the tag.
      return new Uint8Array(Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]));
    },
  };
}
