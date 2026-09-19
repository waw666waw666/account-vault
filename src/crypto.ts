import type { EncryptedPayload, EncryptionContext, PersistedVault, VaultData } from './types'
import { isVaultData } from './utils'

const ITERATIONS = 250_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function createEncryptionContext(password: string): Promise<EncryptionContext> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { key: await deriveKey(password, salt), salt: bytesToBase64(salt) }
}

export async function encryptVault(data: VaultData, context: EncryptionContext): Promise<{ mode: 'encrypted'; payload: EncryptedPayload }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, context.key, encoded)
  const payload: EncryptedPayload = {
    version: 1,
    salt: context.salt,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  }
  return { mode: 'encrypted', payload }
}

export async function unlockVault(payload: EncryptedPayload, password: string): Promise<{ data: VaultData; context: EncryptionContext }> {
  try {
    const salt = base64ToBytes(payload.salt)
    const key = await deriveKey(password, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
      key,
      base64ToBytes(payload.ciphertext),
    )
    const data: unknown = JSON.parse(new TextDecoder().decode(decrypted))
    if (!isVaultData(data)) throw new Error('备份格式不正确')
    return { data, context: { key, salt: payload.salt } }
  } catch {
    throw new Error('主密码不正确，或本地数据已损坏')
  }
}
