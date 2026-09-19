import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, Info, Trash2, X } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  icon?: 'trash' | 'alert' | 'info'
  onConfirm: () => void
  onCancel?: () => void
}

export function ConfirmModal({
  options,
  onClose,
}: {
  options: ConfirmOptions | null
  onClose: () => void
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (options) {
      triggerRef.current = document.activeElement as HTMLElement | null
      confirmBtnRef.current?.focus()
    }
    return () => triggerRef.current?.focus?.()
  }, [options])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!options) return
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
      if (dialogs.at(-1) !== dialogRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        options.onCancel?.()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [options, onClose])

  if (!options) return null

  const {
    title,
    message,
    confirmText = '确定',
    cancelText = '取消',
    danger = false,
    icon = 'alert',
    onConfirm,
    onCancel,
  } = options

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div className="modal-backdrop custom-confirm-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && handleCancel()}>
      <div ref={dialogRef} className="custom-confirm-card" role="dialog" aria-modal="true">
        <div className="custom-confirm-header">
          <div className={`custom-confirm-icon-box ${danger ? 'is-danger' : 'is-info'}`}>
            {icon === 'trash' ? <Trash2 size={20} /> : icon === 'info' ? <Info size={20} /> : <AlertTriangle size={20} />}
          </div>
          <button type="button" className="custom-confirm-close" aria-label="关闭" onClick={handleCancel}>
            <X size={16} />
          </button>
        </div>

        <div className="custom-confirm-body">
          <h3 className="custom-confirm-title">{title}</h3>
          <div className="custom-confirm-message">{message}</div>
        </div>

        <div className="custom-confirm-footer">
          <button type="button" className="button secondary confirm-cancel-btn" onClick={handleCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`button ${danger ? 'button danger is-solid-danger' : 'primary'} confirm-action-btn`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
