import type { Account, Avatar, PersistedVault, RecognizedAccount, VaultData } from './types'
import { VAULT_VERSION } from './types'

export const AVATAR_COLORS = [
  '#2F6FED',
  '#0E9384',
  '#D94F4F',
  '#C78912',
  '#6D5BD0',
  '#287E9B',
  '#BA4A7A',
  '#527A3B',
]

export const TAG_COLORS = ['#0E9384', '#2F6FED', '#D94F4F', '#C78912', '#6D5BD0', '#287E9B']

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function getInitial(name: string): string {
  const value = name.trim()
  if (!value) return '?'

  if (typeof Intl.Segmenter === 'function') {
    const segment = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)[Symbol.iterator]().next()
    if (!segment.done) return segment.value.segment.toLocaleUpperCase()
  }

  return Array.from(value)[0]?.toLocaleUpperCase() ?? '?'
}

export function colorFromName(name: string): string {
  let hash = 0
  for (const character of name.trim()) {
    hash = (hash * 31 + character.codePointAt(0)!) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// 精确匹配会员标签，兼容空格、大小写和全角字符，避免把普通 Gemini 标签误当会员。
export function isGeminiProTag(name: string): boolean {
  return normalizeTagName(name) === 'geminipro'
}

export function normalizeTagName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase()
}

export function sameTagName(left: string, right: string): boolean {
  return normalizeTagName(left) === normalizeTagName(right)
}

export function avatarForName(name: string): Avatar {
  return { type: 'initial', letter: getInitial(name), color: colorFromName(name) }
}

export function cleanRecognizedName(value: string): string {
  return value
    .replace(/[|¦]/g, ' ')
    .replace(/^\s*[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}@._+\-'’À-ž ]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sameAccountIdentity(
  left: Pick<Account | RecognizedAccount, 'name' | 'identifier'>,
  right: Pick<Account | RecognizedAccount, 'name' | 'identifier'>,
): boolean {
  const leftName = left.name.trim().toLocaleLowerCase()
  const rightName = right.name.trim().toLocaleLowerCase()
  const leftIdentifier = left.identifier.trim().toLocaleLowerCase()
  const rightIdentifier = right.identifier.trim().toLocaleLowerCase()
  if (!leftName || leftName !== rightName) return false
  if (leftIdentifier && rightIdentifier) return leftIdentifier === rightIdentifier
  return !leftIdentifier && !rightIdentifier
}

export function annotateRecognizedDuplicates(rows: RecognizedAccount[], existingAccounts: Account[]): RecognizedAccount[] {
  const seen: RecognizedAccount[] = []
  return rows.map((row) => {
    const duplicate = existingAccounts.some((account) => sameAccountIdentity(account, row))
      ? 'existing'
      : seen.some((candidate) => sameAccountIdentity(candidate, row))
        ? 'batch'
        : undefined
    seen.push(row)
    return {
      ...row,
      duplicate,
      selected: duplicate ? false : row.duplicate ? true : row.selected,
    }
  })
}

function hasUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length
}

function isAvatar(value: unknown): value is Avatar {
  if (!value || typeof value !== 'object') return false
  const avatar = value as Partial<Avatar>
  return avatar.type === 'initial'
    ? typeof avatar.letter === 'string' && typeof avatar.color === 'string'
    : avatar.type === 'image' && typeof avatar.dataUrl === 'string' && avatar.dataUrl.startsWith('data:image/')
}

export function isVaultData(value: unknown): value is VaultData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<VaultData>
  if (data.version !== VAULT_VERSION || !Array.isArray(data.boards) || !Array.isArray(data.tags) || !Array.isArray(data.accounts) || data.boards.length === 0) return false
  if (!data.boards.every((board) => Boolean(board) && typeof board.id === 'string' && board.id.length > 0 && typeof board.name === 'string' && board.name.trim().length > 0 && typeof board.color === 'string' && Number.isFinite(board.createdAt))) return false
  if (!data.tags.every((tag) => Boolean(tag) && typeof tag.id === 'string' && tag.id.length > 0 && typeof tag.name === 'string' && tag.name.trim().length > 0 && typeof tag.color === 'string')) return false
  if (!hasUniqueStrings(data.boards.map((board) => board.id)) || !hasUniqueStrings(data.tags.map((tag) => tag.id)) || !hasUniqueStrings(data.accounts.map((account) => account.id))) return false
  const boardIds = new Set(data.boards.map((board) => board.id))
  const tagIds = new Set(data.tags.map((tag) => tag.id))
  return data.accounts.every((account) => {
    if (!account || typeof account.id !== 'string' || !boardIds.has(account.boardId) || typeof account.name !== 'string' || !account.name.trim() || typeof account.identifier !== 'string') return false
    if (!isAvatar(account.avatar) || !Array.isArray(account.tagIds) || !account.tagIds.every((id) => typeof id === 'string' && tagIds.has(id)) || !Array.isArray(account.copyItems)) return false
    if (typeof account.notes !== 'string' || typeof account.favorite !== 'boolean' || !Number.isFinite(account.createdAt) || !Number.isFinite(account.updatedAt)) return false
    if (account.registeredAt !== undefined && typeof account.registeredAt !== 'string') return false
    if (account.password !== undefined && typeof account.password !== 'string') return false
    if (account.twoFactor !== undefined && typeof account.twoFactor !== 'string') return false
    if (!hasUniqueStrings(account.copyItems.map((item) => item.id))) return false
    return account.copyItems.every((item) => Boolean(item)
      && typeof item.id === 'string'
      && typeof item.label === 'string'
      && typeof item.value === 'string'
      && typeof item.note === 'string'
      && typeof item.sensitive === 'boolean'
      && (item.icon === undefined || typeof item.icon === 'string')
      && (item.color === undefined || typeof item.color === 'string')
      && (item.order === undefined || Number.isFinite(item.order)))
  })
}

export function isPersistedVault(value: unknown): value is PersistedVault {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<PersistedVault>
  if (record.mode === 'plain') return isVaultData(record.data)
  if (record.mode !== 'encrypted' || !record.payload) return false
  const payload = record.payload
  return payload.version === 1 && typeof payload.salt === 'string' && typeof payload.iv === 'string' && typeof payload.ciphertext === 'string'
}

export function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function formatAccountAge(val?: string): string {
  if (!val) return ''
  const trimmed = val.trim()
  if (!trimmed) return ''

  // 匹配 4 位年份，如 2021、2021年、2021-05、2019/08 等
  const match = trimmed.match(/(?:^|[^\d])(19\d\d|20\d\d)(?:[^\d]|$)/)
  if (match) {
    const regYear = parseInt(match[1], 10)
    const currentYear = new Date().getFullYear()
    const age = currentYear - regYear
    if (age <= 0) return `新号 (${regYear})`
    if (age >= 4) return `${age}年老号 (${regYear})`
    return `${age}年号 (${regYear})`
  }

  if (/^\d+年$/.test(trimmed)) {
    return `${trimmed}号`
  }

  return trimmed
}

export function maskIdentifier(val?: string): string {
  if (!val) return ''
  const trimmed = val.trim()
  if (!trimmed) return ''

  const atIndex = trimmed.indexOf('@')
  if (atIndex === -1) {
    if (trimmed.length <= 2) return `${trimmed[0]}*`
    if (trimmed.length <= 4) return `${trimmed[0]}**${trimmed[trimmed.length - 1]}`
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`
  }

  const username = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex)

  if (username.length <= 2) {
    return `${username[0]}*${domain}`
  }
  if (username.length <= 4) {
    return `${username[0]}**${username[username.length - 1]}${domain}`
  }
  return `${username.slice(0, 2)}***${username.slice(-2)}${domain}`
}

export function base32ToBytes(base32: string): Uint8Array | null {
  const clean = base32.replace(/[\s=-]/g, '').toUpperCase()
  if (!clean || !/^[A-Z2-7]+$/.test(clean)) return null
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const output: number[] = []
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i])
    if (val === -1) return null
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(output)
}

export async function generateTOTP(secret: string): Promise<{ code: string; remainingSeconds: number } | null> {
  try {
    const keyBytes = base32ToBytes(secret)
    if (!keyBytes || keyBytes.length < 5) return null
    const epoch = Math.floor(Date.now() / 1000)
    const timeStep = 30
    const counter = Math.floor(epoch / timeStep)
    const remainingSeconds = timeStep - (epoch % timeStep)

    const timeBuffer = new ArrayBuffer(8)
    const timeView = new DataView(timeBuffer)
    timeView.setUint32(0, 0, false)
    timeView.setUint32(4, counter, false)

    const subtle = globalThis.crypto?.subtle ?? (typeof window !== 'undefined' ? window.crypto?.subtle : undefined)
    if (!subtle) return null

    const cryptoKey = await subtle.importKey(
      'raw',
      keyBytes as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    const signature = await subtle.sign('HMAC', cryptoKey, timeBuffer)
    const sigBytes = new Uint8Array(signature)
    const offset = sigBytes[sigBytes.length - 1] & 0x0f
    const binary =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff)
    const otp = binary % 1000000
    return {
      code: otp.toString().padStart(6, '0'),
      remainingSeconds,
    }
  } catch {
    return null
  }
}

export type TwoFactorType = 'totp' | 'backup_code'

export interface TwoFactorAnalysis {
  type: TwoFactorType
  isTotp: boolean
  cleanValue: string
  title: string
  badgeText: string
  hint: string
}

export function analyzeTwoFactor(raw?: string | null): TwoFactorAnalysis | null {
  if (!raw || !raw.trim()) return null
  const trimmed = raw.trim()
  const clean = trimmed.replace(/[\s=-]/g, '').toUpperCase()
  const isBase32 = /^[A-Z2-7]+$/.test(clean)
  const bytes = base32ToBytes(clean)
  const isPureDigits = /^\d+$/.test(trimmed.replace(/[\s-]/g, ''))
  const isTotp = !isPureDigits && isBase32 && !!bytes && bytes.length >= 5 && clean.length >= 8

  if (isTotp) {
    return {
      type: 'totp',
      isTotp: true,
      cleanValue: clean,
      title: 'TOTP 动态密钥',
      badgeText: 'TOTP 动态密钥',
      hint: '基于 RFC 6238 标准算法自动计算，每 30 秒轮换更新',
    }
  }

  return {
    type: 'backup_code',
    isTotp: false,
    cleanValue: trimmed,
    title: '2FA 备用码 / 救援码',
    badgeText: '2FA 备用码',
    hint: '静态应急恢复凭据（非 TOTP 动态密钥）。登录遇到二次验证时可直接填入',
  }
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || '')
export const modifierKeyName = isMac ? '⌘' : 'Ctrl'

