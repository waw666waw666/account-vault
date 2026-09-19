import type { Avatar, RecognizedAccount } from './types'
import { avatarForName, cleanRecognizedName, colorFromName, getInitial, makeId, uniqueNames } from './utils'

type ProgressCallback = (progress: number, message: string) => void

export type OcrLine = {
  text: string
  confidence: number
  centerY: number
  textX: number
  height: number
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

function drawSource(bitmap: ImageBitmap): HTMLCanvasElement {
  const maximumEdge = 2200
  const scale = Math.min(1, maximumEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

function averageCornerLuminance(context: CanvasRenderingContext2D, width: number, height: number): number {
  const sample = Math.max(2, Math.min(12, Math.floor(Math.min(width, height) / 12)))
  const points = [
    context.getImageData(0, 0, sample, sample),
    context.getImageData(width - sample, 0, sample, sample),
    context.getImageData(0, height - sample, sample, sample),
  ]
  let total = 0
  let count = 0
  for (const point of points) {
    for (let index = 0; index < point.data.length; index += 4) {
      total += point.data[index] * 0.299 + point.data[index + 1] * 0.587 + point.data[index + 2] * 0.114
      count += 1
    }
  }
  return total / count
}

function createOcrCanvas(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; cropLeft: number; scale: number; singleRow: boolean } {
  const singleRow = source.height <= 260 && source.width / source.height >= 1.6
  const cropLeft = singleRow ? 0 : Math.round(source.width * 0.17)
  const cropWidth = source.width - cropLeft
  const scale = singleRow
    ? Math.min(1.5, Math.max(1, 520 / source.width))
    : Math.max(0.7, Math.min(2.4, 1800 / Math.max(cropWidth, source.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(cropWidth * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(source, cropLeft, 0, cropWidth, source.height, 0, 0, canvas.width, canvas.height)

  const darkBackground = averageCornerLuminance(context, canvas.width, canvas.height) < 110
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < image.data.length; index += 4) {
    const luminance = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114
    const oriented = darkBackground ? 255 - luminance : luminance
    const contrasted = Math.max(0, Math.min(255, (oriented - 128) * 1.65 + 128))
    image.data[index] = contrasted
    image.data[index + 1] = contrasted
    image.data[index + 2] = contrasted
  }
  context.putImageData(image, 0, 0)
  return { canvas, cropLeft, scale, singleRow }
}

function getOcrLines(
  blocks: Array<{ paragraphs: Array<{ lines: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> }> | null,
  text: string,
  cropLeft: number,
  scale: number,
  sourceHeight: number,
): OcrLine[] {
  const lines = blocks
    ?.flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .map((line) => ({
      text: cleanRecognizedName(line.text),
      confidence: Math.round(line.confidence),
      centerY: (line.bbox.y0 + line.bbox.y1) / 2 / scale,
      textX: cropLeft + line.bbox.x0 / scale,
      height: Math.max(12, (line.bbox.y1 - line.bbox.y0) / scale),
    }))
    .filter((line) => line.text.length > 0)

  if (lines?.length) return lines.sort((left, right) => left.centerY - right.centerY)

  const fallback = uniqueNames(text.split(/\r?\n/).map(cleanRecognizedName))
  return fallback.map((line, index) => ({
    text: line,
    confidence: 45,
    centerY: ((index + 0.5) / fallback.length) * sourceHeight,
    textX: 48,
    height: 18,
  }))
}

export function mergeAdjacentEmails(lines: OcrLine[]): OcrLine[] {
  const merged: OcrLine[] = []
  for (const line of lines) {
    const email = line.text.match(EMAIL_PATTERN)?.[0]
    const previous = merged.at(-1)
    const remainder = cleanRecognizedName(line.text.replace(EMAIL_PATTERN, ''))
    const isEmailOnly = email && (
      remainder === ''
      || (remainder.length === 1 && previous && line.textX + line.height < previous.textX)
    )
    const belongsToPrevious = previous
      && !EMAIL_PATTERN.test(previous.text)
      && line.centerY - previous.centerY <= Math.max(line.height, previous.height) * 2.8

    if (isEmailOnly && belongsToPrevious) {
      previous.text = `${previous.text} ${email}`
      previous.confidence = Math.min(previous.confidence, line.confidence)
    } else {
      merged.push({ ...line })
    }
  }
  return merged
}

function colorDistance(left: [number, number, number], right: [number, number, number]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/**
 * 扫描截图里的所有头像色块，按从上到下的顺序返回。
 *
 * 思路：头像是一块「颜色统一且明显不同于背景」的连续区域。
 * 先把像素按颜色是否鲜艳（远离背景色）打成前景，再按行做连通段合并，
 * 纵向重叠的段归为同一个头像。这样得到的数量和顺序只取决于图片本身，
 * 不受 OCR 行分割质量影响——这正是多账号截图不再串色的关键。
 */
function scanAvatarBlocks(source: HTMLCanvasElement): Array<{ x: number; y: number; width: number; height: number; color: [number, number, number] }> {
  const context = source.getContext('2d', { willReadFrequently: true })
  if (!context) return []

  const width = source.width
  const height = source.height
  if (width < 8 || height < 8) return []

  const image = context.getImageData(0, 0, width, height)

  // 背景色取四角的中位数，比只看单列稳，也不会被窗口边框带偏
  const corners: Array<[number, number, number]> = []
  for (const [cx, cy] of [[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]] as const) {
    const index = (cy * width + cx) * 4
    corners.push([image.data[index], image.data[index + 1], image.data[index + 2]])
  }
  const background: [number, number, number] = [0, 1, 2].map((channel) => {
    const values = corners.map((pixel) => pixel[channel]).sort((left, right) => left - right)
    return values[Math.floor(values.length / 2)]
  }) as [number, number, number]

  const isForeground = (index: number): boolean => {
    const red = image.data[index]
    const green = image.data[index + 1]
    const blue = image.data[index + 2]
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
    const distance = Math.hypot(red - background[0], green - background[1], blue - background[2])
    // 只看饱和度会漏掉灰色头像（灰的饱和度是 0），所以要么够鲜艳，要么和背景色差得够远。
    return saturation >= 40 || distance > 90
  }

  // 逐行取前景段
  type Segment = { row: number; left: number; right: number }
  const segments: Segment[] = []
  for (let y = 0; y < height; y += 1) {
    let start = -1
    for (let x = 0; x <= width; x += 1) {
      const active = x < width && isForeground((y * width + x) * 4)
      if (active && start < 0) start = x
      else if (!active && start >= 0) {
        if (x - start >= 4) segments.push({ row: y, left: start, right: x - 1 })
        start = -1
      }
    }
  }
  if (!segments.length) return []

  // 纵向相邻且横向重叠的段属于同一个头像
  type Block = { top: number; bottom: number; left: number; right: number }
  const blocks: Block[] = []
  for (const segment of segments) {
    const hit = blocks.find((block) =>
      segment.row - block.bottom <= 2 && segment.left <= block.right + 2 && segment.right >= block.left - 2,
    )
    if (hit) {
      hit.bottom = segment.row
      hit.left = Math.min(hit.left, segment.left)
      hit.right = Math.max(hit.right, segment.right)
    } else {
      blocks.push({ top: segment.row, bottom: segment.row, left: segment.left, right: segment.right })
    }
  }

  // 只保留接近方形、尺寸合理的块，滤掉细长的文字条和色带
  return blocks
    .map((block) => {
      const blockWidth = block.right - block.left + 1
      const blockHeight = block.bottom - block.top + 1
      const aspect = blockHeight / blockWidth
      if (blockHeight < 8 || blockWidth < 8) return null
      if (aspect < 0.55 || aspect > 1.8) return null

      // 取块内像素的中位数作为代表色。这里只排除白色字母和抗锯齿边缘，
      // 不能再套 isForeground——那样会把灰头像的像素一起滤掉。
      const reds: number[] = []
      const greens: number[] = []
      const blues: number[] = []
      const inset = Math.max(1, Math.round(Math.min(blockWidth, blockHeight) * 0.18))
      for (let y = block.top + inset; y <= block.bottom - inset; y += 1) {
        for (let x = block.left + inset; x <= block.right - inset; x += 1) {
          const index = (y * width + x) * 4
          const red = image.data[index]
          const green = image.data[index + 1]
          const blue = image.data[index + 2]
          // 头像里的白色字母是纯白，跳过它，剩余像素就是底色
          if (red > 236 && green > 236 && blue > 236) continue
          reds.push(red)
          greens.push(green)
          blues.push(blue)
        }
      }
      if (reds.length < 12) return null
      const median = (values: number[]) => {
        const sorted = [...values].sort((left, right) => left - right)
        return sorted[Math.floor(sorted.length / 2)]
      }
      return {
        x: (block.left + block.right) / 2,
        y: (block.top + block.bottom) / 2,
        width: blockWidth,
        height: blockHeight,
        color: [median(reds), median(greens), median(blues)] as [number, number, number],
        pixels: reds.length,
      }
    })
    .filter((block): block is NonNullable<typeof block> => block !== null)
    .sort((left, right) => left.y - right.y)
}

function cropAvatar(source: HTMLCanvasElement, centerX: number, centerY: number, radius: number): string {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  context.clip()
  context.drawImage(source, centerX - radius, centerY - radius, radius * 2, radius * 2, 0, 0, size, size)
  return canvas.toDataURL('image/webp', 0.86)
}

function analyzeAvatar(source: HTMLCanvasElement, line: OcrLine, name: string): Avatar {
  const context = source.getContext('2d', { willReadFrequently: true })!

  // 整块头像扫描只在「整张图只有一个头像」时启用。
  //
  // 单账号截图时这一步最可靠：它直接读出头像色块的坐标，绕开 OCR 偶发的
  // centerY 纵向偏移（偏移会让下面的采样窗口整段错过头像，最终退回名字哈希色）。
  // 多账号截图不用它——一张图里多个色块要按顺序和文字行配对，而 OCR 的行分割
  // 质量不稳定，配对可能串位；那种情况交给下面原有逻辑。
  const blocks = scanAvatarBlocks(source)
  if (blocks.length === 1) {
    return { type: 'initial', letter: getInitial(name), color: rgbToHex(...blocks[0].color) }
  }

  const searchRight = Math.max(8, Math.min(source.width, Math.floor(line.textX - 3)))
  const singleRow = source.height <= 260 && source.width / source.height >= 1.6
  const verticalRadius = singleRow
    ? Math.max(24, Math.min(48, Math.round(source.height * 0.4)))
    : Math.max(9, Math.min(34, Math.round(line.height * 0.9)))
  const top = Math.max(0, Math.round(line.centerY - verticalRadius))
  const height = Math.min(source.height - top, verticalRadius * 2 + 1)
  if (searchRight < 10 || height < 5) return avatarForName(name)

  const image = context.getImageData(0, top, searchRight, height)
  const backgroundSamples = [top, top + Math.floor(height / 2), top + height - 1]
    .map((y) => context.getImageData(1, Math.max(0, Math.min(source.height - 1, y)), 1, 1).data)
  const background: [number, number, number] = [0, 1, 2].map((channel) => {
    const values = backgroundSamples.map((pixel) => pixel[channel]).sort((left, right) => left - right)
    return values[Math.floor(values.length / 2)]
  }) as [number, number, number]

  const columnScores = new Array<number>(searchRight).fill(0)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < searchRight; x += 1) {
      const index = (y * searchRight + x) * 4
      const pixel: [number, number, number] = [image.data[index], image.data[index + 1], image.data[index + 2]]
      if (image.data[index + 3] > 100 && colorDistance(pixel, background) > 32) columnScores[x] += 1
    }
  }

  const minimumScore = Math.max(2, Math.floor(height * 0.16))
  const ranges: Array<[number, number]> = []
  let start = -1
  for (let x = 0; x <= searchRight; x += 1) {
    if (x < searchRight && columnScores[x] >= minimumScore) {
      if (start < 0) start = x
    } else if (start >= 0) {
      if (x - start >= 5) ranges.push([start, x - 1])
      start = -1
    }
  }

  const range = ranges
    .filter(([left, right]) => right - left <= verticalRadius * 3)
    .sort((left, right) => right[1] - left[1])[0]
  if (!range) return avatarForName(name)

  const centerX = (range[0] + range[1]) / 2
  const radius = Math.max(6, Math.min(verticalRadius, (range[1] - range[0] + 1) / 2))
  const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>()
  let candidateCount = 0

  for (let y = Math.max(0, Math.floor(line.centerY - radius)); y <= Math.min(source.height - 1, Math.ceil(line.centerY + radius)); y += 1) {
    for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(source.width - 1, Math.ceil(centerX + radius)); x += 1) {
      const distanceFromCenter = Math.hypot(x - centerX, y - line.centerY)
      if (distanceFromCenter > radius * 0.92) continue
      const pixel = context.getImageData(x, y, 1, 1).data
      const rgb: [number, number, number] = [pixel[0], pixel[1], pixel[2]]
      if (colorDistance(rgb, background) < 28) continue
      const key = `${Math.round(rgb[0] / 24)},${Math.round(rgb[1] / 24)},${Math.round(rgb[2] / 24)}`
      const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 }
      bucket.count += 1
      bucket.red += rgb[0]
      bucket.green += rgb[1]
      bucket.blue += rgb[2]
      buckets.set(key, bucket)
      candidateCount += 1
    }
  }

  const dominant = [...buckets.values()].sort((left, right) => right.count - left.count)[0]
  if (!dominant || candidateCount < 12) return avatarForName(name)

  const dominantRatio = dominant.count / candidateCount
  if (buckets.size > 10 && dominantRatio < 0.38) {
    return { type: 'image', dataUrl: cropAvatar(source, centerX, line.centerY, radius) }
  }

  return {
    type: 'initial',
    letter: getInitial(name),
    color: rgbToHex(dominant.red / dominant.count, dominant.green / dominant.count, dominant.blue / dominant.count),
  }
}

function toRecognizedAccount(line: OcrLine, source: HTMLCanvasElement): RecognizedAccount {
  const email = line.text.match(EMAIL_PATTERN)?.[0] ?? ''
  const withoutEmail = cleanRecognizedName(line.text.replace(EMAIL_PATTERN, ''))
  const name = withoutEmail || email.split('@')[0] || line.text
  return {
    id: makeId('recognized'),
    name,
    identifier: email,
    avatar: analyzeAvatar(source, line, name),
    confidence: line.confidence,
    selected: true,
  }
}

export async function recognizeAccountScreenshot(
  file: File,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<RecognizedAccount[]> {
  if (signal?.aborted) throw new DOMException('识别已取消', 'AbortError')

  onProgress(0.04, '正在读取截图')
  const source = drawSource(await loadImage(file))
  const prepared = createOcrCanvas(source)
  onProgress(0.1, '正在加载本地识别组件')

  if (signal?.aborted) throw new DOMException('识别已取消', 'AbortError')

  const { createWorker, OEM, PSM } = await import('tesseract.js')
  const base = import.meta.env.BASE_URL
  const resources = [
    [`${base}ocr/worker.min.js`, 50_000],
    [`${base}ocr/tesseract-core-simd-lstm.wasm.js`, 1_000_000],
    [`${base}ocr/lang/eng.traineddata`, 1_000_000],
  ] as const
  const checks = await Promise.all(resources.map(async ([url, minimumSize]) => {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal })
    const length = Number(response.headers.get('content-length') ?? 0)
    return response.ok && (length === 0 || length >= minimumSize)
  }))
  if (checks.some((available) => !available)) {
    throw new Error('本地识别资源不完整，请刷新页面后重试')
  }
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}ocr/worker.min.js`,
    corePath: `${base}ocr/tesseract-core-simd-lstm.wasm.js`,
    // ponytail: desktop Chromium SIMD core only; add a non-SIMD fallback if other browsers become a target.
    langPath: `${base}ocr/lang`,
    gzip: false,
    errorHandler: () => {},
    logger: ({ status, progress }) => {
      if (signal?.aborted) return
      const message = status.includes('recogniz') ? '正在识别名称和邮箱' : '正在准备识别组件'
      onProgress(0.1 + progress * 0.78, message)
    },
  })

  const onAbort = () => {
    void worker.terminate().catch(() => {})
  }
  signal?.addEventListener('abort', onAbort)

  try {
    if (signal?.aborted) throw new DOMException('识别已取消', 'AbortError')

    await worker.setParameters({
      tessedit_pageseg_mode: prepared.singleRow ? PSM.SINGLE_COLUMN : PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      user_defined_dpi: '144',
    })

    if (signal?.aborted) throw new DOMException('识别已取消', 'AbortError')

    const result = await worker.recognize(prepared.canvas, {}, { text: true, blocks: true })

    if (signal?.aborted) throw new DOMException('识别已取消', 'AbortError')

    onProgress(0.9, '正在清洗识别结果')
    const lines = mergeAdjacentEmails(getOcrLines(result.data.blocks, result.data.text, prepared.cropLeft, prepared.scale, source.height))
    const accounts = lines.map((line) => toRecognizedAccount(line, source)).filter((account) => account.name)
    onProgress(1, `识别到 ${accounts.length} 个账号`)
    return accounts
  } finally {
    signal?.removeEventListener('abort', onAbort)
    await worker.terminate().catch(() => {})
  }
}

export function defaultRecognizedAccount(name: string): RecognizedAccount {
  return {
    id: makeId('recognized'),
    name,
    identifier: '',
    avatar: { type: 'initial', letter: getInitial(name), color: colorFromName(name) },
    confidence: 100,
    selected: true,
  }
}
