import { describe, expect, it } from 'vitest'
import { mergeAdjacentEmails, type OcrLine } from './ocr'

describe('截图账号行清洗', () => {
  it('把头像噪声和邮箱行合并到前一个账号名称', () => {
    const lines: OcrLine[] = [
      { text: 'wa w', confidence: 91, centerY: 35, textX: 108, height: 18 },
      { text: 'Z evan.sun@example.com', confidence: 53, centerY: 65, textX: 48, height: 16 },
    ]

    expect(mergeAdjacentEmails(lines)).toEqual([
      { text: 'wa w evan.sun@example.com', confidence: 53, centerY: 35, textX: 108, height: 18 },
    ])
  })
})
