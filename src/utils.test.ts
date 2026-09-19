import { describe, expect, it } from 'vitest'
import { annotateRecognizedDuplicates, cleanRecognizedName, colorFromName, getInitial, isGeminiProTag, isVaultData, uniqueNames } from './utils'
import type { Account, RecognizedAccount } from './types'
import { avatarForName } from './utils'

describe('Gemini Pro 头像标记', () => {
  it.each(['Gemini Pro', 'Geminipro', ' GEMINI  PRO ', 'Ｇｅｍｉｎｉ　Ｐｒｏ', 'gemini\tpro'])('识别会员标签 %s', (name) => {
    expect(isGeminiProTag(name)).toBe(true)
  })

  it.each(['Gemini', 'Pro', 'Gemini Pro 已过期', '非Gemini Pro', 'Gemini Pro Max', ''])('不误匹配普通或过期标签 %s', (name) => {
    expect(isGeminiProTag(name)).toBe(false)
  })
})

describe('账号导入工具', () => {
  it('保留带音标名称的首个完整字符', () => {
    expect(getInitial('Ángel')).toBe('Á')
  })

  it('为同一名称稳定生成同一颜色', () => {
    expect(colorFromName('工作主号')).toBe(colorFromName('工作主号'))
  })

  it('清理识别噪声并去重', () => {
    const names = ['• Anantapur', 'Anantapur', '| Bao   Thi'].map(cleanRecognizedName)
    expect(uniqueNames(names)).toEqual(['Anantapur', 'Bao Thi'])
  })

  it('拒绝缺少结构的数据文件', () => {
    expect(isVaultData({ version: 1, boards: [] })).toBe(false)
  })

  it('拒绝引用不存在板块或标签的备份', () => {
    expect(isVaultData({
      version: 1,
      boards: [{ id: 'board', name: 'Google', color: '#000000', createdAt: 1 }],
      tags: [],
      accounts: [{
        id: 'account',
        boardId: 'missing',
        name: '测试',
        identifier: '',
        avatar: avatarForName('测试'),
        tagIds: ['missing-tag'],
        copyItems: [],
        notes: '',
        favorite: false,
        createdAt: 1,
        updatedAt: 1,
      }],
    })).toBe(false)
  })

  it('标签名称等价性判断（忽略大小写、空格与全角）', async () => {
    const { sameTagName } = await import('./utils')
    expect(sameTagName('Gemini Pro', 'geminipro')).toBe(true)
    expect(sameTagName('工作 邮箱', '工作邮箱')).toBe(true)
    expect(sameTagName('工作邮箱', '个人邮箱')).toBe(false)
  })

  it('区分同批重复、已有重复和同名不同邮箱', () => {
    const row = (id: string, name: string, identifier: string): RecognizedAccount => ({
      id,
      name,
      identifier,
      avatar: avatarForName(name),
      confidence: 90,
      selected: true,
    })
    const existing = [{ name: 'Alice', identifier: 'a@example.com' }] as Account[]
    const annotated = annotateRecognizedDuplicates([
      row('1', 'Alice', 'a@example.com'),
      row('2', 'Alice', 'b@example.com'),
      row('3', 'Alice', 'b@example.com'),
    ], existing)

    expect(annotated.map((item) => item.duplicate)).toEqual(['existing', undefined, 'batch'])
    expect(annotated.map((item) => item.selected)).toEqual([false, true, false])
  })
})

describe('formatAccountAge 账号年限格式化', () => {
  it('正确计算并展示年份与老号年限', async () => {
    const { formatAccountAge } = await import('./utils')
    const currentYear = new Date().getFullYear()
    const age5 = currentYear - 2021
    const age2 = currentYear - 2024

    expect(formatAccountAge('2021')).toBe(`${age5}年老号 (2021)`)
    expect(formatAccountAge('2021年')).toBe(`${age5}年老号 (2021)`)
    expect(formatAccountAge('2024')).toBe(`${age2}年号 (2024)`)
    expect(formatAccountAge(String(currentYear))).toBe(`新号 (${currentYear})`)
    expect(formatAccountAge('3年号')).toBe('3年号')
    expect(formatAccountAge('5年')).toBe('5年号')
    expect(formatAccountAge('')).toBe('')
    expect(formatAccountAge(undefined)).toBe('')
  })
})

describe('maskIdentifier 邮箱与凭据部分脱敏', () => {
  it('正确脱敏标准邮箱，保留首2尾2与域名', async () => {
    const { maskIdentifier } = await import('./utils')
    expect(maskIdentifier('alex.chen@example.com')).toBe('al***en@example.com')
    expect(maskIdentifier('bella.wong@example.com')).toBe('be***ng@example.com')
    expect(maskIdentifier('carl.liu@example.com')).toBe('ca***iu@example.com')
    expect(maskIdentifier('dora.zhao@example.com')).toBe('do***ao@example.com')
  })

  it('适配短用户名邮箱', async () => {
    const { maskIdentifier } = await import('./utils')
    expect(maskIdentifier('a@example.com')).toBe('a*@example.com')
    expect(maskIdentifier('ab@example.com')).toBe('a*@example.com')
    expect(maskIdentifier('abc@example.com')).toBe('a**c@example.com')
    expect(maskIdentifier('abcd@example.com')).toBe('a**d@example.com')
  })

  it('正确脱敏非邮箱纯字符串凭据', async () => {
    const { maskIdentifier } = await import('./utils')
    expect(maskIdentifier('user123456')).toBe('us***56')
    expect(maskIdentifier('ab')).toBe('a*')
    expect(maskIdentifier('abcd')).toBe('a**d')
  })

  it('空值安全处理', async () => {
    const { maskIdentifier } = await import('./utils')
    expect(maskIdentifier('')).toBe('')
    expect(maskIdentifier('   ')).toBe('')
    expect(maskIdentifier(undefined)).toBe('')
  })
})

describe('TOTP 与 2FA 工具方法', () => {
  it('正确解析 Base32 编码与生成 TOTP', async () => {
    const { base32ToBytes, generateTOTP } = await import('./utils')
    const bytes = base32ToBytes('JBSWY3DPEHPK3PXP')
    expect(bytes).not.toBeNull()
    expect(bytes!.length).toBe(10)

    // 非法 base32 返回 null
    expect(base32ToBytes('INVALID 1890!')).toBeNull()

    // 生成合法 6 位数字代码
    const res = await generateTOTP('JBSWY3DPEHPK3PXP')
    expect(res).not.toBeNull()
    expect(res!.code).toMatch(/^\d{6}$/)
    expect(res!.remainingSeconds).toBeGreaterThanOrEqual(1)
    expect(res!.remainingSeconds).toBeLessThanOrEqual(30)
  })

  it('正确识别 TOTP 动态密钥 vs 2FA 备用码', async () => {
    const { analyzeTwoFactor } = await import('./utils')
    // 空值
    expect(analyzeTwoFactor('')).toBeNull()
    expect(analyzeTwoFactor(null)).toBeNull()

    // 标准 Base32 TOTP 密钥
    const totpResult = analyzeTwoFactor('JBSWY3DPEHPK3PXP')
    expect(totpResult).not.toBeNull()
    expect(totpResult!.type).toBe('totp')
    expect(totpResult!.isTotp).toBe(true)
    expect(totpResult!.title).toContain('TOTP')

    // 带空格与小写的 Base32 TOTP 密钥
    const spacedTotp = analyzeTwoFactor('jbsw y3dp ehpk 3pxp')
    expect(spacedTotp).not.toBeNull()
    expect(spacedTotp!.type).toBe('totp')
    expect(spacedTotp!.isTotp).toBe(true)

    // 纯数字 8 位备用码
    const numBackup = analyzeTwoFactor('84920193')
    expect(numBackup).not.toBeNull()
    expect(numBackup!.type).toBe('backup_code')
    expect(numBackup!.isTotp).toBe(false)
    expect(numBackup!.title).toContain('备用码')

    // 带有非 Base32 字符的破折号备用码
    const dashBackup = analyzeTwoFactor('8492-0193-4412')
    expect(dashBackup).not.toBeNull()
    expect(dashBackup!.type).toBe('backup_code')
    expect(dashBackup!.isTotp).toBe(false)

    // 混合字母备用码（含非 Base32 字母如 1, 8, 9, 0）
    const hexBackup = analyzeTwoFactor('a1b2-c3d4-e5f6')
    expect(hexBackup).not.toBeNull()
    expect(hexBackup!.type).toBe('backup_code')
  })
})

