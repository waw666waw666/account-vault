import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, ImagePlus, Star, Trash2 } from 'lucide-react'
import type { Account, Avatar as AvatarValue, Board, CopyItem, Tag } from '../types'
import { imageFileToAvatar } from '../image'
import { avatarForName, AVATAR_COLORS, colorFromName, getInitial, makeId, analyzeTwoFactor } from '../utils'
import {
  autoDetectCopyIcon,
  COPY_COLOR_OPTIONS,
  COPY_ICON_OPTIONS,
  getCopyIconComponent,
} from '../copy-icons'
import { Avatar, Modal, SelectMenu, TagChip } from './Common'

export type AccountDraft = Pick<Account, 'name' | 'identifier' | 'boardId' | 'avatar' | 'tagIds' | 'notes' | 'favorite' | 'registeredAt' | 'password' | 'twoFactor'>

export function AccountDialog({
  account,
  boards,
  tags,
  defaultBoardId,
  onClose,
  onSave,
}: {
  account: Account | null
  boards: Board[]
  tags: Tag[]
  defaultBoardId: string
  onClose: () => void
  onSave: (draft: AccountDraft) => void
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [identifier, setIdentifier] = useState(account?.identifier ?? '')
  const [boardId, setBoardId] = useState(account?.boardId ?? defaultBoardId)
  const [avatar, setAvatar] = useState<AvatarValue>(account?.avatar ?? avatarForName('新'))
  const [tagIds, setTagIds] = useState<string[]>(account?.tagIds ?? [])
  const [notes, setNotes] = useState(account?.notes ?? '')
  const [favorite, setFavorite] = useState(account?.favorite ?? false)
  const [registeredAt, setRegisteredAt] = useState(account?.registeredAt ?? '')
  const [password, setPassword] = useState(account?.password ?? '')
  const [twoFactor, setTwoFactor] = useState(account?.twoFactor ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const dirty = !account
    ? Boolean(name.trim() || identifier.trim() || registeredAt.trim() || password.trim() || twoFactor.trim() || notes.trim() || tagIds.length || favorite || JSON.stringify(avatar) !== JSON.stringify(avatarForName('新')))
    : name !== account.name || identifier !== account.identifier || registeredAt !== (account.registeredAt ?? '') || password !== (account.password ?? '') || twoFactor !== (account.twoFactor ?? '') || boardId !== account.boardId || JSON.stringify(avatar) !== JSON.stringify(account.avatar) || JSON.stringify(tagIds) !== JSON.stringify(account.tagIds) || notes !== account.notes || favorite !== account.favorite

  const handleImage = async (file?: File) => {
    if (!file) return
    try {
      setAvatar(await imageFileToAvatar(file))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取头像')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) {
      setError('只需要填写账号名称')
      return
    }
    onSave({
      name: cleanName,
      identifier: identifier.trim(),
      boardId: boardId || boards[0]?.id || '',
      avatar: avatar.type === 'initial' ? { ...avatar, letter: avatar.letter.trim() || getInitial(cleanName) } : avatar,
      tagIds,
      notes: notes.trim(),
      favorite,
      registeredAt: registeredAt.trim() || undefined,
      password: password.trim() || undefined,
      twoFactor: twoFactor.trim() || undefined,
    })
  }

  return (
    <Modal
      title={account ? '编辑账号' : '添加账号'}
      onClose={onClose}
      dirty={dirty}
      width="540px"
      footer={
        <>
          <button type="button" data-modal-close className="button secondary" onClick={onClose}>取消</button>
          <button type="submit" form="account-form" className="button primary">{account ? '保存修改' : '创建账号'}</button>
        </>
      }
    >
      <form id="account-form" className="form-stack account-dialog-form" onSubmit={submit}>
        <div className="form-grid-2col">
          <label className="field">
            <span>账号名称 <b>*</b></span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：工作主号" />
          </label>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>所属板块 <b>*</b></span>
              <label className="compact-favorite-row" style={{ margin: 0, padding: 0, fontSize: '12px' }}>
                <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
                <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
                设为常用
              </label>
            </div>
            <SelectMenu
              value={boardId}
              label="选择所属板块"
              options={boards.map((board) => ({ value: board.id, label: board.name, color: board.color }))}
              onChange={setBoardId}
            />
          </div>
        </div>

        <div className="form-grid-2col">
          <label className="field">
            <span>邮箱或账号</span>
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="选填，如 user@gmail.com" />
          </label>

          <label className="field">
            <span>账号年限 / 注册年份</span>
            <input
              value={registeredAt}
              onChange={(event) => setRegisteredAt(event.target.value)}
              placeholder="例如：2021、2021年 或 5年老号"
            />
          </label>
        </div>

        <div className="form-grid-2col">
          <label className="field">
            <span>登录密码</span>
            <div className="dialog-password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="选填，例如：Pass#2024"
              />
              <button
                type="button"
                className="dialog-pwd-eye"
                onClick={() => setShowPassword((p) => !p)}
                title={showPassword ? '隐藏密码' : '显示明文'}
                aria-label={showPassword ? '隐藏密码' : '显示明文'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          <label className="field">
            <span>两步验证 (2FA / 备用码)</span>
            <input
              value={twoFactor}
              onChange={(event) => setTwoFactor(event.target.value)}
              placeholder="选填，TOTP 密钥或救援码"
            />
            {twoFactor.trim() && (() => {
              const analysis = analyzeTwoFactor(twoFactor)
              if (!analysis) return null
              return (
                <div className={`dialog-2fa-detect ${analysis.isTotp ? 'is-totp' : 'is-backup'}`}>
                  <span className="dialog-2fa-badge">
                    {analysis.isTotp ? 'TOTP 动态密钥' : '2FA 备用码'}
                  </span>
                  <span className="dialog-2fa-text">{analysis.hint}</span>
                </div>
              )
            })()}
          </label>
        </div>

        <div className="field">
          <span>头像设置</span>
          <div className="avatar-editor">
            <Avatar avatar={avatar} name={name || '新账号'} size="large" tags={tags.filter((tag) => tagIds.includes(tag.id))} />
            <div className="avatar-editor-controls">
              {avatar.type === 'initial' ? (
                <>
                  <div className="avatar-editor-row">
                    <label className="compact-letter-label">
                      <span>字母</span>
                      <input className="letter-input" maxLength={2} value={avatar.letter} onChange={(event) => setAvatar({ ...avatar, letter: event.target.value })} />
                    </label>
                    <label className="compact-color-label">
                      <span>自定义</span>
                      <input className="color-input" type="color" value={avatar.color} onChange={(event) => setAvatar({ ...avatar, color: event.target.value })} />
                    </label>
                    <div className="color-swatches" aria-label="头像颜色">
                      {AVATAR_COLORS.map((color) => (
                        <button
                          type="button"
                          key={color}
                          className={avatar.color.toUpperCase() === color ? 'is-selected' : ''}
                          style={{ backgroundColor: color }}
                          aria-label={`选择颜色 ${color}`}
                          onClick={() => setAvatar({ ...avatar, color })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="avatar-editor-row avatar-editor-actions">
                    <label className="button secondary upload-button compact-upload-btn">
                      <ImagePlus size={15} />
                      上传图片头像
                      <input type="file" accept="image/*" onChange={(event) => void handleImage(event.target.files?.[0])} />
                    </label>
                  </div>
                </>
              ) : (
                <div className="avatar-editor-row avatar-editor-actions">
                  <button type="button" className="button secondary" onClick={() => setAvatar(avatarForName(name || '新'))}>
                    改用字母头像
                  </button>
                  <label className="button secondary upload-button compact-upload-btn">
                    <ImagePlus size={15} />
                    更换图片
                    <input type="file" accept="image/*" onChange={(event) => void handleImage(event.target.files?.[0])} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="field">
            <span>标签</span>
            <div className="tag-picker">
              {tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  selected={tagIds.includes(tag.id)}
                  onClick={() => setTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}
                />
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span>备注</span>
          <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="选填，记录备注说明" />
        </label>

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function BoardDialog({
  board,
  onClose,
  onSave,
}: {
  board: Board | null
  onClose: () => void
  onSave: (name: string, color: string) => void
}) {
  const [name, setName] = useState(board?.name ?? '')
  const [color, setColor] = useState(() => board?.color ?? colorFromName(String(Date.now())))
  const [error, setError] = useState('')
  const initialColorRef = useRef(color)
  const dirty = name !== (board?.name ?? '') || color !== initialColorRef.current

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('请输入板块名称')
      return
    }
    onSave(name.trim(), color)
  }

  return (
    <Modal
      title={board ? '编辑板块' : '新建板块'}
      onClose={onClose}
      dirty={dirty}
      width="440px"
      footer={
        <>
          <button type="button" data-modal-close className="button secondary" onClick={onClose}>取消</button>
          <button type="submit" form="board-form" className="button primary">保存板块</button>
        </>
      }
    >
      <form id="board-form" className="form-stack" onSubmit={submit}>
        <div className="board-preview-card">
          <span className="board-preview-label">侧栏显示效果</span>
          <div className="board-preview-pill">
            <span className="board-square" style={{ backgroundColor: color }} />
            <span className="board-preview-name">{name.trim() || '未命名板块'}</span>
          </div>
        </div>

        <label className="field">
          <span>板块名称 <b>*</b></span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：工作邮箱" />
        </label>

        <div className="field">
          <span>识别颜色</span>
          <div className="board-color-picker-row">
            <label className="compact-color-label">
              <span>自定义</span>
              <input className="color-input" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <div className="color-swatches" aria-label="选择预设识别颜色">
              {AVATAR_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={color.toUpperCase() === c ? 'is-selected' : ''}
                  style={{ backgroundColor: c }}
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function DeleteBoardMigrationDialog({
  board,
  boards,
  accountCount,
  onClose,
  onConfirm,
}: {
  board: Board
  boards: Board[]
  accountCount: number
  onClose: () => void
  onConfirm: (targetBoardId: string) => void
}) {
  const otherBoards = boards.filter((b) => b.id !== board.id)
  const [targetBoardId, setTargetBoardId] = useState(otherBoards[0]?.id ?? '')

  return (
    <Modal
      title={`删除板块“${board.name}”`}
      onClose={onClose}
      width="440px"
      footer={
        <>
          <button type="button" data-modal-close className="button secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="button danger"
            disabled={!targetBoardId}
            onClick={() => onConfirm(targetBoardId)}
          >
            迁移账号并删除
          </button>
        </>
      }
    >
      <div className="form-stack">
        <p className="migration-note">
          板块“<strong>{board.name}</strong>”内仍有 <strong>{accountCount}</strong> 个账号。为防止账号丢失，请选择将它们迁移到哪个板块：
        </p>
        <div className="field">
          <span>迁移至目标板块</span>
          <SelectMenu
            value={targetBoardId}
            label="选择迁移目标板块"
            options={otherBoards.map((item) => ({ value: item.id, label: item.name, color: item.color }))}
            onChange={setTargetBoardId}
          />
        </div>
      </div>
    </Modal>
  )
}

export function CopyItemDialog({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: CopyItem | null
  onClose: () => void
  onSave: (item: CopyItem) => void
  onDelete?: () => void
}) {
  const detected = autoDetectCopyIcon(item?.label ?? '', item?.value ?? '')
  const [label, setLabel] = useState(item?.label ?? '')
  const [value, setValue] = useState(item?.value ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [icon, setIcon] = useState(item?.icon ?? detected.icon)
  const [color, setColor] = useState(item?.color ?? detected.color)
  const [sensitive, setSensitive] = useState(item?.sensitive ?? false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [manualIcon, setManualIcon] = useState(Boolean(item?.icon))
  const [manualColor, setManualColor] = useState(Boolean(item?.color))
  const [error, setError] = useState('')
  const initialRef = useRef({
    label: item?.label ?? '',
    value: item?.value ?? '',
    note: item?.note ?? '',
    icon: item?.icon ?? detected.icon,
    color: item?.color ?? detected.color,
    sensitive: item?.sensitive ?? false,
  })
  const dirty = label !== initialRef.current.label
    || value !== initialRef.current.value
    || note !== initialRef.current.note
    || icon !== initialRef.current.icon
    || color !== initialRef.current.color
    || sensitive !== initialRef.current.sensitive

  useEffect(() => {
    setError('')
    if (!manualIcon || !manualColor) {
      const nextDetected = autoDetectCopyIcon(label, value)
      if (!manualIcon) setIcon(nextDetected.icon)
      if (!manualColor) setColor(nextDetected.color)
    }
  }, [label, value, manualIcon, manualColor])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) {
      setError('复制内容不能为空')
      return
    }
    const finalLabel = label.trim() || '快捷短语'
    onSave({
      id: item?.id ?? makeId('copy'),
      label: finalLabel,
      value: value.trim(),
      note: note.trim(),
      sensitive,
      icon,
      color,
      order: item?.order ?? Date.now(),
    })
  }

  const CurrentIcon = getCopyIconComponent(icon)

  return (
    <Modal
      title={
        <div className="copy-dialog-title">
          <div className="copy-dialog-badge" style={{ backgroundColor: `${color}16`, color }}>
            <CurrentIcon size={16} />
          </div>
          <span>{item ? '编辑复制内容' : '新增复制内容'}</span>
        </div>
      }
      onClose={onClose}
      dirty={dirty}
      width="440px"
      footer={
        <div className="copy-dialog-footer">
          {item && onDelete ? (
            <button
              type="button"
              className={`button danger-text ${showConfirmDelete ? 'is-confirming' : ''}`}
              onClick={() => {
                if (showConfirmDelete) {
                  onDelete()
                } else {
                  setShowConfirmDelete(true)
                  setTimeout(() => setShowConfirmDelete(false), 2600)
                }
              }}
            >
              <Trash2 size={14} />
              {showConfirmDelete ? '确定删除？' : '删除'}
            </button>
          ) : (
            <div />
          )}
          <div className="footer-right-actions">
            <button type="button" data-modal-close className="button secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" form="copy-item-form" className="button primary">
              保存内容
            </button>
          </div>
        </div>
      }
    >
      <form id="copy-item-form" className="form-stack" onSubmit={submit}>
        <label className="field">
          <span>标题 / 名称 <em className="field-hint">（可选，留空将自动推断）</em></span>
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="例如：备用邮箱 / 登录口令 / API Token"
          />
        </label>

        <label className="field">
          <div className="field-label-split">
            <span>复制内容 <em className="required-star">*</em></span>
            <span className="field-count">{value.length} 字</span>
          </div>
          <textarea
            className="mono-input"
            rows={4}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="粘贴或输入要保存的快捷复制文本……"
            spellCheck={false}
          />
        </label>

        <div className="copy-style-picker">
          <span className="picker-label">类型图标</span>
          <div className="icon-pills-row">
            {COPY_ICON_OPTIONS.slice(0, 8).map((opt) => {
              const IconComp = opt.icon
              const isSelected = icon === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`icon-pill-btn ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setIcon(opt.id)
                    setManualIcon(true)
                  }}
                  title={opt.name}
                >
                  <IconComp size={14} />
                  <span>{opt.name}</span>
                </button>
              )
            })}
          </div>

          <span className="picker-label" style={{ marginTop: '10px' }}>主题颜色</span>
          <div className="color-dots-row">
            {COPY_COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`color-dot-btn ${color === c.value ? 'is-selected' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={() => {
                  setColor(c.value)
                  setManualColor(true)
                }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <label className="field">
          <span>备忘说明 <em className="field-hint">（可选）</em></span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="选填，如适用场景或过期时间" />
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(event) => setSensitive(event.target.checked)}
          />
          敏感保护（默认在卡片中遮盖文本，需要点击眼睛查看）
        </label>

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function BackupPasswordDialog({
  onClose,
  onValidate,
}: {
  onClose: () => void
  onValidate: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password) {
      setError('请输入这份备份的主密码')
      return
    }
    setChecking(true)
    setError('')
    try {
      await onValidate(password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法验证加密备份')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal
      title="验证加密备份"
      onClose={onClose}
      dirty={Boolean(password)}
      width="430px"
      footer={
        <>
          <button type="button" data-modal-close className="button secondary" onClick={onClose}>取消</button>
          <button type="submit" form="backup-password-form" className="button primary" disabled={checking}>{checking ? '正在验证' : '验证备份'}</button>
        </>
      }
    >
      <form id="backup-password-form" className="form-stack" onSubmit={(event) => void submit(event)}>
        <p className="form-help">先解密并校验完整数据，确认有效后才允许覆盖当前账号库。</p>
        <label className="field">
          <span>备份主密码</span>
          <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}
