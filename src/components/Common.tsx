import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { Avatar as AvatarValue, Tag } from '../types'
import { isGeminiProTag } from '../utils'
import { ConfirmModal } from './ConfirmModal'

export function Avatar({ avatar, name, size = 'medium', tags = [] }: { avatar: AvatarValue; name: string; size?: 'small' | 'medium' | 'large' | 'xlarge'; tags?: Tag[] }) {
  const hasProRing = tags.some((tag) => isGeminiProTag(tag.name))
  const isMultiChar = avatar.type === 'initial' && avatar.letter.trim().length > 1
  return (
    <span className={`avatar-frame avatar-frame-${size}${hasProRing ? ' has-pro-ring' : ''}`} title={hasProRing ? 'Gemini Pro · 标签标记' : undefined}>
      {avatar.type === 'image' ? (
        <img className={`avatar avatar-${size}`} src={avatar.dataUrl} alt={`${name}的头像`} width={size === 'small' ? 36 : size === 'medium' ? 46 : size === 'large' ? 58 : 72} height={size === 'small' ? 36 : size === 'medium' ? 46 : size === 'large' ? 58 : 72} />
      ) : (
        <span
          className={`avatar avatar-${size} avatar-initial${isMultiChar ? ' is-multi-char' : ''}`}
          style={{ '--avatar-color': avatar.color } as CSSProperties}
          role="img"
          aria-label={`${name}的字母头像`}
        >
          {avatar.letter}
        </span>
      )}
      {hasProRing && <span className="sr-only">Gemini Pro 会员标签</span>}
    </span>
  )
}

export function TagChip({ tag, selected = false, onClick }: { tag: Tag; selected?: boolean; onClick?: () => void }) {
  const style = { '--tag-color': tag.color } as CSSProperties
  if (onClick) {
    return (
      <button type="button" className={`tag-chip ${selected ? 'is-selected' : ''}`} style={style} onClick={onClick}>
        <span className="tag-dot" />
        {tag.name}
      </button>
    )
  }
  return (
    <span className="tag-chip" style={style}>
      <span className="tag-dot" />
      {tag.name}
    </span>
  )
}

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: { label: string; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function SelectMenu({
  value,
  options,
  onChange,
  label,
  className = '',
  leading,
}: {
  value: string
  options: readonly { value: string; label: string; color?: string }[]
  onChange: (value: string) => void
  label: string
  className?: string
  leading?: ReactNode
}) {
  const rootRef = useRef<HTMLDetailsElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.open && !rootRef.current.contains(event.target as Node)) {
        rootRef.current.open = false
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const close = () => {
    if (!rootRef.current) return
    rootRef.current.open = false
    rootRef.current.querySelector('summary')?.focus()
  }

  return (
    <details
      ref={rootRef}
      className={`app-select ${className}`}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (!next || !event.currentTarget.contains(next as Node)) event.currentTarget.open = false
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.preventDefault()
          close()
        }
      }}
    >
      <summary aria-label={label} aria-haspopup="menu">
        {leading && <span className="app-select-leading">{leading}</span>}
        <span className="app-select-value">
          {selected?.color && <span className="app-select-color" style={{ backgroundColor: selected.color }} />}
          <span>{selected?.label ?? '请选择'}</span>
        </span>
        <ChevronDown className="app-select-chevron" size={15} />
      </summary>
      <div className="app-select-menu" role="menu" aria-label={`${label}选项`}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className={`app-select-option ${active ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(option.value)
                close()
              }}
            >
              {option.color && <span className="app-select-color" style={{ backgroundColor: option.color }} />}
              <span>{option.label}</span>
              {active && <Check size={14} />}
            </button>
          )
        })}
      </div>
    </details>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = '520px',
  className = '',
  dirty = false,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
  className?: string
  dirty?: boolean
}) {
  const triggerElementRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null)
  const modalRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const [discardOpen, setDiscardOpen] = useState(false)

  const requestClose = () => {
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  useEffect(() => {
    return () => {
      triggerElementRef.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
      if (dialogs.at(-1) !== modalRef.current) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>('button, input, textarea, select, summary, [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [dirty, onClose])

  useEffect(() => {
    const first = modalRef.current?.querySelector<HTMLElement>('.modal-body [autofocus]')
      ?? modalRef.current?.querySelector<HTMLElement>('.modal-body input:not([type="hidden"]), .modal-body textarea, .modal-body select, .modal-body button')
      ?? modalRef.current?.querySelector<HTMLElement>('.modal-header button')
    first?.focus()
  }, [])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section
        ref={modalRef}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width }}
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('[data-modal-close]')) {
            event.preventDefault()
            event.stopPropagation()
            requestClose()
          }
        }}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="关闭" onClick={requestClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
      <ConfirmModal
        options={discardOpen ? {
          title: '放弃未保存修改？',
          message: '关闭后本次编辑内容不会保留。',
          confirmText: '放弃修改',
          danger: true,
          icon: 'alert',
          onConfirm: () => {
            setDiscardOpen(false)
            onClose()
          },
        } : null}
        onClose={() => setDiscardOpen(false)}
      />
    </div>
  )
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-mark" />
      <p>{title}</p>
      {action}
    </div>
  )
}
