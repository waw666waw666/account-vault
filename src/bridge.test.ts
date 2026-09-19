import { describe, expect, it } from 'vitest'
import { applyBridgePayload, NUMBERED_DEFAULT_TAGS, resolveTags, type BridgePayload } from './bridge'

describe('bridge logic', () => {
  it('resolves numbered shortcut tags and combined digits', () => {
    const { tagIds: single } = resolveTags([1, '3'], NUMBERED_DEFAULT_TAGS)
    expect(single).toEqual(['tag-1', 'tag-3'])

    const { tagIds: combined } = resolveTags(['135'], NUMBERED_DEFAULT_TAGS)
    expect(combined).toEqual(['tag-1', 'tag-3', 'tag-5'])
  })

  it('handles reset_and_import for 147258369 test account', () => {
    const payload: BridgePayload = {
      id: 'cmd-test-1',
      action: 'reset_and_import',
      accounts: [
        {
          name: '测试账号 147258369',
          identifier: '147258369@example.com',
          tags: ['1', '3'],
        },
      ],
    }

    const { nextVault, selectedAccountId } = applyBridgePayload(null, payload)
    expect(nextVault.accounts).toHaveLength(1)
    expect(nextVault.accounts[0].identifier).toBe('147258369@example.com')
    expect(nextVault.accounts[0].tagIds).toEqual(['tag-1', 'tag-3'])
    expect(nextVault.accounts[0].boardId).toBe('board-qq')
    expect(selectedAccountId).toBe(nextVault.accounts[0].id)
  })

  it('handles append action', () => {
    const initialPayload: BridgePayload = {
      id: 'cmd-test-1',
      action: 'reset_and_import',
      accounts: [{ identifier: 'first@example.com' }],
    }
    const { nextVault: v1 } = applyBridgePayload(null, initialPayload)

    const appendPayload: BridgePayload = {
      id: 'cmd-test-2',
      action: 'append',
      accounts: [{ identifier: 'second@example.com', tags: [2] }],
    }
    const { nextVault: v2 } = applyBridgePayload(v1, appendPayload)
    expect(v2.accounts).toHaveLength(2)
    expect(v2.accounts[0].identifier).toBe('second@example.com')
    expect(v2.accounts[1].identifier).toBe('first@example.com')
  })

  it('handles clean_unused_tags action', () => {
    const v1 = {
      version: 1 as const,
      boards: [],
      tags: [
        { id: 'tag-used', name: 'Used', color: '#111' },
        { id: 'tag-unused', name: 'Unused', color: '#222' },
      ],
      accounts: [
        {
          id: 'acc-1',
          boardId: 'b1',
          name: 'Acc 1',
          identifier: 'acc@test.com',
          avatar: { type: 'initial' as const, letter: 'A', color: '#111' },
          tagIds: ['tag-used'],
          copyItems: [],
          notes: '',
          favorite: false,
          registeredAt: '',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }

    const { nextVault } = applyBridgePayload(v1, { id: 'clean-1', action: 'clean_unused_tags' })
    expect(nextVault.tags).toHaveLength(1)
    expect(nextVault.tags[0].id).toBe('tag-used')
  })
})
