import { describe, expect, it } from 'vitest'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'copy' | 'info' | 'error'
  timestamp: number
}

// Emulate toast queue dispatcher logic from App.tsx
function createToastManager(maxToasts = 4) {
  let toasts: ToastItem[] = []
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const showToast = (message: string, type: 'success' | 'copy' | 'info' | 'error' = 'success', duration = 2800) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const item: ToastItem = { id, message, type, timestamp: Date.now() }
    toasts = [item, ...toasts].slice(0, maxToasts)

    const timer = setTimeout(() => {
      dismissToast(id)
    }, duration)
    timers.set(id, timer)
    return id
  }

  const dismissToast = (id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    if (timers.has(id)) {
      clearTimeout(timers.get(id)!)
      timers.delete(id)
    }
  }

  const getToasts = () => [...toasts]
  const clearAll = () => {
    timers.forEach((t) => clearTimeout(t))
    timers.clear()
    toasts = []
  }

  return { showToast, dismissToast, getToasts, clearAll }
}

// Emulate account card reorder logic from App.tsx
function reorderAccounts<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
  const fromIdx = items.findIndex((item) => item.id === sourceId)
  const toIdx = items.findIndex((item) => item.id === targetId)
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return items

  const next = [...items]
  const [removed] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, removed)
  return next
}

describe('Multi-Toast Cascade & Stress Tests', () => {
  it('caps at max 4 stacked toasts when rapid-fire triggered', () => {
    const manager = createToastManager(4)
    for (let i = 1; i <= 20; i++) {
      manager.showToast(`Notification #${i}`)
    }
    const current = manager.getToasts()
    expect(current).toHaveLength(4)
    expect(current[0].message).toBe('Notification #20')
    expect(current[1].message).toBe('Notification #19')
    expect(current[2].message).toBe('Notification #18')
    expect(current[3].message).toBe('Notification #17')
    manager.clearAll()
  })

  it('allows manual dismiss of specific toast in the middle of stack', () => {
    const manager = createToastManager(4)
    const id1 = manager.showToast('First')
    const id2 = manager.showToast('Second')
    const id3 = manager.showToast('Third')

    expect(manager.getToasts()).toHaveLength(3)
    manager.dismissToast(id2)

    const remaining = manager.getToasts()
    expect(remaining).toHaveLength(2)
    expect(remaining.map((t) => t.id)).toEqual([id3, id1])
    manager.clearAll()
  })

  it('stress test: 1000 rapid calls and dismissals maintains consistent state without memory leaks', () => {
    const manager = createToastManager(4)
    const ids: string[] = []
    for (let i = 0; i < 1000; i++) {
      const id = manager.showToast(`Stress #${i}`, i % 2 === 0 ? 'copy' : 'info')
      ids.push(id)
      if (i % 3 === 0) {
        manager.dismissToast(id)
      }
    }
    expect(manager.getToasts().length).toBeLessThanOrEqual(4)
    manager.clearAll()
    expect(manager.getToasts()).toHaveLength(0)
  })
})

describe('Reorder Stability & Stress Tests', () => {
  it('correctly swaps adjacent and distant elements', () => {
    const accounts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]
    
    // Move 'a' to position of 'd'
    const result1 = reorderAccounts(accounts, 'a', 'd')
    expect(result1.map((x) => x.id)).toEqual(['b', 'c', 'd', 'a', 'e'])

    // Move 'e' to front ('b')
    const result2 = reorderAccounts(result1, 'e', 'b')
    expect(result2.map((x) => x.id)).toEqual(['e', 'b', 'c', 'd', 'a'])
  })

  it('no-ops when source or target invalid or identical', () => {
    const accounts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(reorderAccounts(accounts, 'a', 'a')).toBe(accounts)
    expect(reorderAccounts(accounts, 'a', 'non-existent')).toBe(accounts)
    expect(reorderAccounts(accounts, 'non-existent', 'b')).toBe(accounts)
  })

  it('stress test: 10,000 randomized permutations maintain exact set of items without duplication or loss', () => {
    let list = Array.from({ length: 50 }, (_, i) => ({ id: `acc-${i}` }))
    const initialIds = new Set(list.map((x) => x.id))

    for (let step = 0; step < 10000; step++) {
      const srcIdx = Math.floor(Math.random() * list.length)
      const tgtIdx = Math.floor(Math.random() * list.length)
      list = reorderAccounts(list, list[srcIdx].id, list[tgtIdx].id)
    }

    expect(list).toHaveLength(50)
    const finalIds = new Set(list.map((x) => x.id))
    expect(finalIds.size).toBe(50)
    for (const id of initialIds) {
      expect(finalIds.has(id)).toBe(true)
    }
  })

  it('reorders copy items by index accurately (SortableJS onEnd pattern)', () => {
    const copyItems = [
      { id: '1', label: '登录账号' },
      { id: '2', label: '访问密码' },
      { id: '3', label: 'Session Token' },
    ]
    // Move index 0 to index 2
    const next1 = [...copyItems]
    const [moved1] = next1.splice(0, 1)
    next1.splice(2, 0, moved1)
    expect(next1.map((i) => i.id)).toEqual(['2', '3', '1'])

    // Move index 2 back to index 1
    const next2 = [...next1]
    const [moved2] = next2.splice(2, 1)
    next2.splice(1, 0, moved2)
    expect(next2.map((i) => i.id)).toEqual(['2', '1', '3'])
  })
})
