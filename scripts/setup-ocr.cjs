/**
 * 准备截图 OCR 所需的本地识别组件。
 *
 * 克隆仓库后运行一次：
 *   npm run setup:ocr
 *
 * 组件来源：
 *   - worker.min.js / tesseract-core-simd-lstm.wasm.js
 *       直接取自 node_modules 中的 tesseract.js 与 tesseract.js-core，
 *       保证与已安装版本严格一致，无需联网。
 *   - eng.traineddata
 *       体积较大（约 4MB）且不纳入 Git，首次运行需联网下载一次。
 */
const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')

const ROOT = path.join(__dirname, '..')
const TARGET_DIR = path.join(ROOT, 'public', 'ocr')
const LANG_DIR = path.join(TARGET_DIR, 'lang')

function fromNodeModules(relativePath) {
  return path.join(ROOT, 'node_modules', relativePath)
}

const COPIES = [
  {
    from: fromNodeModules(path.join('tesseract.js', 'dist', 'worker.min.js')),
    to: path.join(TARGET_DIR, 'worker.min.js'),
    minBytes: 50_000,
    label: 'worker.min.js',
  },
  {
    from: fromNodeModules(path.join('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js')),
    to: path.join(TARGET_DIR, 'tesseract-core-simd-lstm.wasm.js'),
    minBytes: 1_000_000,
    label: 'tesseract-core-simd-lstm.wasm.js',
  },
]

const DOWNLOADS = [
  {
    url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata',
    to: path.join(LANG_DIR, 'eng.traineddata'),
    minBytes: 1_000_000,
    label: path.join('lang', 'eng.traineddata'),
  },
]

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'))

    https
      .get(url, { headers: { 'User-Agent': 'account-vault-setup' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return resolve(download(res.headers.location, dest, redirects + 1))
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode}`))
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true })
        const temp = `${dest}.tmp`
        const file = fs.createWriteStream(temp)

        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            fs.renameSync(temp, dest)
            resolve()
          })
        })
        file.on('error', (error) => {
          fs.rmSync(temp, { force: true })
          reject(error)
        })
      })
      .on('error', reject)
  })
}

function isUsable(filePath, minBytes) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size >= minBytes
}

async function main() {
  if (!fs.existsSync(fromNodeModules('tesseract.js'))) {
    console.error('未找到依赖，请先运行：npm install\n')
    process.exit(1)
  }

  console.log('正在准备 OCR 识别组件...\n')
  let failed = false

  for (const item of COPIES) {
    if (isUsable(item.to, item.minBytes)) {
      console.log(`  跳过 ${item.label}（已存在）`)
      continue
    }
    if (!fs.existsSync(item.from)) {
      console.log(`  缺失 ${item.label}（依赖文件不存在）`)
      failed = true
      continue
    }
    fs.mkdirSync(path.dirname(item.to), { recursive: true })
    fs.copyFileSync(item.from, item.to)
    console.log(`  复制 ${item.label}（${(fs.statSync(item.to).size / 1024 / 1024).toFixed(2)} MB）`)
  }

  for (const item of DOWNLOADS) {
    if (isUsable(item.to, item.minBytes)) {
      console.log(`  跳过 ${item.label}（已存在）`)
      continue
    }
    process.stdout.write(`  下载 ${item.label} ... `)
    try {
      await download(item.url, item.to)
      const size = fs.statSync(item.to).size
      if (size < item.minBytes) throw new Error(`文件异常（${size} 字节）`)
      console.log(`完成（${(size / 1024 / 1024).toFixed(2)} MB）`)
    } catch (error) {
      console.log('失败')
      console.error(`\n  错误：${error.message}`)
      console.error('  如网络受限，可手动下载后放到 public/ocr/lang/eng.traineddata\n')
      failed = true
    }
  }

  if (failed) {
    console.error('\n部分组件准备失败，截图导入功能将不可用（其余功能不受影响）。')
    process.exit(1)
  }

  console.log('\nOCR 组件已就绪。')
}

main()
