import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  CopyCheck,
  Database,
  Download,
  Eye,
  EyeOff,
  FileUp,
  FolderPlus,
  GripVertical,
  Inbox,
  KeyRound,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Star,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import type { Account, Board, CopyItem, Tag, VaultData } from '../types'
import { formatAccountAge, formatUpdatedAt, sameTagName, TAG_COLORS, colorFromName, generateTOTP, analyzeTwoFactor, isGeminiProTag, makeId, maskIdentifier } from '../utils'
import { autoDetectCopyIcon, getCopyIconComponent } from '../copy-icons'
import { Avatar, EmptyState, IconButton, Modal, TagChip } from './Common'

function maskedValue(value: string): string {
  const length = Math.min(16, Math.max(8, value.length))
  return '•'.repeat(length)
}

function CopyBoxSnippetItem({
  item,
  isRevealed,
  isCopied,
  onToggleReveal,
  onCopy,
  onEdit,
  onDelete,
  dragHandleProps,
  isOverlay,
}: {
  item: CopyItem
  isRevealed: boolean
  isCopied: boolean
  onToggleReveal: () => void
  onCopy: (value: string, label: string) => void
  onEdit: () => void
  onDelete: () => void
  dragHandleProps?: Record<string, any>
  isOverlay?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const detected = autoDetectCopyIcon(item.label, item.value)
  const resolvedIcon = item.icon || detected.icon
  const resolvedColor = item.color || detected.color
  const DisplayIcon = getCopyIconComponent(resolvedIcon)

  return (
    <article
      className={`copybox-item-card ${isCopied ? 'is-copied' : ''} ${isOverlay ? 'is-overlay' : ''}`}
      data-id={item.id}
      role="group"
      aria-label={`复制${item.label || '快捷内容'}`}
      onClick={isOverlay ? undefined : () => onCopy(item.value, item.label)}
      title={isOverlay ? undefined : '点击整行直接复制'}
    >
      <div
        className="copybox-drag-handle"
        title="按住上下拖动调整顺序"
        {...dragHandleProps}
        onClick={(e) => {
          e.stopPropagation()
          dragHandleProps?.onClick?.(e)
        }}
      >
        <GripVertical size={13} />
      </div>

      <div
        className="copybox-icon-badge"
        style={{ backgroundColor: `${resolvedColor}14`, color: resolvedColor }}
        title={item.label}
      >
        <DisplayIcon size={14} />
      </div>

      <div className="copybox-info-col">
        {item.label && (
          <div className="copybox-title-line" title={item.label}>
            <span className="copybox-title">{item.label}</span>
          </div>
        )}
        <div className="copybox-content-line" title={item.sensitive ? '敏感内容' : item.value}>
          {item.sensitive && !isRevealed ? (
            <span className="copybox-masked">{maskedValue(item.value)}</span>
          ) : (
            <span className="copybox-text">{item.value}</span>
          )}
        </div>
        {item.note && (
          <div className="copybox-note-line" title={item.note}>
            {item.note}
          </div>
        )}
      </div>

      <div className="copybox-actions" onClick={(e) => e.stopPropagation()}>
        {item.sensitive && (
          <button
            type="button"
            className="copybox-btn subtle"
            aria-label={isRevealed ? '隐藏内容' : '显示内容'}
            title={isRevealed ? '隐藏明文' : '查看明文'}
            disabled={isOverlay}
            onClick={isOverlay ? undefined : onToggleReveal}
          >
            {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}

        <button
          type="button"
          className="copybox-btn subtle"
          aria-label="编辑内容"
          title="编辑"
          disabled={isOverlay}
          onClick={isOverlay ? undefined : onEdit}
        >
          <Pencil size={13} />
        </button>

        <button
          type="button"
          className={`copybox-btn danger ${confirmDelete ? 'is-confirming' : ''}`}
          aria-label="删除内容"
          title={confirmDelete ? '再次点击确认删除' : '删除'}
          disabled={isOverlay}
          onClick={() => {
            if (isOverlay) return
            if (confirmDelete) {
              onDelete()
            } else {
              setConfirmDelete(true)
              setTimeout(() => setConfirmDelete(false), 2400)
            }
          }}
        >
          <Trash2 size={13} />
          {confirmDelete && <span className="confirm-delete-text">确认</span>}
        </button>

        <button
          type="button"
          className={`copybox-btn copy-main ${isCopied ? 'is-copied' : ''}`}
          aria-label={`复制${item.label}`}
          title={isCopied ? '已复制' : '复制内容'}
          disabled={isOverlay}
          onClick={isOverlay ? undefined : () => onCopy(item.value, item.label)}
        >
          {isCopied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} />}
        </button>
      </div>
    </article>
  )
}

function SortableCopyBoxItem(props: {
  item: CopyItem
  isRevealed: boolean
  isCopied: boolean
  onToggleReveal: () => void
  onCopy: (value: string, label: string) => void
  onEdit: () => void
  onDelete: () => void
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
    id: props.item.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-copybox-wrapper ${isDragging ? 'is-placeholder' : ''}`}
    >
      <CopyBoxSnippetItem
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


function isSensitiveGuess(label: string, value: string): boolean {
  const text = `${label} ${value}`.toLowerCase()
  return /pass|pwd|密码|token|secret|key|pin|凭据|密钥|cvv/.test(text)
}

export function AccountInspector({
  account,
  boards,
  tags,
  onUpdate,
  onEdit,
  onDelete,
  onCopy,
  onAddCopyItem,
  onEditCopyItem,
  onDeleteCopyItem,
  onToggleTag,
  onCreateTag,
  onClose,
  isClosing,
  maskEmail = false,
}: {
  account: Account | null
  boards?: Board[]
  tags: Tag[]
  isClosing?: boolean
  maskEmail?: boolean
  onUpdate: (update: Partial<Account>, options?: { touchUpdatedAt?: boolean }) => void
  onEdit: () => void
  onDelete: () => void
  onCopy: (value: string, label: string) => void
  onAddCopyItem: () => void
  onEditCopyItem: (item: CopyItem) => void
  onDeleteCopyItem: (item: CopyItem) => void
  onToggleTag: (tagId: string) => void
  onCreateTag: (name: string) => void
  onClose?: () => void
}) {
  const [tagOpen, setTagOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [identifierCopied, setIdentifierCopied] = useState(false)
  const [inspectorReveal, setInspectorReveal] = useState(false)
  const [inlineAddOpen, setInlineAddOpen] = useState(false)
  const [inlineLabel, setInlineLabel] = useState('')
  const [inlineValue, setInlineValue] = useState('')
  const [inlineNote, setInlineNote] = useState('')
  const [inlineSensitive, setInlineSensitive] = useState(false)
  const [localNotes, setLocalNotes] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
  const [reveal2FA, setReveal2FA] = useState(false)
  const [revealBackupCode, setRevealBackupCode] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [twoFactorCopied, setTwoFactorCopied] = useState(false)
  const [totpCodeCopied, setTotpCodeCopied] = useState(false)
  const [backupCodeCopied, setBackupCodeCopied] = useState(false)
  const [editingField, setEditingField] = useState<'password' | 'twoFactor' | 'backupCode' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [totpData, setTotpData] = useState<{ code: string; remainingSeconds: number } | null>(null)
  const tagPopoverRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const inlineInputRef = useRef<HTMLTextAreaElement>(null)

  const currentBoard = useMemo(() => {
    if (!account || !boards) return null
    return boards.find((b) => b.id === account.boardId) ?? null
  }, [account?.boardId, boards])

  useEffect(() => {
    let active = true
    if (!account?.twoFactor) {
      setTotpData(null)
      return
    }
    const updateTotp = async () => {
      if (!account?.twoFactor) return
      const res = await generateTOTP(account.twoFactor)
      if (active) setTotpData(res)
    }
    void updateTotp()
    const timer = window.setInterval(updateTotp, 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [account?.twoFactor])

  useEffect(() => {
    setRevealed(new Set())
    setTagOpen(false)
    setTagQuery('')
    setMenuOpen(false)
    setIdentifierCopied(false)
    setInspectorReveal(false)
    setInlineAddOpen(false)
    setRevealPassword(false)
    setReveal2FA(false)
    setRevealBackupCode(false)
    setPasswordCopied(false)
    setTwoFactorCopied(false)
    setTotpCodeCopied(false)
    setBackupCodeCopied(false)
    setEditingField(null)
    setEditValue('')
    setShowEditPassword(false)
    setLocalNotes(account?.notes ?? '')
  }, [account?.id])

  useEffect(() => {
    if (account && account.notes !== localNotes) {
      setLocalNotes(account.notes)
    }
  }, [account?.notes])

  const [activeCopyItemId, setActiveCopyItemId] = useState<string | null>(null)

  const copySensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleCopyDragStart = (event: DragStartEvent) => {
    setActiveCopyItemId(String(event.active.id))
  }

  const handleCopyDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCopyItemId(null)
    if (!over || active.id === over.id || !account) return

    const oldIndex = account.copyItems.findIndex((item) => item.id === active.id)
    const newIndex = account.copyItems.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const nextItems = [...account.copyItems]
    const [moved] = nextItems.splice(oldIndex, 1)
    nextItems.splice(newIndex, 0, moved)
    onUpdate({ copyItems: nextItems }, { touchUpdatedAt: false })
  }

  const handleCopyDragCancel = () => {
    setActiveCopyItemId(null)
  }

  const activeCopyItem = useMemo(() => {
    if (!activeCopyItemId || !account) return null
    return account.copyItems.find((i) => i.id === activeCopyItemId) ?? null
  }, [activeCopyItemId, account])

  const handleCopyAll = () => {
    if (!account) return
    const lines: string[] = []
    lines.push(`【账号】${account.name}`)
    if (account.identifier) {
      lines.push(`【登录凭据】${account.identifier}`)
    }
    if (account.password) {
      lines.push(`【登录密码】${account.password}`)
    }
    if (account.twoFactor) {
      lines.push(`【两步验证(2FA)】${account.twoFactor}`)
    }
    if (account.backupCode) {
      lines.push(`【应急备用码】${account.backupCode}`)
    }
    if (account.copyItems && account.copyItems.length > 0) {
      lines.push(`--- 快捷复制 ---`)
      account.copyItems.forEach((item) => {
        const noteStr = item.note ? ` (${item.note})` : ''
        lines.push(`${item.label || '内容'}: ${item.value}${noteStr}`)
      })
    }
    if (account.notes) {
      lines.push(`--- 备注 ---`)
      lines.push(account.notes)
    }
    const fullText = lines.join('\n')
    onCopy(fullText, '全部凭据')
    setCopiedAll(true)
    window.setTimeout(() => setCopiedAll(false), 1500)
  }

  const handleNotesChange = (newNotes: string) => {
    setLocalNotes(newNotes)
    if (account) onUpdate({ notes: newNotes }, { touchUpdatedAt: false })
  }

  useEffect(() => {
    if (!tagOpen) return
    const close = (event: MouseEvent) => {
      if (!tagPopoverRef.current?.contains(event.target as Node)) setTagOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [tagOpen])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  const availableTags = useMemo(
    () => tags.filter((tag) => tag.name.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase())),
    [tagQuery, tags],
  )

  if (!account) {
    return (
      <aside className="inspector inspector-empty">
        <EmptyState title="选择一个账号查看详情" />
      </aside>
    )
  }

  const assignedTags = account.tagIds.map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is Tag => Boolean(tag))
  const geminiTag = tags.find((tag) => isGeminiProTag(tag.name))
  const hasGeminiTag = assignedTags.some((tag) => isGeminiProTag(tag.name))

  return (
    <aside className={`inspector ${isClosing ? 'is-closing' : ''}`}>
      <div className="inspector-scroll">
        <div className="inspector-top-bar">
          <div className="inspector-title-group">
            <span className="inspector-caption">账号详情</span>
            {currentBoard && (
              <span className="inspector-board-badge" title={`归属板块：${currentBoard.name}`}>
                <span className="inspector-board-dot" style={{ backgroundColor: currentBoard.color }} />
                <span>{currentBoard.name}</span>
              </span>
            )}
          </div>
          <div className="identity-actions">
            <IconButton
              label={account.favorite ? '取消常用' : '设为常用'}
              className={account.favorite ? 'is-active' : ''}
              onClick={() => onUpdate({ favorite: !account.favorite })}
            >
              <Star size={17} fill={account.favorite ? 'currentColor' : 'none'} />
            </IconButton>
            <IconButton label="编辑账号" onClick={onEdit}>
              <Pencil size={16} />
            </IconButton>
            <div className="inspector-more-wrap" ref={moreMenuRef}>
              <IconButton label="更多操作" onClick={() => setMenuOpen((current) => !current)}>
                <MoreHorizontal size={16} />
              </IconButton>
              {menuOpen && (
                <div className="context-menu inspector-menu" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="danger-menu-item"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                  >
                    <Trash2 size={15} />删除账号
                  </button>
                </div>
              )}
            </div>
            {onClose && (
              <IconButton label="关闭详情 (Esc)" className="inspector-close-btn" onClick={onClose}>
                <X size={16} />
              </IconButton>
            )}
          </div>
        </div>

        <section className="identity-header">
          <div className="identity-profile-row">
            <Avatar avatar={account.avatar} name={account.name} size="medium" tags={assignedTags} />
            <div className="identity-meta">
              <h2>{account.name}</h2>
              {account.identifier ? (
                <div className="inspector-identifier-group">
                  <button
                    className={`identifier-copy ${identifierCopied ? 'is-copied' : ''}`}
                    type="button"
                    onClick={() => {
                      onCopy(account.identifier, '账号')
                      setIdentifierCopied(true)
                      window.setTimeout(() => setIdentifierCopied(false), 1500)
                    }}
                    title={maskEmail && !inspectorReveal ? '点击复制完整邮箱 (已部分隐藏防窥)' : '点击复制账号/邮箱凭据'}
                  >
                    <span>{maskEmail && !inspectorReveal ? maskIdentifier(account.identifier) : account.identifier}</span>
                    {identifierCopied ? <Check size={13} strokeWidth={2.8} className="copied-icon" /> : <Copy size={13} />}
                  </button>
                  {maskEmail && (
                    <button
                      type="button"
                      className="inline-reveal-toggle"
                      onClick={() => setInspectorReveal((p) => !p)}
                      title={inspectorReveal ? '点击部分隐藏（脱敏）' : '点击显示完整邮箱'}
                      aria-label={inspectorReveal ? '隐藏部分字符' : '显示完整邮箱'}
                    >
                      {inspectorReveal ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                </div>
              ) : (
                <button className="identifier-empty" type="button" onClick={onEdit}>
                  添加邮箱或账号
                </button>
              )}
              {account.registeredAt ? (
                <div className="inspector-age-badge-row">
                  <span className="account-age-badge" title={`注册时间 / 年限：${account.registeredAt}`}>
                    <Calendar size={12} />
                    <span>{formatAccountAge(account.registeredAt)}</span>
                  </span>
                  <button type="button" className="text-button inline-edit-age" onClick={onEdit} title="修改注册年限">
                    编辑
                  </button>
                </div>
              ) : (
                <button type="button" className="text-button inline-add-age" onClick={onEdit}>
                  + 登记注册年份/年限
                </button>
              )}
            </div>
          </div>

          <div className="identity-divider" />

          <div className="identity-tags-container">
            <div className="assigned-tags">
              {assignedTags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </div>
            <div className="tag-popover-anchor" ref={tagPopoverRef}>
              <button type="button" className="text-button add-tag-button" aria-expanded={tagOpen} onClick={() => setTagOpen((current) => !current)}>
                <Plus size={14} />添加标签
              </button>
              {tagOpen && (
                <div className="tag-popover">
                  <input
                    autoFocus
                    value={tagQuery}
                    onChange={(event) => setTagQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || !tagQuery.trim()) return
                      event.preventDefault()
                      const existing = tags.find((tag) => sameTagName(tag.name, tagQuery.trim()))
                      if (existing) onToggleTag(existing.id)
                      else onCreateTag(tagQuery.trim())
                      setTagQuery('')
                      setTagOpen(false)
                    }}
                    placeholder="搜索或新建标签"
                  />
                  <div className="tag-popover-list">
                    {availableTags.map((tag) => (
                      <TagChip key={tag.id} tag={tag} selected={account.tagIds.includes(tag.id)} onClick={() => onToggleTag(tag.id)} />
                    ))}
                  </div>
                  <p className="tag-hint">Gemini Pro 标签会自动点亮头像外圈</p>
                </div>
              )}
            </div>
            {geminiTag && (
              <button
                type="button"
                className={`pro-shortcut-compact ${hasGeminiTag ? 'is-active' : ''}`}
                onClick={() => {
                  if (geminiTag) onToggleTag(geminiTag.id)
                  else onCreateTag('Gemini Pro')
                }}
                title={hasGeminiTag ? '点击移除 Gemini Pro 头像光环' : '点击添加 Gemini Pro 头像光环'}
              >
                <span>✨</span>
                <span>Gemini Pro 光环</span>
              </button>
            )}
          </div>
        </section>

        {/* 核心密码与 2FA 极简高密胶囊条 */}
        <div className="credentials-compact-strip">
          {/* 密码行 */}
          <div className={`cred-strip-row ${account.password ? 'has-val' : 'is-empty'}`}>
            <div className="cred-strip-left">
              <KeyRound size={13} className="cred-strip-icon" />
              <span className="cred-strip-label">密码</span>
              {editingField === 'password' ? (
                <form
                  className="cred-strip-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    onUpdate({ password: editValue.trim() || undefined })
                    setEditingField(null)
                    setShowEditPassword(false)
                  }}
                >
                  <input
                    autoFocus
                    type={showEditPassword ? 'text' : 'password'}
                    className="cred-strip-input"
                    value={editValue}
                    placeholder="输入登录密码..."
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cred-strip-eye-btn"
                    onClick={() => setShowEditPassword((p) => !p)}
                    title={showEditPassword ? '隐藏明文' : '查看明文'}
                    aria-label={showEditPassword ? '隐藏明文' : '查看明文'}
                  >
                    {showEditPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                  <button type="submit" className="cred-strip-save-btn">保存</button>
                  <button
                    type="button"
                    className="cred-strip-cancel-btn"
                    onClick={() => {
                      setEditingField(null)
                      setShowEditPassword(false)
                    }}
                  >
                    取消
                  </button>
                </form>
              ) : account.password ? (
                <span
                  className={`cred-strip-value ${revealPassword ? 'is-revealed' : 'is-masked'}`}
                  title={revealPassword ? account.password : '点击复制密码'}
                  onClick={() => {
                    onCopy(account.password!, '密码')
                    setPasswordCopied(true)
                    window.setTimeout(() => setPasswordCopied(false), 1500)
                  }}
                >
                  {revealPassword ? account.password : '••••••••••••'}
                </span>
              ) : (
                <button
                  type="button"
                  className="cred-strip-add-text"
                  onClick={() => {
                    setEditingField('password')
                    setEditValue('')
                  }}
                >
                  + 录入密码
                </button>
              )}
            </div>

            {editingField !== 'password' && (
              <div className="cred-strip-actions">
                {account.password ? (
                  <>
                    <button
                      type="button"
                      className="cred-mini-btn"
                      onClick={() => setRevealPassword((p) => !p)}
                      title={revealPassword ? '隐藏明文' : '查看明文'}
                      aria-label={revealPassword ? '隐藏明文' : '查看明文'}
                    >
                      {revealPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      className={`cred-mini-btn ${passwordCopied ? 'is-copied' : ''}`}
                      onClick={() => {
                        onCopy(account.password!, '密码')
                        setPasswordCopied(true)
                        window.setTimeout(() => setPasswordCopied(false), 1500)
                      }}
                      title="复制密码"
                    >
                      {passwordCopied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} />}
                      <span>{passwordCopied ? '已拷' : '复制'}</span>
                    </button>
                    <button
                      type="button"
                      className="cred-mini-btn"
                      onClick={() => {
                        setEditingField('password')
                        setEditValue(account.password || '')
                      }}
                      title="修改密码"
                    >
                      <Pencil size={11} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cred-mini-btn cred-mini-add"
                    onClick={() => {
                      setEditingField('password')
                      setEditValue('')
                    }}
                    title="录入密码"
                  >
                    <Plus size={11} />
                    <span>设置</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="cred-strip-divider" />

          {/* 2FA 行 */}
          <div className={`cred-strip-row ${account.twoFactor ? 'has-val' : 'is-empty'}`}>
            <div className="cred-strip-left">
              <ShieldCheck size={13} className="cred-strip-icon" />
              <span className="cred-strip-label">2FA</span>
              {editingField === 'twoFactor' ? (
                <form
                  className="cred-strip-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    onUpdate({ twoFactor: editValue.trim() || undefined })
                    setEditingField(null)
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    className="cred-strip-input"
                    value={editValue}
                    placeholder="输入 2FA / TOTP 密钥..."
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                  <button type="submit" className="cred-strip-save-btn">保存</button>
                  <button type="button" className="cred-strip-cancel-btn" onClick={() => setEditingField(null)}>取消</button>
                </form>
              ) : account.twoFactor ? (
                <div className="cred-strip-val-wrap">
                  {reveal2FA ? (
                    <span
                      className="cred-strip-value is-revealed"
                      title="点击复制 2FA 密钥"
                      onClick={() => {
                        onCopy(account.twoFactor!, '2FA 密钥')
                        setTwoFactorCopied(true)
                        window.setTimeout(() => setTwoFactorCopied(false), 1500)
                      }}
                    >
                      {account.twoFactor}
                    </span>
                  ) : (
                    <span
                      className="cred-strip-value is-masked"
                      title="点击复制 2FA 密钥"
                      onClick={() => {
                        onCopy(account.twoFactor!, '2FA 密钥')
                        setTwoFactorCopied(true)
                        window.setTimeout(() => setTwoFactorCopied(false), 1500)
                      }}
                    >
                      ••••••••••••
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cred-strip-add-text"
                  onClick={() => {
                    setEditingField('twoFactor')
                    setEditValue('')
                  }}
                >
                  + 配置 2FA 密钥
                </button>
              )}
            </div>

            {editingField !== 'twoFactor' && (
              <div className="cred-strip-actions">
                {account.twoFactor ? (
                  <>
                    <button
                      type="button"
                      className="cred-mini-btn"
                      onClick={() => setReveal2FA((p) => !p)}
                      title={reveal2FA ? '隐藏密钥' : '查看 2FA 密钥'}
                      aria-label={reveal2FA ? '隐藏密钥' : '查看 2FA 密钥'}
                    >
                      {reveal2FA ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      className={`cred-mini-btn ${twoFactorCopied ? 'is-copied' : ''}`}
                      onClick={() => {
                        onCopy(account.twoFactor!, '2FA 密钥')
                        setTwoFactorCopied(true)
                        window.setTimeout(() => setTwoFactorCopied(false), 1500)
                      }}
                      title="复制 2FA 密钥"
                      aria-label="复制 2FA 密钥"
                    >
                      {twoFactorCopied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      className="cred-mini-btn"
                      onClick={() => {
                        setEditingField('twoFactor')
                        setEditValue(account.twoFactor || '')
                      }}
                      title="修改 2FA"
                      aria-label="修改 2FA"
                    >
                      <Pencil size={11} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cred-mini-btn cred-mini-add"
                    onClick={() => {
                      setEditingField('twoFactor')
                      setEditValue('')
                    }}
                    title="配置 2FA"
                  >
                    <Plus size={11} />
                    <span>设置</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 动态码行 (若 2FA 配置了有效动态密钥并生成了验证码，直接展示在 2FA 正下方) */}
          {editingField !== 'twoFactor' && totpData && (
            <>
              <div className="cred-strip-divider" />
              <div
                className={`cred-strip-row cred-totp-row ${totpData.remainingSeconds <= 5 ? 'is-expiring' : ''} ${totpCodeCopied ? 'is-copied' : ''}`}
                onClick={() => {
                  onCopy(totpData.code, '2FA 动态码')
                  setTotpCodeCopied(true)
                  window.setTimeout(() => setTotpCodeCopied(false), 1500)
                }}
                title="点击直接复制 6 位动态验证码"
              >
                <div className="cred-strip-left">
                  <Sparkles size={13} className="cred-strip-icon totp" />
                  <span className="cred-strip-label">动态码</span>
                  <div className="cred-strip-val-wrap">
                    <span className="cred-totp-digits">
                      {`${totpData.code.slice(0, 3)} ${totpData.code.slice(3)}`}
                    </span>
                    {totpCodeCopied && (
                      <span className="cred-totp-tag is-copied">已复制</span>
                    )}
                  </div>
                </div>

                <div className="cred-strip-actions" onClick={(e) => e.stopPropagation()}>
                  <span className="cred-totp-sec">{totpData.remainingSeconds}s</span>
                  <div
                    className="totp-pie"
                    style={{
                      '--pie-deg': `${(totpData.remainingSeconds / 30) * 360}deg`,
                      '--pie-color': totpData.remainingSeconds <= 5 ? '#e11d48' : '#2563eb',
                    } as React.CSSProperties}
                    title={`剩余 ${totpData.remainingSeconds} 秒后刷新`}
                  />
                  <button
                    type="button"
                    className={`cred-mini-btn ${totpCodeCopied ? 'is-copied' : ''}`}
                    onClick={() => {
                      onCopy(totpData.code, '2FA 动态码')
                      setTotpCodeCopied(true)
                      window.setTimeout(() => setTotpCodeCopied(false), 1500)
                    }}
                    title="复制 6 位动态验证码"
                    aria-label="复制动态码"
                  >
                    {totpCodeCopied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="cred-strip-divider" />

          {/* 应急备用码 (Backup Code) 独立板块：位于 2FA / 动态码下方 */}
          <div className={`cred-strip-row ${account.backupCode ? 'has-val' : 'is-empty'}`}>
            <div className="cred-strip-left">
              <ShieldAlert size={13} className="cred-strip-icon backup" />
              <span className="cred-strip-label">备用码</span>
              {editingField === 'backupCode' ? (
                <form
                  className="cred-strip-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    onUpdate({ backupCode: editValue.trim() || undefined })
                    setEditingField(null)
                    setShowEditPassword(false)
                  }}
                >
                  <input
                    autoFocus
                    type={showEditPassword ? 'text' : 'password'}
                    className="cred-strip-input"
                    value={editValue}
                    placeholder="输入应急备用码..."
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cred-strip-eye-btn"
                    onClick={() => setShowEditPassword((p) => !p)}
                    title={showEditPassword ? '隐藏明文' : '查看明文'}
                    aria-label={showEditPassword ? '隐藏明文' : '查看明文'}
                  >
                    {showEditPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                  <button type="submit" className="cred-strip-save-btn">保存</button>
                  <button
                    type="button"
                    className="cred-strip-cancel-btn"
                    onClick={() => {
                      setEditingField(null)
                      setShowEditPassword(false)
                    }}
                  >
                    取消
                  </button>
                </form>
              ) : account.backupCode ? (
                <div className="cred-strip-val-wrap">
                  {revealBackupCode ? (
                    <span
                      className="cred-strip-value is-revealed"
                      title="点击复制备用码"
                      onClick={() => {
                        onCopy(account.backupCode!, '应急备用码')
                        setBackupCodeCopied(true)
                        window.setTimeout(() => setBackupCodeCopied(false), 1500)
                      }}
                    >
                      {account.backupCode}
                    </span>
                  ) : (
                    <span
                      className="cred-strip-value is-masked"
                      title="点击复制备用码"
                      onClick={() => {
                        onCopy(account.backupCode!, '应急备用码')
                        setBackupCodeCopied(true)
                        window.setTimeout(() => setBackupCodeCopied(false), 1500)
                      }}
                    >
                      ••••••••••••
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cred-strip-add-text"
                  onClick={() => {
                    setEditingField('backupCode')
                    setEditValue('')
                    setShowEditPassword(true)
                  }}
                >
                  + 配置应急备用码
                </button>
              )}
            </div>

            {editingField !== 'backupCode' && (
              <div className="cred-strip-actions">
                {account.backupCode ? (
                  <>
                    <button
                      type="button"
                      className="cred-mini-btn"
                      onClick={() => setRevealBackupCode((p) => !p)}
                      title={revealBackupCode ? '隐藏明文' : '查看备用码'}
                      aria-label={revealBackupCode ? '隐藏明文' : '查看备用码'}
                    >
                      {revealBackupCode ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      className={`cred-mini-btn ${backupCodeCopied ? 'is-copied' : ''}`}
                      onClick={() => {
                        onCopy(account.backupCode!, '应急备用码')
                        setBackupCodeCopied(true)
                        window.setTimeout(() => setBackupCodeCopied(false), 1500)
                      }}
                      title="复制备用码"
                      aria-label="复制备用码"
                    >
                      {backupCodeCopied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      className="cred-mini-btn"
                      onClick={() => {
                        setEditingField('backupCode')
                        setEditValue(account.backupCode || '')
                        setShowEditPassword(true)
                      }}
                      title="修改备用码"
                      aria-label="修改备用码"
                    >
                      <Pencil size={11} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cred-mini-btn cred-mini-add"
                    onClick={() => {
                      setEditingField('backupCode')
                      setEditValue('')
                      setShowEditPassword(true)
                    }}
                    title="配置应急备用码"
                  >
                    <Plus size={11} />
                    <span>设置</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <section className="inspector-section copybox-section">
          <div className="section-heading">
            <div className="copybox-section-title">
              <h3>快捷复制</h3>
              <span className="copybox-count-badge">{account.copyItems.length} 项</span>
            </div>
            <div className="copybox-heading-actions">
              {account.copyItems.length > 0 && (
                <button
                  type="button"
                  className={`copy-all-btn ${copiedAll ? 'is-copied' : ''}`}
                  onClick={handleCopyAll}
                  title="一键复制账号和所有快捷项"
                >
                  {copiedAll ? <Check size={13} strokeWidth={2.4} /> : <CopyCheck size={13} />}
                  <span>{copiedAll ? '已复制全部' : '复制全部'}</span>
                </button>
              )}
              <button
                type="button"
                className={`copybox-add-btn ${inlineAddOpen ? 'is-active' : ''}`}
                onClick={() => {
                  setInlineAddOpen((curr) => {
                    const next = !curr
                    if (next) setTimeout(() => inlineInputRef.current?.focus(), 60)
                    return next
                  })
                }}
                title={inlineAddOpen ? '收起录入卡' : '添加快捷复制内容'}
              >
                <Plus
                  size={14}
                  strokeWidth={2.4}
                  style={{
                    transform: inlineAddOpen ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <span>{inlineAddOpen ? '收起' : '添加内容'}</span>
              </button>
            </div>
          </div>

          {inlineAddOpen && (
            <form
              className="copybox-inline-add-card"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setInlineAddOpen(false)
                }
              }}
              onSubmit={(e) => {
                e.preventDefault()
                if (!inlineValue.trim()) return
                const newItem: CopyItem = {
                  id: makeId('copy'),
                  label: inlineLabel.trim() || '快捷项',
                  value: inlineValue.trim(),
                  note: inlineNote.trim(),
                  sensitive: inlineSensitive || isSensitiveGuess(inlineLabel, inlineValue),
                }
                onUpdate({ copyItems: [newItem, ...account.copyItems] })
                setInlineLabel('')
                setInlineValue('')
                setInlineNote('')
                setInlineSensitive(false)
                setInlineAddOpen(false)
              }}
            >
              <div className="inline-add-header">
                <div className="inline-add-title-wrap">
                  <span className="inline-add-badge">+</span>
                  <span className="inline-add-title">新增复制内容</span>
                </div>
                <button
                  type="button"
                  className="inline-add-close"
                  onClick={() => setInlineAddOpen(false)}
                  title="关闭"
                  aria-label="关闭"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="inline-preset-group">
                <span className="inline-group-hint">快捷预设：</span>
                <div className="inline-add-presets">
                  {['密码', '邮箱', 'Token', 'PIN码', '验证码', '密钥', '卡号'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`inline-preset-chip ${inlineLabel === preset ? 'is-active' : ''}`}
                      onClick={() => {
                        setInlineLabel(preset)
                        if (['密码', 'Token', 'PIN码', '密钥', '卡号'].includes(preset)) {
                          setInlineSensitive(true)
                        }
                        inlineInputRef.current?.focus()
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-field-block">
                <label className="inline-field-label">
                  <span>标题 / 标签</span>
                  <span className="inline-field-optional">（可选）</span>
                </label>
                <input
                  type="text"
                  className="inline-field-input"
                  placeholder="例如：密码 / 备用邮箱 / Token"
                  value={inlineLabel}
                  onChange={(e) => setInlineLabel(e.target.value)}
                />
              </div>

              <div className="inline-field-block">
                <label className="inline-field-label">
                  <span>复制内容</span>
                  <span className="inline-field-required">*</span>
                </label>
                <textarea
                  ref={inlineInputRef}
                  className="inline-field-textarea"
                  placeholder="请输入要保存的复制内容……"
                  rows={3}
                  value={inlineValue}
                  onChange={(e) => setInlineValue(e.target.value)}
                />
              </div>

              <div className="inline-field-block">
                <div className="inline-note-row">
                  <input
                    type="text"
                    className="inline-field-input inline-note-input"
                    placeholder="备注说明（选填）"
                    value={inlineNote}
                    onChange={(e) => setInlineNote(e.target.value)}
                  />
                  <label className="inline-checkbox-label">
                    <input
                      type="checkbox"
                      checked={inlineSensitive}
                      onChange={(e) => setInlineSensitive(e.target.checked)}
                    />
                    <span>脱敏隐藏</span>
                  </label>
                </div>
              </div>

              <div className="inline-add-actions">
                <button
                  type="button"
                  className="inline-cancel-btn"
                  onClick={() => setInlineAddOpen(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="inline-submit-btn"
                  disabled={!inlineValue.trim()}
                >
                  <Check size={13} strokeWidth={2.6} />
                  <span>保存内容</span>
                </button>
              </div>
            </form>
          )}

          {account.copyItems.length === 0 && !inlineAddOpen ? (
            <div
              className="copybox-empty-state"
              onClick={() => {
                setInlineAddOpen(true)
                setTimeout(() => inlineInputRef.current?.focus(), 60)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setInlineAddOpen(true)
                  setTimeout(() => inlineInputRef.current?.focus(), 60)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="copybox-empty-icon"><Inbox size={15} strokeWidth={1.4} /></div>
              <span className="copybox-empty-text">还没有快捷复制内容</span>
              <span className="copybox-empty-action">点击快速录入</span>
            </div>
          ) : (
            <DndContext
              sensors={copySensors}
              collisionDetection={closestCenter}
              onDragStart={handleCopyDragStart}
              onDragEnd={handleCopyDragEnd}
              onDragCancel={handleCopyDragCancel}
            >
              <SortableContext
                items={account.copyItems.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="copybox-list">
                  {account.copyItems.map((item) => (
                    <SortableCopyBoxItem
                      key={item.id}
                      item={item}
                      isRevealed={revealed.has(item.id)}
                      isCopied={copiedItemId === item.id}
                      onToggleReveal={() => {
                        setRevealed((curr) => {
                          const next = new Set(curr)
                          if (next.has(item.id)) next.delete(item.id)
                          else next.add(item.id)
                          return next
                        })
                      }}
                      onCopy={(val, lbl) => {
                        onCopy(val, lbl)
                        setCopiedItemId(item.id)
                        window.setTimeout(() => setCopiedItemId(null), 1400)
                      }}
                      onEdit={() => onEditCopyItem(item)}
                      onDelete={() => onDeleteCopyItem(item)}
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
                  {activeCopyItem ? (
                    <div className="copybox-drag-overlay">
                      <CopyBoxSnippetItem
                        item={activeCopyItem}
                        isRevealed={revealed.has(activeCopyItem.id)}
                        isCopied={false}
                        onToggleReveal={() => {}}
                        onCopy={() => {}}
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
        </section>

        <section className="inspector-section notes-section">
          <div className="notes-card">
            <div className="notes-card-header">
              <span className="notes-card-title">备忘笔记</span>
              <span className="notes-card-count">
                {localNotes.length > 0 ? `${localNotes.length} 字 · 自动保存` : '自动保存'}
              </span>
            </div>
            <textarea
              className="notes-textarea"
              value={localNotes}
              onChange={(event) => handleNotesChange(event.target.value)}
              placeholder="记录用途、续费时间、绑定手机或注意事项……"
              rows={2}
            />
          </div>
        </section>

        <div className="inspector-footer-note">
          <ShieldCheck size={13} />
          <span>保存在本机 · 最近更新于 {formatUpdatedAt(account.updatedAt)}</span>
        </div>
      </div>
    </aside>
  )
}

function TagRow({
  tag,
  allTags,
  usage,
  onUpdate,
  onDelete,
  onWarn,
}: {
  tag: Tag
  allTags: Tag[]
  usage: number
  onUpdate: (tagId: string, update: Partial<Tag>) => void
  onDelete: (tag: Tag) => void
  onWarn: (message: string) => void
}) {
  const [name, setName] = useState(tag.name)

  useEffect(() => {
    setName(tag.name)
  }, [tag.name])

  const commitName = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(tag.name)
      return
    }
    if (trimmed !== tag.name) {
      const duplicate = allTags.some(
        (t) => t.id !== tag.id && sameTagName(t.name, trimmed)
      )
      if (duplicate) {
        onWarn(`标签“${trimmed}”已存在，不能重复命名`)
        setName(tag.name)
        return
      }
      onUpdate(tag.id, { name: trimmed })
    }
  }

  return (
    <div className="tag-table-row" key={tag.id}>
      <input
        type="color"
        className="color-input"
        value={tag.color}
        aria-label={`${tag.name}的颜色`}
        onChange={(event) => onUpdate(tag.id, { color: event.target.value })}
      />
      <input
        value={name}
        aria-label="标签名称"
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            setName(tag.name)
            event.currentTarget.blur()
          }
        }}
      />
      <span>{usage} 个账号</span>
      <IconButton label="删除标签" className="danger-icon" onClick={() => onDelete(tag)}>
        <Trash2 size={17} />
      </IconButton>
    </div>
  )
}

export function TagLibraryView({
  tags,
  accounts,
  onCreate,
  onUpdate,
  onDelete,
  onCleanUnused,
  onWarn,
}: {
  tags: Tag[]
  accounts: Account[]
  onCreate: (name: string) => void
  onUpdate: (tagId: string, update: Partial<Tag>) => void
  onDelete: (tag: Tag) => void
  onCleanUnused?: () => void
  onWarn?: (message: string) => void
}) {
  const [name, setName] = useState('')
  const unusedCount = tags.filter((tag) => !accounts.some((a) => a.tagIds.includes(tag.id))).length

  const create = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const duplicate = tags.some((tag) => sameTagName(tag.name, trimmed))
    if (duplicate) {
      onWarn?.(`标签“${trimmed}”已存在`)
      return
    }
    onCreate(trimmed)
    setName('')
  }

  return (
    <section className="library-view">
      <header className="view-title">
        <div><span className="eyebrow">全局复用</span><h1>标签库</h1></div>
        {unusedCount > 0 && onCleanUnused && (
          <button
            type="button"
            className="button secondary clean-unused-tags-btn"
            onClick={onCleanUnused}
            title="一键删除所有使用账号数为 0 的无用标签"
          >
            <Trash2 size={15} />
            <span>清理无用标签 ({unusedCount})</span>
          </button>
        )}
      </header>
      <p className="library-hint"><span className="pro-ring-icon" />名为 Gemini Pro 的标签会自动为头像添加蓝色外圈；移除或改名后同步取消。</p>
      <form className="inline-create" onSubmit={create}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="输入新标签名称" />
        <button className="button primary" type="submit"><Plus size={16} />添加标签</button>
      </form>

      {tags.length === 0 ? (
        <EmptyState title="还没有标签" />
      ) : (
        <div className="tag-table">
          <div className="table-head"><span>颜色</span><span>标签名称</span><span>使用账号</span><span /></div>
          {tags.map((tag) => {
            const usage = accounts.filter((account) => account.tagIds.includes(tag.id)).length
            return (
              <TagRow
                key={tag.id}
                tag={tag}
                allTags={tags}
                usage={usage}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onWarn={onWarn ?? (() => {})}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function PasswordDialog({ encrypted, onClose, onSave }: { encrypted: boolean; onClose: () => void; onSave: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) {
      setError('主密码至少需要 6 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的主密码不一致')
      return
    }
    setSaving(true)
    try {
      await onSave(password)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法设置本机锁')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={encrypted ? '更改主密码' : '开启本机锁'}
      onClose={onClose}
      dirty={Boolean(password || confirm)}
      width="430px"
      footer={
        <>
          <button className="button secondary" data-modal-close type="button" onClick={onClose}>取消</button>
          <button className="button primary" type="submit" form="password-form" disabled={saving}>{saving ? '正在加密' : '确认'}</button>
        </>
      }
    >
      <form id="password-form" className="form-stack" onSubmit={(event) => void submit(event)}>
        <label className="field"><span>新主密码</span><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="field"><span>再次输入</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
        <p className="form-help">主密码不会上传，也无法找回。</p>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function SettingsView({
  data,
  encrypted,
  saveStatus,
  onSetPassword,
  onDisablePassword,
  onLock,
  onExport,
  onImport,
  onClear,
  onResetSeed,
  onRestoreAuthentic,
  onMigrateFrom5173,
}: {
  data: VaultData
  encrypted: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onSetPassword: (password: string) => Promise<void>
  onDisablePassword?: () => void
  onLock: () => void
  onExport: () => void
  onImport: (file: File) => void
  onClear: () => void
  onResetSeed?: () => void
  onRestoreAuthentic?: () => void
  onMigrateFrom5173?: () => void
}) {
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <section className="settings-view">
      <header className="view-title">
        <div>
          <span className="eyebrow">本机数据</span>
          <h1>设置与数据管理</h1>
        </div>
      </header>

      {/* 1. 顶部数据概览卡片 (Vault Overview Stats) */}
      <div className="vault-stats-grid">
        <div className="vault-stat-card">
          <div className="stat-icon-wrap is-account">
            <Inbox size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-number">{data.accounts.length}</span>
            <span className="stat-label">已存账号</span>
          </div>
        </div>
        <div className="vault-stat-card">
          <div className="stat-icon-wrap is-board">
            <FolderPlus size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-number">{data.boards.length}</span>
            <span className="stat-label">分类板块</span>
          </div>
        </div>
        <div className="vault-stat-card">
          <div className="stat-icon-wrap is-tag">
            <Tags size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-number">{data.tags.length}</span>
            <span className="stat-label">管理标签</span>
          </div>
        </div>
      </div>

      {/* 2. 本机密码锁 (Security Card) */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-copy">
            <div className={`card-icon-pill ${encrypted ? 'is-encrypted' : ''}`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="card-title-row">
                <h2>本机密码锁</h2>
                <span className={`security-badge ${encrypted ? 'is-active' : 'is-disabled'}`}>
                  {encrypted ? '已开启保护' : '未加密'}
                </span>
              </div>
              <p>{encrypted ? '主密码已启用，账号数据在浏览器内以 AES-GCM 强加密存储' : '当前数据直接存放在浏览器本地，设置主密码后只有输入密码才可解锁'}</p>
            </div>
          </div>
          <div className="settings-actions">
            {encrypted && (
              <>
                <button className="button secondary" type="button" onClick={onLock}>
                  <LockKeyhole size={15} />立即锁定
                </button>
                {onDisablePassword && (
                  <button className="button danger" type="button" onClick={onDisablePassword}>
                    <ShieldOff size={15} />关闭密码锁
                  </button>
                )}
              </>
            )}
            <button className="button secondary" type="button" onClick={() => setPasswordOpen(true)}>
              <KeyRound size={15} />{encrypted ? '更改主密码' : '开启本机锁'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. 备份与数据管理 (Backup & Transfer Card) */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-copy">
            <div className="card-icon-pill">
              <Database size={20} />
            </div>
            <div>
              <h2>备份与迁移</h2>
              <p>
                {saveStatus === 'error'
                  ? '本地保存失败，当前输入仍保留在页面'
                  : saveStatus === 'saving'
                  ? '正在写入本机数据库...'
                  : `所有数据保存在此浏览器（IndexedDB）；导出的备份文件${encrypted ? '包含加密密文' : '为明文 JSON'}`}
              </p>
            </div>
          </div>
          <div className="settings-actions">
            <button className="button primary" type="button" onClick={onExport}>
              <Download size={15} />导出备份 (JSON)
            </button>
            <label className="button secondary upload-button">
              <FileUp size={15} />导入备份
              <input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} />
            </label>
          </div>
        </div>

        {/* 辅助工具栏：数据恢复与迁移 */}
        {(onRestoreAuthentic || onMigrateFrom5173 || onResetSeed) && (
          <div className="settings-card-subtools">
            <span className="subtools-label">快捷迁移与恢复：</span>
            <div className="subtools-group">
              {onRestoreAuthentic && (
                <button
                  type="button"
                  className="subtool-btn"
                  onClick={onRestoreAuthentic}
                  title="恢复 21 个初始真实 Google 账号数据"
                >
                  <Check size={13} />恢复 21 个初始账号
                </button>
              )}
              {onMigrateFrom5173 && (
                <button
                  type="button"
                  className="subtool-btn"
                  onClick={onMigrateFrom5173}
                  title="自动从旧 5173 端口拉取 IndexedDB 账号"
                >
                  <RefreshCw size={13} />从 5173 迁移历史数据
                </button>
              )}
              {onResetSeed && (
                <button
                  type="button"
                  className="subtool-btn"
                  onClick={onResetSeed}
                  title="载入精选演示账号体验所有功能"
                >
                  <Sparkles size={13} />载入演示账号
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. 危险区域 (Danger Zone) */}
      <div className="settings-card is-danger">
        <div className="settings-card-header">
          <div className="settings-copy">
            <div className="card-icon-pill is-danger">
              <Trash2 size={20} />
            </div>
            <div>
              <h2>清空全部数据</h2>
              <p>删除本地所有账号和自定义标签，保留默认板块。操作不可逆，请先备份。</p>
            </div>
          </div>
          <div className="settings-actions">
            <button className="button danger" type="button" onClick={onClear}>
              <Trash2 size={15} />清空全部数据
            </button>
          </div>
        </div>
      </div>

      {passwordOpen && <PasswordDialog encrypted={encrypted} onClose={() => setPasswordOpen(false)} onSave={onSetPassword} />}
    </section>
  )
}

export function LockScreen({ onUnlock }: { onUnlock: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onUnlock(password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法解锁')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="lock-screen">
      <form className="unlock-panel" onSubmit={(event) => void submit(event)}>
        <div className="brand-mark large"><span /><span /><span /><span /></div>
        <h1>账号库已锁定</h1>
        <label className="field"><span>主密码</span><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="form-error"><AlertTriangle size={15} />{error}</p>}
        <button className="button primary full-button" type="submit" disabled={loading}>{loading ? '正在解锁' : '解锁账号库'}</button>
      </form>
    </main>
  )
}

export function makeTag(name: string): Tag {
  return { id: makeId('tag'), name, color: TAG_COLORS[Math.abs(name.length + colorFromName(name).charCodeAt(2)) % TAG_COLORS.length] }
}
