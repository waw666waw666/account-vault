import { describe, expect, it } from 'vitest'
import { createEncryptionContext, encryptVault, unlockVault } from './crypto'
import { createEmptyVault } from './seed'

describe('本机加密', () => {
  it('使用正确主密码恢复数据，并拒绝错误密码', async () => {
    const data = createEmptyVault()
    const context = await createEncryptionContext('correct-password')
    const encrypted = await encryptVault(data, context)

    await expect(unlockVault(encrypted.payload, 'correct-password')).resolves.toMatchObject({ data })
    await expect(unlockVault(encrypted.payload, 'wrong-password')).rejects.toThrow('主密码不正确')
  })
})
