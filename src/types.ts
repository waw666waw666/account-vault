export const VAULT_VERSION = 1

export type InitialAvatar = {
  type: 'initial'
  letter: string
  color: string
}

export type ImageAvatar = {
  type: 'image'
  dataUrl: string
}

export type Avatar = InitialAvatar | ImageAvatar

export type Board = {
  id: string
  name: string
  color: string
  createdAt: number
}

export type Tag = {
  id: string
  name: string
  color: string
}

export type CopyItem = {
  id: string
  label: string
  value: string
  note: string
  sensitive: boolean
  icon?: string
  color?: string
  order?: number
}

export type Account = {
  id: string
  boardId: string
  name: string
  identifier: string
  avatar: Avatar
  tagIds: string[]
  copyItems: CopyItem[]
  notes: string
  favorite: boolean
  registeredAt?: string
  password?: string
  twoFactor?: string
  backupCode?: string
  createdAt: number
  updatedAt: number
}

export type VaultData = {
  version: typeof VAULT_VERSION
  boards: Board[]
  tags: Tag[]
  accounts: Account[]
}

export type EncryptedPayload = {
  version: 1
  salt: string
  iv: string
  ciphertext: string
}

export type PersistedVault =
  | { mode: 'plain'; data: VaultData }
  | { mode: 'encrypted'; payload: EncryptedPayload }

export type EncryptionContext = {
  key: CryptoKey
  salt: string
}

export type RecognizedAccount = {
  id: string
  name: string
  identifier: string
  avatar: Avatar
  confidence: number
  selected: boolean
  duplicate?: 'existing' | 'batch'
}
