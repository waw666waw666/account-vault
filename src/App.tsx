import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  ImagePlus,
  Inbox,
  Info,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Settings,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import type { Account, Board, CopyItem, EncryptionContext, EncryptedPayload, PersistedVault, RecognizedAccount, Tag, VaultData } from './types'
import { encryptVault, createEncryptionContext, unlockVault } from './crypto'
import { createEmptyVault, createSeedVault, createDemoVault } from './seed'
import { loadPersistedVault, savePersistedVault } from './storage'
import { annotateRecognizedDuplicates, formatAccountAge, formatUpdatedAt, isPersistedVault, isVaultData, makeId, maskIdentifier, sameTagName } from './utils'
import { applyBridgePayload, type BridgePayload } from './bridge'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AccountDialog, BackupPasswordDialog, BoardDialog, CopyItemDialog, DeleteBoardMigrationDialog, type AccountDraft } from './components/Dialogs'
import { ScreenshotImportDialog } from './components/ScreenshotImportDialog'
import { AccountInspector, LockScreen, makeTag, SettingsView, TagLibraryView } from './components/Views'
import { Avatar, EmptyState, IconButton, SelectMenu, TagChip } from './components/Common'
import { ConfirmModal, type ConfirmOptions } from './components/ConfirmModal'
import './styles.css'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type SortMode = 'custom' | 'updated' | 'name' | 'created'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'copy' | 'info' | 'error'
  timestamp: number
}

function downloadJson(value: PersistedVault): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `账号库备份-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function AccountCard({
  account,
  tags,
  board,
  showBoardBadge,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  onCopyIdentifier,
  dragHandleProps,
  isOverlay,
  maskEmail = false,
}: {
  account: Account
  tags: Tag[]
  board: Board | undefined
  showBoardBadge: boolean
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onReorder?: (sourceId: string, targetId: string) => void
  onCopyIdentifier?: (value: string) => void
  dragHandleProps?: Record<string, any>
  isOverlay?: boolean
  maskEmail?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreTagsOpen, setMoreTagsOpen] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const moreTagsRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const assignedTags = account.tagIds.map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is Tag => Boolean(tag))

  const handleMouseEnterTags = () => {
    if (isOverlay) return
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current)
    setMoreTagsOpen(true)
  }

  const handleMouseLeaveTags = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = window.setTimeout(() => {
      setMoreTagsOpen(false)
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!moreTagsOpen) return
    const close = (event: MouseEvent) => {
      if (!moreTagsRef.current?.contains(event.target as Node)) setMoreTagsOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [moreTagsOpen])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreTagsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <article
      ref={cardRef}
      data-account-id={account.id}
      className={`account-card ${selected ? 'is-selected' : ''} ${isOverlay ? 'is-overlay' : ''}`}
      style={{ '--board-color': board?.color ?? '#2F6FED' } as React.CSSProperties}
      tabIndex={isOverlay ? -1 : 0}
      aria-label={`查看${account.name}详细信息`}
      onClick={isOverlay ? undefined : onSelect}
      onKeyDown={(event) => {
        if (isOverlay) return
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <div
        className="account-drag-handle"
        title="按住拖拽调整排序"
        {...dragHandleProps}
        onClick={(e) => {
          e.stopPropagation()
          dragHandleProps?.onClick?.(e)
        }}
      >
        <GripVertical size={13} />
      </div>

      {showBoardBadge && (
        <span className="account-card-board">
          <span style={{ backgroundColor: board?.color ?? '#2F6FED' }} />
          {board?.name ?? '未分类'}
        </span>
      )}
      <div className="account-card-menu" ref={menuRef}>
        {account.favorite && <Star className="favorite-mark" size={15} fill="currentColor" />}
        {!isOverlay && (
          <IconButton
            label="账号操作"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((current) => !current)
            }}
          >
            <MoreHorizontal size={18} />
          </IconButton>
        )}
        {menuOpen && !isOverlay && (
          <div className="context-menu" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { setMenuOpen(false); onSelect() }}><Info size={15} />详细信息</button>
            <button type="button" onClick={() => { setMenuOpen(false); onEdit() }}><Pencil size={15} />编辑</button>
            <button type="button" className="danger-menu-item" onClick={() => { setMenuOpen(false); onDelete() }}><Trash2 size={15} />删除</button>
          </div>
        )}
      </div>
      <div className="account-card-main">
        <span className="account-card-identity">
          <Avatar avatar={account.avatar} name={account.name} size="large" tags={assignedTags} />
          <span className="account-card-name" title={account.name}>{account.name}</span>
          <span
            className={`account-card-email ${emailCopied ? 'is-copied' : ''}`}
            title={account.identifier ? (maskEmail ? '点击复制完整邮箱 (已部分隐藏防窥)' : '点击复制邮箱/账号凭据') : '尚未添加邮箱'}
            onClick={(event) => {
              if (isOverlay) return
              if (!account.identifier) return
              event.stopPropagation()
              onCopyIdentifier?.(account.identifier)
              setEmailCopied(true)
              window.setTimeout(() => setEmailCopied(false), 1500)
            }}
          >
            <span className="account-card-email-text">
              {account.identifier ? (maskEmail ? maskIdentifier(account.identifier) : account.identifier) : '尚未添加邮箱'}
            </span>
            {account.identifier && (
              <span className="account-card-email-icon">
                {emailCopied ? <Check size={11} strokeWidth={2.6} /> : <Copy size={10} />}
              </span>
            )}
          </span>
          {account.registeredAt && (
            <span className="account-age-badge" title={`账号注册年限 / 时间：${account.registeredAt}`}>
              <Calendar size={11} />
              <span>{formatAccountAge(account.registeredAt)}</span>
            </span>
          )}
        </span>
        <span className="account-card-tags">
          {assignedTags.length <= 2 ? (
            assignedTags.map((tag) => <TagChip key={tag.id} tag={tag} />)
          ) : (
            <>
              {assignedTags.slice(0, 2).map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
              <span
                className="more-tags-wrap"
                ref={moreTagsRef}
                onMouseEnter={handleMouseEnterTags}
                onMouseLeave={handleMouseLeaveTags}
              >
                <button
                  type="button"
                  className="more-tags"
                  aria-expanded={moreTagsOpen}
                  aria-label={`查看其余 ${assignedTags.length - 2} 个标签`}
                  onClick={(event) => {
                    if (isOverlay) return
                    event.stopPropagation()
                    setMoreTagsOpen((current) => !current)
                  }}
                >
                  +{assignedTags.length - 2}
                </button>
                {moreTagsOpen && !isOverlay && (
                  <span
                    className="more-tags-popover"
                    role="tooltip"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="more-tags-title">其余标签 ({assignedTags.length - 2})</span>
                    <span className="more-tags-chips">
                      {assignedTags.slice(2).map((tag) => (
                        <TagChip key={tag.id} tag={tag} />
                      ))}
                    </span>
                  </span>
                )}
              </span>
            </>
          )}
          {assignedTags.length === 0 && <span className="no-tags">暂无标签</span>}
        </span>
      </div>
    </article>
  )
}

function SortableAccountCard(props: {
  account: Account
  tags: Tag[]
  board: Board | undefined
  showBoardBadge: boolean
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onCopyIdentifier?: (value: string) => void
  disabled?: boolean
  maskEmail?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.account.id,
    disabled: props.disabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-card-wrapper ${isDragging ? 'is-placeholder' : ''}`}
    >
      <AccountCard
        {...props}
        dragHandleProps={{
          ref: setActivatorNodeRef,
          ...attributes,
          ...listeners,
        }}
      />
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<VaultData | null>(null)
  const [lockedPayload, setLockedPayload] = useState<EncryptedPayload | null>(null)
  const [encryption, setEncryption] = useState<EncryptionContext | null>(null)
  const [bootError, setBootError] = useState('')
  const [ready, setReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [selectedView, setSelectedView] = useState('board-google')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [closingAccount, setClosingAccount] = useState<Account | null>(null)

  const selectedAccount = useMemo(() => data?.accounts.find((account) => account.id === selectedAccountId) ?? null, [data, selectedAccountId])

  const handleCloseInspector = useCallback(() => {
    if (selectedAccount) {
      setClosingAccount(selectedAccount)
    }
    setSelectedAccountId('')
  }, [selectedAccount])

  useEffect(() => {
    if (!closingAccount) return
    const timer = window.setTimeout(() => {
      setClosingAccount(null)
    }, 240)
    return () => window.clearTimeout(timer)
  }, [closingAccount])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vault_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null)
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('custom')
  const [accountDialog, setAccountDialog] = useState<'new' | string | null>(null)
  const [boardDialog, setBoardDialog] = useState<'new' | string | null>(null)
  const [copyItemDialog, setCopyItemDialog] = useState<'new' | CopyItem | null>(null)
  const [importFile, setImportFile] = useState<File | null | undefined>(undefined)
  const [boardMenuId, setBoardMenuId] = useState<string | null>(null)
  const [deleteMigrationTarget, setDeleteMigrationTarget] = useState<{ board: Board; count: number } | null>(null)
  const [pendingEncryptedImport, setPendingEncryptedImport] = useState<Extract<PersistedVault, { mode: 'encrypted' }> | null>(null)
  const [commonMenuOpen, setCommonMenuOpen] = useState(false)
  const commonMenuRef = useRef<HTMLDivElement>(null)
  const [maskEmailEnabled, setMaskEmailEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('account_vault_mask_email')
      return stored !== 'false'
    } catch {
      return true
    }
  })
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: 'success' | 'copy' | 'info' | 'error' | boolean = 'success') => {
    const resolvedType = typeof type === 'boolean' ? (type ? 'error' : 'success') : type
    const now = Date.now()
    const id = `${now}-${Math.random().toString(36).slice(2, 7)}`
    const newItem: ToastItem = { id, message, type: resolvedType, timestamp: now }
    setToasts((prev) => {
      // Deduplicate identical toasts appearing within 1 second
      if (prev.length > 0 && prev.some((t) => t.message === message && now - t.timestamp < 1000)) {
        return prev
      }
      return [newItem, ...prev.slice(0, 3)]
    })
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  const toggleMaskEmail = useCallback(() => {
    const next = !maskEmailEnabled
    setMaskEmailEnabled(next)
    try {
      localStorage.setItem('account_vault_mask_email', String(next))
    } catch {}
    showToast(next ? '已开启邮箱部分隐藏（脱敏防窥）' : '已显示完整邮箱', 'info')
  }, [maskEmailEnabled, showToast])

  useEffect(() => {
    if (!commonMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!commonMenuRef.current?.contains(event.target as Node)) {
        setCommonMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommonMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [commonMenuOpen])

  useEffect(() => {
    if (!boardMenuId) return
    const close = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest?.('.board-nav-wrap')) {
        setBoardMenuId(null)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBoardMenuId(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [boardMenuId])

  useEffect(() => {
    if (accountDialog || boardDialog || copyItemDialog || importFile !== undefined || confirmOptions) {
      setBoardMenuId(null)
    }
  }, [accountDialog, boardDialog, copyItemDialog, importFile, confirmOptions])

  useEffect(() => {
    let active = true
    void loadPersistedVault()
      .then((record) => {
        if (!active) return
        if (!record) {
          const fresh = createEmptyVault()
          setData(fresh)
          setReady(true)
          void savePersistedVault({ mode: 'plain', data: fresh })
          return
        }
        if (record && record.mode === 'plain' && record.data && Array.isArray(record.data.tags) && Array.isArray(record.data.accounts)) {
          const usedTagIds = new Set(record.data.accounts.flatMap((a) => (Array.isArray(a.tagIds) ? a.tagIds : [])))
          const existingTagIds = new Set(record.data.tags.map((t) => t.id))
          let modified = false

          for (const acc of record.data.accounts) {
            if (Array.isArray(acc.tagIds)) {
              for (const tid of acc.tagIds) {
                if (!existingTagIds.has(tid)) {
                  record.data.tags.push({ id: tid, name: '标签', color: '#4F46E5' })
                  existingTagIds.add(tid)
                  modified = true
                }
              }
            }
          }

          const originalCount = record.data.tags.length
          record.data.tags = record.data.tags.filter((t) => usedTagIds.has(t.id))
          if (record.data.tags.length !== originalCount) {
            modified = true
          }

          if (modified) {
            void savePersistedVault(record)
          }
        }
        if (!isPersistedVault(record)) throw new Error('本地数据格式不正确')
        if (record.mode === 'encrypted') {
          setLockedPayload(record.payload)
        } else {
          const legacySeedIds = new Set(['account-work', 'account-dev', 'account-sub', 'account-backup', 'account-outlook', 'account-other'])
          const isLegacyOrDemo =
            record.data.accounts.length === 0 ||
            record.data.accounts.every(
              (a) =>
                a.id.startsWith('demo-') ||
                legacySeedIds.has(a.id)
            )
          if (isLegacyOrDemo) {
            const fresh = createEmptyVault()
            setData(fresh)
            void savePersistedVault({ mode: 'plain', data: fresh })
          } else {
            setData(record.data)
          }
        }
        setReady(true)
      })
      .catch((reason) => active && setBootError(reason instanceof Error ? reason.message : '无法读取本地数据'))
    return () => {
      active = false
    }
  }, [])

  const latestDataRef = useRef<VaultData | null>(data)
  const latestEncryptionRef = useRef<EncryptionContext | null>(encryption)
  const debounceTimerRef = useRef<number | null>(null)
  const saveGenerationRef = useRef(0)
  const savedGenerationRef = useRef(0)

  useEffect(() => {
    latestDataRef.current = data
    latestEncryptionRef.current = encryption
  }, [data, encryption])

  const commitData = (next: VaultData) => {
    latestDataRef.current = next
    saveGenerationRef.current += 1
    setSaveStatus('saving')
    setData(next)
  }

  const flushSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    const currentData = latestDataRef.current
    const currentContext = latestEncryptionRef.current
    const generation = saveGenerationRef.current
    if (!currentData) return

    setSaveStatus('saving')
    const task = saveQueue.current.catch(() => {}).then(async () => {
      const record: PersistedVault = currentContext
        ? await encryptVault(currentData, currentContext)
        : { mode: 'plain', data: currentData }
      await savePersistedVault(record)
    })
    saveQueue.current = task.catch(() => {})
    try {
      await task
      savedGenerationRef.current = Math.max(savedGenerationRef.current, generation)
      if (generation === saveGenerationRef.current) setSaveStatus('saved')
    } catch (error) {
      if (generation === saveGenerationRef.current) setSaveStatus('error')
      throw error
    }
  }, [])

  useEffect(() => {
    if (!ready || !data) return
    setSaveStatus('saving')
    const gen = ++saveGenerationRef.current

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      if (gen !== saveGenerationRef.current) return
      void flushSave().catch(() => {})
    }, 320)

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [data, encryption, ready, flushSave])

  useEffect(() => {
    const hasPendingSave = () => saveGenerationRef.current > savedGenerationRef.current
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasPendingSave()) void flushSave().catch(() => {})
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingSave()) return
      void flushSave().catch(() => {})
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flushSave])

  // Dev Bridge: 自动接收并同步来自 AI 助手的指令（如清空、一键导入账号）
  useEffect(() => {
    if (!ready) return
    let timer: number | null = null
    const checkBridge = async () => {
      try {
        const res = await fetch('/agent_bridge.json?t=' + Date.now())
        if (!res.ok) return
        const payload: BridgePayload = await res.json()
        if (!payload || !payload.id) return
        const lastId = localStorage.getItem('agent_bridge_last_id')
        if (lastId === payload.id) return
        localStorage.setItem('agent_bridge_last_id', payload.id)

        const { nextVault, toastMessage, selectedAccountId } = applyBridgePayload(latestDataRef.current, payload)
        commitData(nextVault)
        if (selectedAccountId) {
          const target = nextVault.accounts.find((a) => a.id === selectedAccountId)
          if (target) setSelectedView(target.boardId)
          setSelectedAccountId(selectedAccountId)
          setClosingAccount(null)
        }
        showToast(toastMessage, 'success')
      } catch {
        // silent in background
      }
    }

    void checkBridge()
    timer = window.setInterval(checkBridge, 1000)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [ready, showToast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'n' && data) {
        event.preventDefault()
        setAccountDialog('new')
      }
      if (event.key === 'Escape') {
        if (document.activeElement === searchRef.current) {
          setSearch('')
          searchRef.current?.blur()
        } else if (selectedAccountId && !document.activeElement?.closest('input, textarea, select, dialog, .modal-backdrop')) {
          handleCloseInspector()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [data, selectedAccountId, handleCloseInspector])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!data || importFile !== undefined) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
      const image = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.type.startsWith('image/'))
        ?.getAsFile()
      if (!image) return
      event.preventDefault()
      setImportFile(image)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [data, importFile])

  const boardId = data?.boards.some((board) => board.id === selectedView) ? selectedView : data?.boards[0]?.id ?? ''
  const defaultBoardId = selectedView !== 'all' && data?.boards.some((board) => board.id === selectedView) ? selectedView : data?.boards[0]?.id ?? ''
  const specialView = selectedView === 'tags' || selectedView === 'settings'

  useEffect(() => {
    if (!data || selectedView === 'all' || specialView || data.boards.some((board) => board.id === selectedView)) return
    setSelectedView(data.boards[0]?.id ?? 'all')
  }, [data, selectedView, specialView])

  const visibleAccounts = useMemo(() => {
    if (!data || specialView) return []
    const query = search.trim().toLocaleLowerCase()
    const filtered = data.accounts.filter((account) => {
      if (selectedView !== 'all' && account.boardId !== selectedView) return false
      if (!query) return true
      const tagNames = account.tagIds.map((id) => data.tags.find((tag) => tag.id === id)?.name ?? '').join(' ')
      return `${account.name} ${account.identifier} ${account.registeredAt || ''} ${tagNames} ${account.notes}`.toLocaleLowerCase().includes(query)
    })
    if (sortMode === 'custom') {
      return filtered
    }
    return [...filtered].sort((left, right) => {
      if (left.favorite !== right.favorite) return Number(right.favorite) - Number(left.favorite)
      if (sortMode === 'name') return left.name.localeCompare(right.name, 'zh-CN')
      if (sortMode === 'created') return right.createdAt - left.createdAt
      return right.updatedAt - left.updatedAt
    })
  }, [data, search, selectedView, sortMode, specialView])

  useEffect(() => {
    if (!selectedAccountId) return
    if (!data?.accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId('')
    }
  }, [data, selectedAccountId])

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('vault_sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }

  const reorderAccounts = (sourceId: string, targetId: string) => {
    setSortMode('custom')
    const current = latestDataRef.current
    if (!current) return
    const accounts = [...current.accounts]
    const srcIdx = accounts.findIndex((account) => account.id === sourceId)
    const dstIdx = accounts.findIndex((account) => account.id === targetId)
    if (srcIdx < 0 || dstIdx < 0 || srcIdx === dstIdx) return
    const [moved] = accounts.splice(srcIdx, 1)
    accounts.splice(dstIdx, 0, moved)
    commitData({ ...current, accounts })
    showToast('已调整账号排序', 'success')
  }

  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleGridDragStart = (event: DragStartEvent) => {
    setActiveAccountId(String(event.active.id))
  }

  const handleGridDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveAccountId(null)
    if (over && active.id !== over.id) {
      reorderAccounts(String(active.id), String(over.id))
    }
  }

  const handleGridDragCancel = () => {
    setActiveAccountId(null)
  }

  const activeAccount = useMemo(() => {
    if (!activeAccountId || !data) return null
    return data.accounts.find((a) => a.id === activeAccountId) ?? null
  }, [activeAccountId, data])

  const activeBoard = data?.boards.find((board) => board.id === selectedView)
  const searchScopeLabel = selectedView === 'all' || specialView ? '全部账号' : activeBoard?.name ?? '当前板块'

  const updateAccount = (accountId: string, update: Partial<Account>, touchUpdatedAt = true) => {
    const current = latestDataRef.current
    if (!current) return
    commitData({
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId ? {
        ...account,
        ...update,
        updatedAt: touchUpdatedAt ? Date.now() : account.updatedAt,
      } : account),
    })
  }

  const removeAccount = (account: Account) => {
    setConfirmOptions({
      title: '删除账号',
      message: `确定要删除“${account.name}”吗？此操作无法撤销。`,
      confirmText: '删除',
      danger: true,
      icon: 'trash',
      onConfirm: () => {
        const current = latestDataRef.current
        if (current) commitData({ ...current, accounts: current.accounts.filter((item) => item.id !== account.id) })
        if (selectedAccountId === account.id) setSelectedAccountId('')
        showToast('账号已删除')
      },
    })
  }

  const saveAccount = (draft: AccountDraft) => {
    if (!data) return
    const now = Date.now()
    if (accountDialog && accountDialog !== 'new') {
      updateAccount(accountDialog, draft, true)
      setSelectedAccountId(accountDialog)
      setSelectedView(draft.boardId)
      showToast('账号已更新')
    } else {
      const account: Account = { ...draft, id: makeId('account'), copyItems: [], createdAt: now, updatedAt: now }
      commitData({ ...data, accounts: [...data.accounts, account] })
      setSelectedView(account.boardId)
      setSelectedAccountId(account.id)
      showToast('账号已创建')
    }
    setAccountDialog(null)
  }

  const saveBoard = (name: string, color: string) => {
    if (!data) return
    if (boardDialog && boardDialog !== 'new') {
      commitData({ ...data, boards: data.boards.map((board) => board.id === boardDialog ? { ...board, name, color } : board) })
      showToast('板块已更新')
    } else {
      const board: Board = { id: makeId('board'), name, color, createdAt: Date.now() }
      commitData({ ...data, boards: [...data.boards, board] })
      setSelectedView(board.id)
      showToast('板块已创建')
    }
    setBoardDialog(null)
  }

  const deleteBoard = (board: Board) => {
    if (!data) return
    const count = data.accounts.filter((account) => account.boardId === board.id).length
    const otherBoards = data.boards.filter((b) => b.id !== board.id)
    if (count > 0) {
      if (otherBoards.length === 0) {
        showToast('至少需要保留一个板块，无法删除', true)
        return
      }
      setDeleteMigrationTarget({ board, count })
      return
    }
    setConfirmOptions({
      title: '删除板块',
      message: `确定要删除空板块“${board.name}”吗？`,
      confirmText: '删除',
      danger: true,
      icon: 'trash',
      onConfirm: () => {
        commitData({ ...data, boards: data.boards.filter((item) => item.id !== board.id) })
        setSelectedView('all')
        showToast('板块已删除')
      },
    })
  }

  const confirmBoardMigrationAndDelete = (targetBoardId: string) => {
    if (!data || !deleteMigrationTarget) return
    const sourceBoard = deleteMigrationTarget.board
    const migratedAccounts = data.accounts.map((account) =>
      account.boardId === sourceBoard.id ? { ...account, boardId: targetBoardId, updatedAt: Date.now() } : account
    )
    const nextBoards = data.boards.filter((b) => b.id !== sourceBoard.id)
    commitData({ ...data, accounts: migratedAccounts, boards: nextBoards })
    setDeleteMigrationTarget(null)
    setSelectedView(targetBoardId)
    showToast(`已将 ${deleteMigrationTarget.count} 个账号迁移至新板块并删除了原板块`)
  }

  const createTagOnly = (name: string) => {
    if (!data) return
    const cleanName = name.trim()
    if (!cleanName) return
    if (data.tags.some((tag) => sameTagName(tag.name, cleanName))) {
      showToast('这个标签已经存在', true)
      return
    }
    commitData({ ...data, tags: [...data.tags, makeTag(cleanName)] })
    showToast('标签已创建')
  }

  const createAndAssignTag = (name: string) => {
    if (!data || !selectedAccount) return
    const cleanName = name.trim()
    const existing = data.tags.find((tag) => sameTagName(tag.name, cleanName))
    const tag = existing ?? makeTag(cleanName)
    commitData({
      ...data,
      tags: existing ? data.tags : [...data.tags, tag],
      accounts: data.accounts.map((account) => account.id === selectedAccount.id
        ? { ...account, tagIds: account.tagIds.includes(tag.id) ? account.tagIds : [...account.tagIds, tag.id], updatedAt: Date.now() }
        : account),
    })
  }

  const deleteTag = (tag: Tag) => {
    if (!data) return
    const usage = data.accounts.filter((account) => account.tagIds.includes(tag.id)).length
    setConfirmOptions({
      title: '删除标签',
      message: usage > 0 ? `标签“${tag.name}”正在被 ${usage} 个账号使用，删除后将从这些账号中移除，确定继续吗？` : `确定要删除标签“${tag.name}”吗？`,
      confirmText: '删除',
      danger: true,
      icon: 'trash',
      onConfirm: () => {
        commitData({
          ...data,
          tags: data.tags.filter((item) => item.id !== tag.id),
          accounts: data.accounts.map((account) => ({ ...account, tagIds: account.tagIds.filter((id) => id !== tag.id) })),
        })
        showToast('标签已删除')
      },
    })
  }

  const cleanUnusedTags = () => {
    if (!data) return
    const usedTagIds = new Set(data.accounts.flatMap((a) => a.tagIds))
    const removedCount = data.tags.filter((t) => !usedTagIds.has(t.id)).length
    if (removedCount === 0) {
      showToast('当前没有未使用的标签', 'info')
      return
    }
    const remainingTags = data.tags.filter((t) => usedTagIds.has(t.id))
    commitData({ ...data, tags: remainingTags })
    showToast(`已清理 ${removedCount} 个未使用的标签`, 'success')
  }

  const saveCopyItem = (item: CopyItem) => {
    if (!selectedAccount) return
    const exists = selectedAccount.copyItems.some((current) => current.id === item.id)
    updateAccount(selectedAccount.id, {
      copyItems: exists
        ? selectedAccount.copyItems.map((current) => current.id === item.id ? item : current)
        : [...selectedAccount.copyItems, item],
    })
    setCopyItemDialog(null)
    showToast(exists ? '复制项已更新' : '复制项已添加')
  }

  const copyText = async (value: string, label: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      const isEmail = value.includes('@')
      const msg = isEmail && maskEmailEnabled ? `已复制完整邮箱：${value}` : (label ? `${label}已复制` : '已复制')
      showToast(msg, 'copy')
    } catch {
      showToast('复制失败，请检查浏览器剪贴板权限', 'error')
    }
  }

  const importRecognizedAccounts = (recognized: RecognizedAccount[], targetBoardId: string) => {
    if (!data) return
    const now = Date.now()
    const candidates = annotateRecognizedDuplicates(recognized, data.accounts)
    const created = candidates
      .filter((item) => item.selected && !item.duplicate && item.name.trim())
      .map<Account>((item) => ({
        id: makeId('account'),
        boardId: targetBoardId,
        name: item.name.trim(),
        identifier: item.identifier.trim(),
        avatar: item.avatar,
        tagIds: [],
        copyItems: [],
        notes: '',
        favorite: false,
        createdAt: now,
        updatedAt: now,
      }))
    commitData({ ...data, accounts: [...data.accounts, ...created] })
    setImportFile(undefined)
    setSelectedView(targetBoardId)
    if (created[0]) setSelectedAccountId(created[0].id)
    const skipped = candidates.length - created.length
    showToast(skipped > 0 ? `已导入 ${created.length} 个，跳过 ${skipped} 个重复项` : `已导入 ${created.length} 个账号`)
  }

  const enableEncryption = async (password: string) => {
    await flushSave()
    const currentData = latestDataRef.current
    if (!currentData) return
    const context = await createEncryptionContext(password)
    const record = await encryptVault(currentData, context)
    await savePersistedVault(record)
    setEncryption(context)
    latestEncryptionRef.current = context
    setSaveStatus('saved')
    showToast('本机锁已开启')
  }

  const lockNow = async () => {
    try {
      await flushSave()
      const currentData = latestDataRef.current
      const currentContext = latestEncryptionRef.current
      if (!currentData || !currentContext) return
      const record = await encryptVault(currentData, currentContext)
      await savePersistedVault(record)
      setLockedPayload(record.payload)
      setEncryption(null)
      setData(null)
      latestEncryptionRef.current = null
      latestDataRef.current = null
    } catch {
      showToast('锁定失败，当前页面和输入仍保留', 'error')
    }
  }

  const exportBackup = async () => {
    try {
      await flushSave()
      const currentData = latestDataRef.current
      const currentContext = latestEncryptionRef.current
      if (!currentData) return
      const record: PersistedVault = currentContext ? await encryptVault(currentData, currentContext) : { mode: 'plain', data: currentData }
      await savePersistedVault(record)
      downloadJson(record)
      showToast(`备份已导出（包含 ${currentData.accounts.length} 个账号）`)
    } catch {
      showToast('备份导出失败，当前数据未改变', 'error')
    }
  }

  const confirmBackupImport = (record: PersistedVault, incomingCount: number) => {
    const currentCount = latestDataRef.current?.accounts.length ?? 0
    const securityChange = record.mode === 'encrypted'
      ? '导入后将使用备份文件的主密码解锁。'
      : encryption
        ? '该备份未加密，导入后会关闭当前本机锁。'
        : '该备份未加密。'
    setConfirmOptions({
      title: '导入备份确认',
      message: <>将用备份中的 {incomingCount} 个账号覆盖当前 {currentCount} 个账号。{securityChange}<br />建议先取消并导出当前备份。</>,
      confirmText: '覆盖并导入',
      cancelText: '先取消并备份',
      danger: true,
      icon: 'alert',
      onConfirm: async () => {
        try {
          await flushSave()
          await savePersistedVault(record)
          window.location.reload()
        } catch {
          showToast('导入失败，当前数据未被替换', 'error')
        }
      },
    })
  }

  const importBackup = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const record: PersistedVault = isPersistedVault(parsed)
        ? parsed
        : isVaultData(parsed)
          ? { mode: 'plain', data: parsed }
          : (() => { throw new Error('不是有效的账号库备份文件') })()
      if (record.mode === 'encrypted') {
        setPendingEncryptedImport(record)
      } else {
        confirmBackupImport(record, record.data.accounts.length)
      }
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : '无法导入备份', true)
    }
  }

  const clearData = async () => {
    const count = data?.accounts.length ?? 0
    if (!data) return
    setConfirmOptions({
      title: '清空全部数据',
      message: `确定清空全部 ${count} 个账号和所有自定义标签吗？此操作无法撤销。`,
      confirmText: '清空全部',
      danger: true,
      icon: 'trash',
      onConfirm: async () => {
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        const empty = createEmptyVault()
        setData(empty)
        latestDataRef.current = empty
        setSelectedView(empty.boards[0]?.id ?? 'all')
        setSelectedAccountId('')
        try {
          await flushSave()
          showToast('全部数据已清空')
        } catch {
          showToast('清空后的状态尚未保存，请点击顶部重试', 'error')
        }
      },
    })
  }

  const resetToSeedData = () => {
    setConfirmOptions({
      title: '载入精选演示账号',
      message: '确定要载入 8 个精选平台演示账号（Claude、Cursor、Gemini、OpenAI、Azure 等）吗？当前现有账号将被替换。',
      confirmText: '载入演示账号',
      cancelText: '取消',
      danger: false,
      icon: 'alert',
      onConfirm: async () => {
        if (debounceTimerRef.current) {
          window.clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        const seed = createDemoVault()
        setData(seed)
        latestDataRef.current = seed
        setSelectedView('all')
        setSelectedAccountId('')
        try {
          await flushSave()
          showToast('已成功载入 8 个精选演示账号')
        } catch {
          showToast('演示账号已载入，但尚未写入本地数据库', 'error')
        }
      },
    })
  }

  if (bootError) {
    return <main className="fatal-screen"><h1>无法打开账号库</h1><p>{bootError}</p></main>
  }
  if (!ready) return <main className="loading-screen"><div className="brand-mark large"><span /><span /><span /><span /></div><p>正在打开账号库</p></main>
  if (lockedPayload && !data) {
    return <LockScreen onUnlock={async (password) => {
      const unlocked = await unlockVault(lockedPayload, password)
      setEncryption(unlocked.context)
      setData(unlocked.data)
      setLockedPayload(null)
    }} />
  }
  if (!data) return null

  const editingAccount = accountDialog && accountDialog !== 'new' ? data.accounts.find((account) => account.id === accountDialog) ?? null : null
  const editingBoard = boardDialog && boardDialog !== 'new' ? data.boards.find((board) => board.id === boardDialog) ?? null : null
  const hasSelectedAccount = Boolean(selectedAccount && !specialView)

  return (
    <div className={`app-shell ${specialView ? 'special-view' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${!hasSelectedAccount ? 'inspector-closed' : 'inspector-open'}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="topbar">
        <div className={`brand ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="brand-mark" title="账号库"><span /><span /><span /><span /></div>
          {!sidebarCollapsed && <div className="brand-name"><strong>账号库</strong><span>ACCOUNT VAULT</span></div>}
          <IconButton
            className="sidebar-toggle-btn"
            label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </IconButton>
        </div>
        <div className="topbar-center">
          <label className="search-box">
            <Search size={19} />
            <input
              ref={searchRef}
              value={search}
              onFocus={() => specialView && setSelectedView('all')}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchScopeLabel === '全部账号' ? '搜索全部账号、邮箱或标签' : `搜索${searchScopeLabel}中的账号、邮箱或标签`}
              aria-label={searchScopeLabel === '全部账号' ? '搜索全部账号、邮箱或标签' : `搜索${searchScopeLabel}中的账号、邮箱或标签`}
            />
            {search ? (
              <button
                type="button"
                className="search-clear-btn"
                aria-label="清除搜索"
                title="清除搜索 (Esc)"
                onClick={(e) => {
                  e.preventDefault()
                  setSearch('')
                  searchRef.current?.focus()
                }}
              >
                <X size={15} />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </label>
        </div>
        <div className="topbar-actions">
          {saveStatus === 'error' ? (
            <button type="button" className="save-indicator error save-retry" aria-label="保存失败，点击重试" onClick={() => void flushSave().catch(() => showToast('保存仍然失败，输入已保留', 'error'))}>保存失败，重试</button>
          ) : (
            <span className={`save-indicator ${saveStatus}`} role="status" aria-live="polite" aria-atomic="true">{saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? <><Check size={14} />已保存</> : '准备保存'}</span>
          )}

          <div className="topbar-tools-divider" />

          {/* 眼睛：部分隐藏/显示邮箱 开关 */}
          <button
            type="button"
            className={`button ghost mask-toggle-btn ${maskEmailEnabled ? 'is-masked' : ''}`}
            onClick={toggleMaskEmail}
            title={maskEmailEnabled ? '当前已部分隐藏邮箱（防窥），点击显示完整邮箱' : '点击部分隐藏邮箱（脱敏防窥保护）'}
            aria-label={maskEmailEnabled ? '显示完整邮箱' : '部分隐藏邮箱'}
          >
            {maskEmailEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>{maskEmailEnabled ? '隐藏邮箱' : '显示邮箱'}</span>
          </button>

          {/* 常用功能 下拉菜单 */}
          <div className="common-tools-wrapper" ref={commonMenuRef}>
            <button
              type="button"
              className={`button secondary common-tools-btn ${commonMenuOpen ? 'is-active' : ''}`}
              onClick={() => setCommonMenuOpen((prev) => !prev)}
              title="常用功能与实用工具箱"
            >
              <Wrench size={15} />
              <span>常用功能</span>
              <ChevronDown size={13} className={commonMenuOpen ? 'rotate-180' : ''} />
            </button>
            {commonMenuOpen && (
              <div className="context-menu common-tools-dropdown" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setCommonMenuOpen(false)
                    toggleMaskEmail()
                  }}
                >
                  {maskEmailEnabled ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span>{maskEmailEnabled ? '显示完整邮箱' : '部分隐藏邮箱（脱敏）'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommonMenuOpen(false)
                    void exportBackup()
                  }}
                >
                  <Download size={15} />
                  <span>一键导出备份 (JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommonMenuOpen(false)
                    const allEmails = data.accounts.map((a) => a.identifier).filter(Boolean).join('\n')
                    navigator.clipboard.writeText(allEmails).then(() => {
                      showToast(`已批量复制 ${data.accounts.length} 个邮箱到剪贴板`, 'success')
                    })
                  }}
                >
                  <Copy size={15} />
                  <span>批量复制所有邮箱清单</span>
                </button>
                <div className="menu-divider" />
                <button
                  type="button"
                  onClick={() => {
                    setCommonMenuOpen(false)
                    setSelectedView('tags')
                  }}
                >
                  <Tags size={15} />
                  <span>标签库管理</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommonMenuOpen(false)
                    setSelectedView('settings')
                  }}
                >
                  <Settings size={15} />
                  <span>设置与本地锁</span>
                </button>
              </div>
            )}
          </div>

          <button type="button" className="button secondary scan-button" onClick={() => setImportFile(null)}><ImagePlus size={17} />截图导入</button>
          <button className="button primary" type="button" onClick={() => setAccountDialog('new')}><Plus size={18} />添加账号</button>
        </div>
      </header>

      <nav className="sidebar" aria-label="账号板块">
        <div className="sidebar-main">
          <button
            className={`nav-item ${selectedView === 'all' ? 'is-active' : ''}`}
            type="button"
            aria-current={selectedView === 'all' ? 'page' : undefined}
            title={sidebarCollapsed ? `全部账号 (${data.accounts.length})` : undefined}
            onClick={() => setSelectedView('all')}
          >
            <Inbox size={18} /><span>全部账号</span><b>{data.accounts.length}</b>
          </button>
          {!sidebarCollapsed && <div className="nav-section-label">邮箱板块</div>}
          {sidebarCollapsed && <div className="sidebar-divider" />}
          {data.boards.map((board) => {
            const count = data.accounts.filter((account) => account.boardId === board.id).length
            return (
              <div className="board-nav-wrap" key={board.id}>
                <button
                  className={`nav-item board-nav ${selectedView === board.id ? 'is-active' : ''} ${dragOverBoardId === board.id ? 'is-drop-target' : ''}`}
                  type="button"
                  aria-current={selectedView === board.id ? 'page' : undefined}
                  title={sidebarCollapsed ? `${board.name} (${count})` : undefined}
                  onClick={() => { setSelectedView(board.id); setBoardMenuId(null) }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('application/x-account-id')) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverBoardId(board.id)
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverBoardId((curr) => curr === board.id ? null : curr)
                    }
                  }}
                  onDrop={(e) => {
                    setDragOverBoardId(null)
                    const sourceId = e.dataTransfer.getData('application/x-account-id')
                    if (sourceId) {
                      e.preventDefault()
                      updateAccount(sourceId, { boardId: board.id })
                      showToast(`已移动到“${board.name}”`)
                    }
                  }}
                >
                  <span className="board-square" style={{ backgroundColor: board.color }} />
                  <span>{board.name}</span><b>{count}</b>
                </button>
                {!sidebarCollapsed && (
                  <IconButton label={`${board.name}操作`} className="board-more" onClick={() => setBoardMenuId((current) => current === board.id ? null : board.id)}>
                    <MoreHorizontal size={16} />
                  </IconButton>
                )}
                {boardMenuId === board.id && (
                  <div className="context-menu board-context-menu">
                    <button type="button" onClick={() => { setBoardDialog(board.id); setBoardMenuId(null) }}><Pencil size={15} />重命名</button>
                    <button type="button" className="danger-menu-item" onClick={() => { setBoardMenuId(null); deleteBoard(board) }}><Trash2 size={15} />删除</button>
                  </div>
                )}
              </div>
            )
          })}
          <button
            className="nav-item subtle-nav"
            type="button"
            title={sidebarCollapsed ? '新建板块' : undefined}
            onClick={() => setBoardDialog('new')}
          >
            <FolderPlus size={18} /><span>新建板块</span>
          </button>
          <div className="sidebar-divider" />
          <button
            className={`nav-item ${selectedView === 'tags' ? 'is-active' : ''}`}
            type="button"
            aria-current={selectedView === 'tags' ? 'page' : undefined}
            title={sidebarCollapsed ? `标签库 (${data.tags.length})` : undefined}
            onClick={() => setSelectedView('tags')}
          >
            <Tags size={18} /><span>标签库</span><b>{data.tags.length}</b>
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${selectedView === 'settings' ? 'is-active' : ''}`}
            type="button"
            aria-current={selectedView === 'settings' ? 'page' : undefined}
            title={sidebarCollapsed ? '设置与备份' : undefined}
            onClick={() => setSelectedView('settings')}
          >
            <Settings size={18} /><span>设置与备份</span>
          </button>
          <div className="local-status" title={encryption ? '本机加密已开启：解锁后即可直接复制' : '仅保存在此浏览器：可在设置中开启本机锁'}>
            <ShieldCheck size={17} />
            <div>
              <strong>{encryption ? '本机加密已开启' : '仅保存在此浏览器'}</strong>
              <span>{encryption ? '解锁后即可直接复制' : '可在设置中开启本机锁'}</span>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content" className="main-view">
        {selectedView === 'tags' ? (
          <TagLibraryView
            tags={data.tags}
            accounts={data.accounts}
            onCreate={createTagOnly}
            onUpdate={(tagId, update) => commitData({ ...data, tags: data.tags.map((tag) => tag.id === tagId ? { ...tag, ...update } : tag) })}
            onDelete={deleteTag}
            onCleanUnused={cleanUnusedTags}
            onWarn={(msg) => showToast(msg, true)}
          />
        ) : selectedView === 'settings' ? (
          <SettingsView
            data={data}
            encrypted={Boolean(encryption)}
            saveStatus={saveStatus}
            onSetPassword={enableEncryption}
            onLock={() => void lockNow()}
            onExport={() => void exportBackup()}
            onImport={(file) => void importBackup(file)}
            onClear={clearData}
            onResetSeed={resetToSeedData}
          />
        ) : (
          <section
            className="accounts-view"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseInspector()
              }
            }}
          >
            <header className="accounts-header">
              <div className="accounts-heading">
                <div><span className="eyebrow">我的空间 / 账号管理</span><h1>{activeBoard?.name ?? '全部账号'}<span className="heading-count">{visibleAccounts.length}</span></h1><p>账号、会员和常用内容，都在这里。</p></div>
              </div>
              <SelectMenu
                className="sort-control"
                value={sortMode}
                label="账号排序方式"
                leading={<ArrowUpDown size={16} />}
                options={[
                  { value: 'custom', label: '自定义排序' },
                  { value: 'updated', label: '最近修改' },
                  { value: 'name', label: '账号名称' },
                  { value: 'created', label: '创建时间' },
                ]}
                onChange={(value) => setSortMode(value as SortMode)}
              />
            </header>
            {search.trim() && selectedView !== 'all' && (
              <div className="search-scope-bar" role="status">
                <div className="search-scope-info">
                  <span>当前仅在板块<strong>“{activeBoard?.name}”</strong>中搜索（找到 {visibleAccounts.length} 个结果）</span>
                </div>
                <div className="search-scope-actions">
                  <button type="button" className="search-scope-action" onClick={() => setSelectedView('all')}>
                    在全部账号中搜索
                  </button>
                  <button type="button" className="search-scope-action secondary" onClick={() => setSearch('')}>
                    清除筛选
                  </button>
                </div>
              </div>
            )}
            {visibleAccounts.length === 0 ? (
              <EmptyState
                title={search ? '没有匹配的账号' : '这个板块还没有账号'}
                action={
                  search ? (
                    <button className="button secondary" type="button" onClick={() => setSearch('')}>
                      清除搜索
                    </button>
                  ) : (
                    <button className="button primary" type="button" onClick={() => setAccountDialog('new')}>
                      <Plus size={16} />添加账号
                    </button>
                  )
                }
              />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleGridDragStart}
                onDragEnd={handleGridDragEnd}
                onDragCancel={handleGridDragCancel}
              >
                <SortableContext
                  items={visibleAccounts.map((a) => a.id)}
                  strategy={rectSortingStrategy}
                  disabled={sortMode !== 'custom'}
                >
                  <div className="account-grid">
                    {visibleAccounts.map((account) => (
                      <SortableAccountCard
                        key={account.id}
                        account={account}
                        tags={data.tags}
                        board={data.boards.find((board) => board.id === account.boardId)}
                        showBoardBadge={selectedView === 'all'}
                        selected={account.id === selectedAccountId}
                        disabled={sortMode !== 'custom'}
                        maskEmail={maskEmailEnabled}
                        onSelect={() => {
                          setClosingAccount(null)
                          setSelectedAccountId(account.id)
                        }}
                        onEdit={() => setAccountDialog(account.id)}
                        onDelete={() => removeAccount(account)}
                        onCopyIdentifier={(val) => void copyText(val, '账号')}
                      />
                    ))}
                  </div>
                </SortableContext>
                {typeof document !== 'undefined' && createPortal(
                  <DragOverlay
                    dropAnimation={{
                      sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                          active: {
                            opacity: '0.3',
                          },
                        },
                      }),
                    }}
                  >
                    {activeAccount ? (
                      <div className="account-drag-overlay-card">
                        <AccountCard
                          account={activeAccount}
                          tags={data.tags}
                          board={data.boards.find((b) => b.id === activeAccount.boardId)}
                          showBoardBadge={selectedView === 'all'}
                          selected={activeAccount.id === selectedAccountId}
                          maskEmail={maskEmailEnabled}
                          onSelect={() => {}}
                          onEdit={() => {}}
                          onDelete={() => {}}
                          isOverlay
                        />
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body
                )}
              </DndContext>
            )}
            <button type="button" className="import-hint" onClick={() => setImportFile(null)}><ImagePlus size={18} /><span>账号太多？粘贴截图，批量整理。</span><kbd>Ctrl V</kbd></button>
          </section>
        )}
      </main>

      {!specialView && (
        <AccountInspector
          account={selectedAccount}
          boards={data.boards}
          tags={data.tags}
          maskEmail={maskEmailEnabled}
          onUpdate={(update, options) => selectedAccount && updateAccount(selectedAccount.id, update, options?.touchUpdatedAt ?? true)}
          onEdit={() => selectedAccount && setAccountDialog(selectedAccount.id)}
          onDelete={() => selectedAccount && removeAccount(selectedAccount)}
          onCopy={(value, label) => void copyText(value, label)}
          onAddCopyItem={() => setCopyItemDialog('new')}
          onEditCopyItem={(item) => setCopyItemDialog(item)}
          onDeleteCopyItem={(item) => {
            if (!selectedAccount) return
            updateAccount(selectedAccount.id, { copyItems: selectedAccount.copyItems.filter((current) => current.id !== item.id) })
            showToast(`已删除“${item.label}”`)
          }}
          onToggleTag={(tagId) => selectedAccount && updateAccount(selectedAccount.id, {
            tagIds: selectedAccount.tagIds.includes(tagId) ? selectedAccount.tagIds.filter((id) => id !== tagId) : [...selectedAccount.tagIds, tagId],
          })}
          onCreateTag={createAndAssignTag}
          onClose={handleCloseInspector}
        />
      )}

      {closingAccount && !hasSelectedAccount && !specialView && (
        <AccountInspector
          account={closingAccount}
          boards={data.boards}
          tags={data.tags}
          maskEmail={maskEmailEnabled}
          isClosing={true}
          onUpdate={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onCopy={() => {}}
          onAddCopyItem={() => {}}
          onEditCopyItem={() => {}}
          onDeleteCopyItem={() => {}}
          onToggleTag={() => {}}
          onCreateTag={() => {}}
        />
      )}

      {accountDialog && (
        <AccountDialog
          key={accountDialog}
          account={editingAccount}
          boards={data.boards}
          tags={data.tags}
          defaultBoardId={defaultBoardId}
          onClose={() => setAccountDialog(null)}
          onSave={saveAccount}
        />
      )}
      {boardDialog && <BoardDialog key={boardDialog} board={editingBoard} onClose={() => setBoardDialog(null)} onSave={saveBoard} />}
      {deleteMigrationTarget && (
        <DeleteBoardMigrationDialog
          board={deleteMigrationTarget.board}
          boards={data.boards}
          accountCount={deleteMigrationTarget.count}
          onClose={() => setDeleteMigrationTarget(null)}
          onConfirm={confirmBoardMigrationAndDelete}
        />
      )}
      {pendingEncryptedImport && (
        <BackupPasswordDialog
          onClose={() => setPendingEncryptedImport(null)}
          onValidate={async (password) => {
            const unlocked = await unlockVault(pendingEncryptedImport.payload, password)
            const record = pendingEncryptedImport
            setPendingEncryptedImport(null)
            confirmBackupImport(record, unlocked.data.accounts.length)
          }}
        />
      )}
      {copyItemDialog && (
        <CopyItemDialog
          key={copyItemDialog === 'new' ? 'new' : copyItemDialog.id}
          item={copyItemDialog === 'new' ? null : copyItemDialog}
          onClose={() => setCopyItemDialog(null)}
          onSave={saveCopyItem}
          onDelete={
            copyItemDialog !== 'new' && selectedAccount
              ? () => {
                  updateAccount(selectedAccount.id, {
                    copyItems: selectedAccount.copyItems.filter((current) => current.id !== copyItemDialog.id),
                  })
                  setCopyItemDialog(null)
                  showToast('已删除复制内容')
                }
              : undefined
          }
        />
      )}
      {importFile !== undefined && (
        <ScreenshotImportDialog
          initialFile={importFile}
          boards={data.boards}
          existingAccounts={data.accounts}
          defaultBoardId={defaultBoardId}
          onClose={() => setImportFile(undefined)}
          onImport={importRecognizedAccounts}
        />
      )}
      <ConfirmModal options={confirmOptions} onClose={() => setConfirmOptions(null)} />

      {toasts.length > 0 && (
        <div className="toast-container" role="region" aria-label="通知提示">
          {toasts.map((item) => (
            <div key={item.id} className={`toast-pill is-${item.type}`} role="status" aria-live="polite">
              <div className="toast-icon-wrap">
                {(item.type === 'copy' || item.type === 'success') && <Check size={12} strokeWidth={2.5} />}
                {item.type === 'info' && <Info size={12} strokeWidth={2.5} />}
                {item.type === 'error' && <AlertTriangle size={12} strokeWidth={2.5} />}
              </div>
              <span className="toast-text">{item.message}</span>
              <button
                type="button"
                className="toast-close-btn"
                aria-label="关闭通知"
                onClick={() => dismissToast(item.id)}
              >
                <X size={11} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
