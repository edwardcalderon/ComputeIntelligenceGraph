import * as crypto from 'node:crypto';

export interface GeneratedKeyPair {
  publicKey: string;
  privateKey: string;
}

export function generateEd25519KeyPair(): GeneratedKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    publicKey,
    privateKey,
  };
}
