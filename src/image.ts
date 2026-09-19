import type { ImageAvatar } from './types'

export async function imageFileToAvatar(file: File): Promise<ImageAvatar> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 12 * 1024 * 1024) throw new Error('图片不能超过 12MB')

  const bitmap = await createImageBitmap(file)
  const edge = Math.min(bitmap.width, bitmap.height)
  const sourceX = (bitmap.width - edge) / 2
  const sourceY = (bitmap.height - edge) / 2
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  canvas.getContext('2d')!.drawImage(bitmap, sourceX, sourceY, edge, edge, 0, 0, 256, 256)
  bitmap.close()
  return { type: 'image', dataUrl: canvas.toDataURL('image/webp', 0.86) }
}
