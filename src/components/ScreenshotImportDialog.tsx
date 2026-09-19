import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ImagePlus, RotateCcw } from 'lucide-react'
import type { Account, Board, RecognizedAccount } from '../types'
import { recognizeAccountScreenshot } from '../ocr'
import { imageFileToAvatar } from '../image'
import { annotateRecognizedDuplicates, avatarForName, getInitial } from '../utils'
import { Avatar, Modal, SelectMenu } from './Common'

export function ScreenshotImportDialog({
  initialFile,
  boards,
  existingAccounts = [],
  defaultBoardId,
  onClose,
  onImport,
}: {
  initialFile: File | null
  boards: Board[]
  existingAccounts?: Account[]
  defaultBoardId: string
  onClose: () => void
  onImport: (accounts: RecognizedAccount[], boardId: string) => void
}) {
  const [file, setFile] = useState<File | null>(initialFile)
  const [rows, setRows] = useState<RecognizedAccount[]>([])
  const [boardId, setBoardId] = useState(defaultBoardId || boards[0]?.id || '')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [retryCount, setRetryCount] = useState(0)

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    let active = true
    setRows([])
    setError('')
    setLoading(true)
    setProgress(0)
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件')
      setLoading(false)
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('截图不能超过 12MB')
      setLoading(false)
      return
    }

    void recognizeAccountScreenshot(
      file,
      (nextProgress, nextStatus) => {
        if (!active || controller.signal.aborted) return
        setProgress(nextProgress)
        setStatus(nextStatus)
      },
      controller.signal,
    )
      .then((result) => {
        if (!active || controller.signal.aborted) return
        if (result.length === 0) {
          setError('没有识别到账号，请换一张更清晰的名单截图')
          setRows([])
          return
        }

        setRows(annotateRecognizedDuplicates(result, existingAccounts))
      })
      .catch((reason) => {
        if (!active || controller.signal.aborted) return
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : '截图识别失败')
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [existingAccounts, file, retryCount])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const image = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.type.startsWith('image/'))
        ?.getAsFile()
      if (image) {
        event.preventDefault()
        setFile(image)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const updateRow = (id: string, update: (row: RecognizedAccount) => RecognizedAccount) => {
    setRows((current) => annotateRecognizedDuplicates(
      current.map((row) => row.id === id ? update(row) : row),
      existingAccounts,
    ))
  }

  const selected = rows.filter((row) => row.selected && row.name.trim())

  return (
    <Modal
      title="从截图识别账号"
      onClose={onClose}
      dirty={Boolean(file && rows.length)}
      width="900px"
      className="import-modal"
      footer={
        <>
          <span className="modal-footer-note">{selected.length > 0 ? `将导入 ${selected.length} 个账号` : ''}</span>
          <button type="button" data-modal-close className="button secondary" onClick={onClose}>取消</button>
          <button type="button" className="button primary" disabled={loading || selected.length === 0 || !boardId} onClick={() => onImport(selected, boardId)}>
            导入账号
          </button>
        </>
      }
    >
      {!file ? (
        <label
          className="screenshot-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const image = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'))
            if (image) setFile(image)
          }}
        >
          <ImagePlus size={30} />
          <strong>粘贴或选择截图</strong>
          <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <div className="import-layout">
          <aside className="import-source">
            <img src={previewUrl} alt="待识别截图" />
            <label className="button secondary replace-image-button">
              <RotateCcw size={15} />
              更换截图
              <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
          </aside>

          <section className="import-results">
            <div className="import-toolbar">
              <div className="field inline-field">
                <span>导入到</span>
                <SelectMenu
                  value={boardId}
                  label="选择导入板块"
                  options={boards.map((board) => ({ value: board.id, label: board.name, color: board.color }))}
                  onChange={setBoardId}
                />
              </div>
              {!loading && rows.length > 0 && <span className="recognition-summary"><Check size={15} />识别到 {rows.length} 项</span>}
            </div>

            {loading && (
              <div className="recognition-progress">
                <div className="progress-track"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <p>{status || '正在准备识别'}</p>
              </div>
            )}

            {error && (
              <div className="inline-error">
                <AlertTriangle size={17} />
                <span>{error}</span>
                <button type="button" className="text-button inline-retry-button" onClick={() => setRetryCount((c) => c + 1)}>
                  重试
                </button>
              </div>
            )}

            {!loading && rows.length > 0 && (
              <div className="recognized-list">
                {rows.map((row) => (
                  <article key={row.id} className={`recognized-row ${row.selected ? '' : 'is-disabled'}`}>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={Boolean(row.duplicate)}
                      aria-label={`选择 ${row.name}`}
                      onChange={(event) => updateRow(row.id, (current) => ({ ...current, selected: event.target.checked }))}
                    />
                    <label className="recognized-avatar-picker" title="点击更换头像">
                      <Avatar avatar={row.avatar} name={row.name} size="small" />
                      <ImagePlus size={11} />
                      <input
                        type="file"
                        accept="image/*"
                        aria-label={`更换${row.name}的头像`}
                        onChange={async (event) => {
                          const image = event.target.files?.[0]
                          if (!image) return
                          try {
                            const avatar = await imageFileToAvatar(image)
                            updateRow(row.id, (current) => ({ ...current, avatar }))
                          } catch (reason) {
                            setError(reason instanceof Error ? reason.message : '无法读取头像')
                          }
                        }}
                      />
                    </label>
                    <div className="recognized-fields">
                      <input
                        value={row.name}
                        aria-label="账号名称"
                        onChange={(event) => updateRow(row.id, (current) => ({
                          ...current,
                          name: event.target.value,
                          avatar: current.avatar.type === 'initial' ? { ...current.avatar, letter: getInitial(event.target.value) } : current.avatar,
                        }))}
                      />
                      <input value={row.identifier} aria-label="邮箱或账号" placeholder="截图中未显示邮箱" onChange={(event) => updateRow(row.id, (current) => ({ ...current, identifier: event.target.value }))} />
                    </div>
                    <div className="recognized-extra">
                      {row.avatar.type === 'initial' && (
                        <input
                          className="color-input"
                          type="color"
                          value={row.avatar.color}
                          aria-label={`${row.name}的头像颜色`}
                          onChange={(event) => updateRow(row.id, (current) => current.avatar.type === 'initial' ? { ...current, avatar: { ...current.avatar, color: event.target.value } } : current)}
                        />
                      )}
                      {row.avatar.type === 'image' && (
                        <button type="button" className="recognized-avatar-reset" onClick={() => updateRow(row.id, (current) => ({ ...current, avatar: avatarForName(current.name) }))}>
                          改用字母
                        </button>
                      )}
                      {row.duplicate === 'existing' && (
                        <span className="duplicate-badge existing-dup" title="账号库中已存在相同账号">已有重复</span>
                      )}
                      {row.duplicate === 'batch' && (
                        <span className="duplicate-badge batch-dup" title="截图中出现多条相同记录">同批重复</span>
                      )}
                      {row.confidence < 58 && <span className="low-confidence" title="建议检查名称"><AlertTriangle size={15} /></span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
