import type { Account, Board, Tag, VaultData } from './types'
import { colorFromName } from './utils'

export const NUMBERED_DEFAULT_TAGS: Tag[] = [
  { id: 'tag-1', name: 'GPT Plus', color: '#0E9384' },
  { id: 'tag-2', name: 'Gemini Pro', color: '#4F46E5' },
  { id: 'tag-3', name: '反重力', color: '#D94F4F' },
  { id: 'tag-4', name: '扫码失败', color: '#E11D48' },
  { id: 'tag-5', name: '长期号', color: '#C78912' },
  { id: 'tag-6', name: '已验证', color: '#287E9B' },
  { id: 'tag-7', name: '学生会员', color: '#2F6FED' },
  { id: 'tag-8', name: '备用', color: '#6D5BD0' },
]

export const DEFAULT_BOARDS: Board[] = [
  { id: 'board-qq', name: 'QQ / 常用邮箱', color: '#2563EB', createdAt: 1 },
  { id: 'board-google', name: 'Google 邮箱', color: '#0E9384', createdAt: 2 },
  { id: 'board-outlook', name: 'Outlook 邮箱', color: '#2F6FED', createdAt: 3 },
  { id: 'board-other', name: '其他邮箱', color: '#D59A16', createdAt: 4 },
]

export interface BridgeAccountInput {
  id?: string
  name?: string
  identifier: string
  boardId?: string
  password?: string
  twoFactor?: string
  tags?: (string | number)[]
  notes?: string
  favorite?: boolean
  registeredAt?: string
  avatar?: {
    type: 'initial'
    letter: string
    color: string
  }
  copyItems?: {
    id?: string
    label: string
    value: string
    note?: string
    sensitive?: boolean
  }[]
}

export interface BridgePayload {
  id: string
  action: 'reset_and_import' | 'append' | 'clear' | 'clean_unused_tags'
  toastMessage?: string
  accounts?: BridgeAccountInput[]
  boards?: Board[]
  tags?: Tag[]
}

export function resolveTags(
  inputTags: (string | number)[] | undefined,
  existingTags: Tag[]
): { tagIds: string[]; updatedTags: Tag[] } {
  const currentTags = [...existingTags]
  const tagIds: string[] = []

  if (!inputTags || !Array.isArray(inputTags)) {
    return { tagIds, updatedTags: currentTags }
  }

  for (const raw of inputTags) {
    const str = String(raw).trim()
    if (!str) continue

    // 1. Check direct ID or tag-<str>
    let matched = currentTags.find((t) => t.id === str || t.id === `tag-${str}` || t.name.toLowerCase() === str.toLowerCase())
    if (matched) {
      if (!tagIds.includes(matched.id)) tagIds.push(matched.id)
      continue
    }

    // 2. Check if user typed combined digits like '123' or '135'
    if (/^\d{2,}$/.test(str)) {
      for (const char of str) {
        const sub = currentTags.find((t) => t.id === `tag-${char}`)
        if (sub && !tagIds.includes(sub.id)) {
          tagIds.push(sub.id)
        }
      }
      continue
    }

    // 3. New custom tag name
    const newTagId = `tag-custom-${Date.now()}-${tagIds.length}`
    const newTag: Tag = {
      id: newTagId,
      name: str,
      color: '#3B82F6',
    }
    currentTags.push(newTag)
    tagIds.push(newTagId)
  }

  return { tagIds, updatedTags: currentTags }
}

export function applyBridgePayload(
  currentVault: VaultData | null,
  payload: BridgePayload
): { nextVault: VaultData; toastMessage: string; selectedAccountId?: string } {
  const now = Date.now()

  if (payload.action === 'clean_unused_tags') {
    if (!currentVault) {
      return {
        nextVault: { version: 1, boards: DEFAULT_BOARDS, tags: NUMBERED_DEFAULT_TAGS, accounts: [] },
        toastMessage: payload.toastMessage || '无数据可清理',
      }
    }
    const usedTagIds = new Set(currentVault.accounts.flatMap((a) => a.tagIds))
    const filteredTags = currentVault.tags.filter((t) => usedTagIds.has(t.id))
    return {
      nextVault: {
        ...currentVault,
        tags: filteredTags,
      },
      toastMessage: payload.toastMessage || `已清理无用标签，保留 ${filteredTags.length} 个活跃标签`,
    }
  }

  if (payload.action === 'clear') {
    const boards = currentVault?.boards.length ? currentVault.boards : DEFAULT_BOARDS
    return {
      nextVault: {
        version: 1,
        boards,
        tags: currentVault?.tags.length ? currentVault.tags : NUMBERED_DEFAULT_TAGS,
        accounts: [],
      },
      toastMessage: payload.toastMessage || '🤖 AI 助手已清空全部账号数据',
      selectedAccountId: '',
    }
  }

  if (payload.action === 'reset_and_import') {
    const boards = payload.boards || DEFAULT_BOARDS
    let tags = payload.tags || [...NUMBERED_DEFAULT_TAGS]
    const accounts: Account[] = []

    for (let i = 0; i < (payload.accounts || []).length; i++) {
      const acc = payload.accounts![i]
      const { tagIds, updatedTags } = resolveTags(acc.tags, tags)
      tags = updatedTags

      // Determine board
      let boardId = acc.boardId
      if (!boardId || !boards.some((b) => b.id === boardId)) {
        if (acc.identifier.includes('qq.com') || /^\d+$/.test(acc.identifier)) {
          boardId = boards.find((b) => b.id === 'board-qq')?.id || boards[0].id
        } else if (acc.identifier.includes('gmail.com')) {
          boardId = boards.find((b) => b.id === 'board-google')?.id || boards[0].id
        } else if (acc.identifier.includes('outlook.com') || acc.identifier.includes('hotmail.com')) {
          boardId = boards.find((b) => b.id === 'board-outlook')?.id || boards[0].id
        } else {
          boardId = boards[0]?.id || 'board-default'
        }
      }

      const copyItems = (acc.copyItems || []).map((ci, ciIdx) => ({
        id: ci.id || `copy-${now}-${i}-${ciIdx}`,
        label: ci.label,
        value: ci.value,
        note: ci.note || '',
        sensitive: Boolean(ci.sensitive),
      }))

      accounts.push({
        id: acc.id || `account-${now}-${i}`,
        boardId,
        name: acc.name || acc.identifier,
        identifier: acc.identifier,
        avatar: acc.avatar || {
          type: 'initial',
          letter: (acc.name || acc.identifier || 'A').slice(0, 1).toUpperCase(),
          color: colorFromName(acc.name || acc.identifier),
        },
        tagIds,
        copyItems,
        password: acc.password || undefined,
        twoFactor: acc.twoFactor || undefined,
        notes: acc.notes || '',
        favorite: Boolean(acc.favorite),
        registeredAt: acc.registeredAt || undefined,
        createdAt: now - i * 10,
        updatedAt: now - i * 10,
      })
    }

    return {
      nextVault: {
        version: 1,
        boards,
        tags,
        accounts,
      },
      toastMessage: payload.toastMessage || `🤖 AI 助手已清空并导入 ${accounts.length} 个账号！`,
      selectedAccountId: accounts[0]?.id,
    }
  }

  // append
  const boards = currentVault?.boards.length ? currentVault.boards : DEFAULT_BOARDS
  const incomingTags = payload.tags || []
  const existingTagsList = currentVault?.tags.length ? currentVault.tags : NUMBERED_DEFAULT_TAGS
  const mergedTags = [...incomingTags]
  for (const t of existingTagsList) {
    if (!mergedTags.some((m) => m.id === t.id || m.name.toLowerCase() === t.name.toLowerCase())) {
      mergedTags.push(t)
    }
  }
  let tags = incomingTags.length > 0 ? mergedTags : [...existingTagsList]
  const newAccounts: Account[] = []

  for (let i = 0; i < (payload.accounts || []).length; i++) {
    const acc = payload.accounts![i]
    const { tagIds, updatedTags } = resolveTags(acc.tags, tags)
    tags = updatedTags

    let boardId = acc.boardId
    if (!boardId || !boards.some((b) => b.id === boardId)) {
      if (acc.identifier.includes('qq.com') || /^\d+$/.test(acc.identifier)) {
        boardId = boards.find((b) => b.id === 'board-qq')?.id || boards[0].id
      } else if (acc.identifier.includes('gmail.com')) {
        boardId = boards.find((b) => b.id === 'board-google')?.id || boards[0].id
      } else if (acc.identifier.includes('outlook.com') || acc.identifier.includes('hotmail.com')) {
        boardId = boards.find((b) => b.id === 'board-outlook')?.id || boards[0].id
      } else {
        boardId = boards[0]?.id || 'board-default'
      }
    }

    const copyItems = (acc.copyItems || []).map((ci, ciIdx) => ({
      id: ci.id || `copy-${now}-${i}-${ciIdx}`,
      label: ci.label,
      value: ci.value,
      note: ci.note || '',
      sensitive: Boolean(ci.sensitive),
    }))

    newAccounts.push({
      id: acc.id || `account-${now}-${i}`,
      boardId,
      name: acc.name || acc.identifier,
      identifier: acc.identifier,
      avatar: acc.avatar || {
        type: 'initial',
        letter: (acc.name || acc.identifier || 'A').slice(0, 1).toUpperCase(),
        color: colorFromName(acc.name || acc.identifier),
      },
      tagIds,
      copyItems,
      password: acc.password || undefined,
      twoFactor: acc.twoFactor || undefined,
      notes: acc.notes || '',
      favorite: Boolean(acc.favorite),
      registeredAt: acc.registeredAt || undefined,
      createdAt: now,
      updatedAt: now,
    })
  }

  const existingAccounts = currentVault?.accounts || []
  const filteredExisting = existingAccounts.filter(
    (ea) => !newAccounts.some((na) => na.identifier && na.identifier === ea.identifier)
  )
  return {
    nextVault: {
      version: 1,
      boards,
      tags,
      accounts: [...newAccounts, ...filteredExisting],
    },
    toastMessage: payload.toastMessage || `🤖 AI 助手已新增 ${newAccounts.length} 个账号到本地库！`,
    selectedAccountId: newAccounts[0]?.id,
  }
}
