import { fromByteArray, toByteArray } from 'base64-js';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytes,
} from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import type { TallySnapshot } from '../utils/snapshot';

export const KDF_ITERATIONS = 210_000;
export const SYNC_FORMAT = 'tally-sync';
export const SYNC_VERSION = 1;

export interface SyncEnvelope {
  format: typeof SYNC_FORMAT;
  version: typeof SYNC_VERSION;
  kdf: {
    algorithm: 'PBKDF2-SHA256';
    iterations: number;
    salt: string;
  };
  cipher: 'AES-256-GCM';
  data: string;
}

function decodeUtf8(bytes: Uint8Array): string {
  let result = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index];
    if (first < 0x80) {
      result += String.fromCharCode(first);
      index += 1;
    } else if ((first & 0xe0) === 0xc0 && index + 1 < bytes.length) {
      const second = bytes[index + 1];
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      index += 2;
    } else if ((first & 0xf0) === 0xe0 && index + 2 < bytes.length) {
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      result += String.fromCharCode(
        ((first & 0x0f) << 12) |
          ((second & 0x3f) << 6) |
          (third & 0x3f),
      );
      index += 3;
    } else if ((first & 0xf8) === 0xf0 && index + 3 < bytes.length) {
      const second = bytes[index + 1];
      const third = bytes[index + 2];
      const fourth = bytes[index + 3];
      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
      result += String.fromCodePoint(codePoint);
      index += 4;
    } else {
      result += '�';
      index += 1;
    }
  }
  return result;
}

function isEnvelope(value: unknown): value is SyncEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.format === SYNC_FORMAT &&
    record.version === SYNC_VERSION &&
    record.cipher === 'AES-256-GCM' &&
    typeof record.data === 'string' &&
    typeof record.kdf === 'object' &&
    record.kdf !== null &&
    (record.kdf as Record<string, unknown>).algorithm ===
      'PBKDF2-SHA256' &&
    typeof (record.kdf as Record<string, unknown>).iterations === 'number' &&
    typeof (record.kdf as Record<string, unknown>).salt === 'string'
  );
}

export function createSaltBase64(): string {
  return fromByteArray(getRandomBytes(16));
}

export async function deriveKeyHex(
  password: string,
  saltBase64: string,
  iterations = KDF_ITERATIONS,
): Promise<string> {
  const derived = await pbkdf2Async(
    sha256,
    utf8ToBytes(password),
    toByteArray(saltBase64),
    { c: iterations, dkLen: 32 },
  );
  return bytesToHex(derived);
}

export async function encryptSnapshot(
  snapshot: TallySnapshot,
  keyHex: string,
  saltBase64: string,
  iterations = KDF_ITERATIONS,
): Promise<SyncEnvelope> {
  const key = (await AESEncryptionKey.import(
    keyHex,
    'hex',
  )) as AESEncryptionKey;
  const plaintext = fromByteArray(
    utf8ToBytes(JSON.stringify(snapshot)),
  );
  const sealed = await aesEncryptAsync(plaintext, key);
  const data = (await sealed.combined('base64')) as string;

  return {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    kdf: {
      algorithm: 'PBKDF2-SHA256',
      iterations,
      salt: saltBase64,
    },
    cipher: 'AES-256-GCM',
    data,
  };
}

export async function decryptSnapshot(
  envelope: SyncEnvelope,
  keyHex: string,
): Promise<TallySnapshot> {
  const key = (await AESEncryptionKey.import(
    keyHex,
    'hex',
  )) as AESEncryptionKey;
  const sealed = AESSealedData.fromCombined(envelope.data);
  const plaintext = await aesDecryptAsync(sealed, key, {
    output: 'base64',
  });
  if (typeof plaintext !== 'string') {
    throw new Error('无法读取同步数据');
  }
  const bytes = toByteArray(plaintext);
  const json = decodeUtf8(bytes);
  return JSON.parse(json) as TallySnapshot;
}

export function parseEnvelope(value: unknown): SyncEnvelope {
  if (!isEnvelope(value)) throw new Error('同步文件格式不正确');
  return value;
}
