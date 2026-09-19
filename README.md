# Account Vault · 账号库

一个**本地优先**的账号管理工具。所有数据只保存在你自己的浏览器里，不联网、不上传、无后端服务。

支持把账号截图 **粘贴即识别**（本地 OCR），自动整理成结构化账号列表。

![主界面](docs/screenshots/main-view.png)

<p align="center"><sub>主界面：板块分组、标签筛选与账号卡片</sub></p>

![账号网格](docs/screenshots/account-grid.png)

<p align="center"><sub>账号概览：邮箱脱敏显示，一键复制</sub></p>

> **状态**：个人项目，持续迭代中。核心功能可用，欢迎提 Issue。

---

## 特性

- **纯本地存储** —— 数据存于浏览器 IndexedDB，不经过任何服务器
- **截图 OCR 导入** —— `Ctrl V` 粘贴账号截图，本地识别出账号与邮箱，无需手动录入
- **主密码加密** —— 可选开启，PBKDF2-SHA256（25 万次迭代）派生密钥，AES-256-GCM 加密整个库
- **板块与标签** —— 按邮箱类型分板块，用标签标记状态（长期号 / 已验证 / 备用 等）
- **拖拽排序** —— 基于 dnd-kit
- **一键复制** —— 账号、密码、2FA 密钥、自定义字段逐项复制，敏感字段单独处理
- **邮箱脱敏** —— 一键隐藏邮箱，防止旁人窥屏
- **导入导出** —— JSON 备份，方便跨设备迁移

---

## 快速开始

需要 **Node.js 18+**。

```bash
git clone https://github.com/waw666waw666/account-vault.git
cd account-vault
npm install

# 准备 OCR 识别组件（截图导入功能需要，约 4MB，仅首次）
npm run setup:ocr

npm run dev
```

打开 http://127.0.0.1:5188/

### Windows 一键启动

仓库自带 `run.bat`，双击即可。它会自动检查 Node.js、安装依赖并启动服务。

停止服务：双击 `stop.bat`。

---

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（127.0.0.1:5188） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm test` | 运行单元测试 |
| `npm run test:watch` | 测试监听模式 |
| `npm run setup:ocr` | 下载 / 复制 OCR 识别组件 |

---

## 关于 OCR 组件

`public/ocr/` 下的三个文件约 8.8MB，**不纳入 Git 仓库**（避免仓库臃肿），需要运行一次：

```bash
npm run setup:ocr
```

该脚本会：

1. 从 `node_modules` **复制** `worker.min.js` 和 `tesseract-core-simd-lstm.wasm.js`（版本与依赖严格一致，无需联网）
2. **下载** `eng.traineddata` 英文语言包（约 4MB，需联网一次）

若网络受限，可手动下载 [eng.traineddata](https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata) 放到 `public/ocr/lang/` 目录。

> 未准备 OCR 组件时，除截图导入外的所有功能均可正常使用。

---

## 数据与隐私

**数据存放在浏览器的 IndexedDB 中，与项目目录无关。**

这意味着：

- 清除浏览器数据、更换浏览器或使用无痕模式，**数据会丢失**
- 建议定期通过「设置与备份」导出 JSON
- 项目不含任何埋点、统计或上报逻辑

### 加密说明

开启主密码后，整个数据仓库会以 AES-256-GCM 加密后存储：

- 密钥由 PBKDF2-SHA256 派生，迭代 250,000 次
- 盐值随机生成，每次加密使用独立 IV
- **主密码一旦遗忘无法恢复**，请务必妥善保存

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | React 19 |
| 构建 | Vite 8 |
| 语言 | TypeScript 7 |
| 存储 | IndexedDB（无后端） |
| 加密 | Web Crypto API（PBKDF2 + AES-GCM） |
| OCR | tesseract.js 7（WASM，本地运行） |
| 拖拽 | dnd-kit |
| 图标 | lucide-react |
| 测试 | Vitest |

---

## 项目结构

```
src/
  App.tsx                     应用主组件与状态编排
  main.tsx                    入口
  types.ts                    数据模型定义
  storage.ts                  IndexedDB 持久化
  crypto.ts                   加密与解密
  ocr.ts                      截图识别与图像预处理
  bridge.ts                   批量导入指令处理
  utils.ts                    通用工具
  seed.ts                     初始数据
  styles.css                  样式
  components/
    Views.tsx                 主视图（列表 / 板块 / 标签）
    Dialogs.tsx               编辑对话框
    ScreenshotImportDialog.tsx 截图导入
    ConfirmModal.tsx          确认弹窗
    Common.tsx                通用组件
scripts/
  setup-ocr.cjs               准备 OCR 组件
  launcher.ps1                Windows 启动脚本
public/
  ocr/                        OCR 组件（需 setup:ocr 生成）
```

---

## 已知限制

- **OCR 目前仅支持英文识别**（`eng.traineddata`）。识别中文账号备注需要额外语言包
- **Windows 启动脚本为主**。`run.bat` / `stop.bat` 仅适用于 Windows，其他平台请用 `npm run dev`
- **无浏览器扩展形态**，需本地运行开发服务器
- 单用户、单机设计，不含多设备同步

---

## 参与贡献

欢迎提交 Issue 和 Pull Request。

- 提交前请确保 `npm test` 与 `npm run build` 均通过
- 请保持既有代码风格（无分号、单引号、2 空格缩进）

---

## 许可证

[MIT](./LICENSE)
