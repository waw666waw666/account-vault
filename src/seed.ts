import type { Account, VaultData } from './types'
import { DEFAULT_BOARDS } from './bridge'

export function createAuthenticVault(): VaultData {
  return { version: 1, boards: DEFAULT_BOARDS.map((b) => ({ ...b })), tags: [], accounts: [] }
}

export function createSeedVault(): VaultData {
  return createAuthenticVault()
}

const now = Date.now()

export function createDemoVault(): VaultData {
  const boards = [
    { id: 'board-google', name: 'Google 邮箱', color: '#0E9384', createdAt: now - 3 },
    { id: 'board-outlook', name: 'Outlook 邮箱', color: '#2F6FED', createdAt: now - 2 },
    { id: 'board-other', name: '其他邮箱', color: '#D59A16', createdAt: now - 1 },
  ]
  const tags = [
    { id: 'tag-gemini', name: 'Gemini Pro', color: '#4F46E5' },
    { id: 'tag-plus-normal', name: '正价 Plus', color: '#10B981' },
    { id: 'tag-scan-fail', name: '扫码失败', color: '#E11D48' },
  ]

  const accounts: Account[] = [
    {
      id: 'demo-claude-pro',
      boardId: 'board-google',
      name: 'Claude 个人专业版',
      identifier: 'demo.claude@example.com',
      avatar: { type: 'initial', letter: 'C', color: '#D97706' },
      tagIds: ['tag-plus-normal'],
      copyItems: [
        {
          id: 'copy-claude-session',
          label: 'Claude Session Key',
          value: 'sk-ant-sid01-demo-session-token-998273645512',
          note: '用于第三方客户端快速免密登录',
          sensitive: true,
        },
        {
          id: 'copy-claude-key',
          label: 'API Key',
          value: 'sk-ant-api03-live_demo_key_abcdef123456',
          note: 'Claude 3.7 Sonnet 专用调用密钥',
          sensitive: true,
        },
        {
          id: 'copy-claude-backup',
          label: '备用救援码',
          value: '9821-4451-2093-8812',
          note: '2FA 丢失时的离线安全代码',
          sensitive: true,
        },
      ],
      notes: '绑定虚拟信用卡自动续费，每月 20 日账单周期。日常作为主力 AI 编程与架构助手。',
      favorite: true,
      registeredAt: '2021',
      createdAt: now - 86400000 * 5,
      updatedAt: now - 3600000 * 2,
    },
    {
      id: 'demo-cursor-team',
      boardId: 'board-google',
      name: 'Cursor 团队账号',
      identifier: 'demo.cursor@example.com',
      avatar: { type: 'initial', letter: 'C', color: '#2563EB' },
      tagIds: ['tag-gemini'],
      copyItems: [
        {
          id: 'copy-cursor-token',
          label: 'Access Token',
          value: 'cur_live_token_77891234568892',
          note: 'IDE 团队授权鉴权 Token',
          sensitive: true,
        },
        {
          id: 'copy-cursor-github',
          label: 'GitHub 绑定名',
          value: 'octo-developer-master',
          note: '已绑定 GitHub 组织协作',
          sensitive: false,
        },
      ],
      notes: 'Cursor 商业授权，支持 Fast Requests 与 Agent 模式无限并发。',
      favorite: true,
      registeredAt: '2023',
      createdAt: now - 86400000 * 4,
      updatedAt: now - 3600000 * 5,
    },
    {
      id: 'demo-gemini-pro',
      boardId: 'board-google',
      name: 'Gemini Pro 实验专号',
      identifier: 'demo.gemini@example.com',
      avatar: { type: 'initial', letter: 'G', color: '#0E9384' },
      tagIds: ['tag-gemini'],
      copyItems: [
        {
          id: 'copy-gemini-key',
          label: 'Google AI Studio Key',
          value: 'AIzaSyDemoKey_1234567890abcdefghijklmn',
          note: 'Gemini 1.5/2.0 Pro 实验 API',
          sensitive: true,
        },
        {
          id: 'copy-gemini-project',
          label: 'GCP Project ID',
          value: 'gemini-research-prod-881',
          note: '云平台配额项目标识',
          sensitive: false,
        },
      ],
      notes: '用于 Antigravity 与深度长上下文分析，配额充足。',
      favorite: false,
      registeredAt: '2024',
      createdAt: now - 86400000 * 3,
      updatedAt: now - 3600000 * 12,
    },
    {
      id: 'demo-openai-team',
      boardId: 'board-google',
      name: 'OpenAI 团队旗舰版',
      identifier: 'demo.openai@example.com',
      avatar: { type: 'initial', letter: 'O', color: '#059669' },
      tagIds: ['tag-plus-normal'],
      copyItems: [
        {
          id: 'copy-openai-session',
          label: 'OpenAI Session',
          value: 'sess-abc123demo_enterprise_live_session',
          note: '网页端免密会话缓存',
          sensitive: true,
        },
        {
          id: 'copy-openai-org',
          label: 'Organization ID',
          value: 'org-TeamEnterprise99281',
          note: 'Tier-5 企业组织 ID',
          sensitive: false,
        },
        {
          id: 'copy-openai-refresh',
          label: 'Refresh Token',
          value: 'rt_openai_live_refresh_token_xyz998',
          note: '移动端同步刷新令牌',
          sensitive: true,
        },
      ],
      notes: '团队主账号，开通 o1-preview / GPT-4o 顶格并发与 Code Interpreter 权限。',
      favorite: true,
      registeredAt: '2020',
      createdAt: now - 86400000 * 6,
      updatedAt: now - 3600000,
    },
    {
      id: 'demo-azure-cloud',
      boardId: 'board-outlook',
      name: 'Azure 云开发账号',
      identifier: 'demo.azure@example.com',
      avatar: { type: 'initial', letter: 'A', color: '#0284C7' },
      tagIds: ['tag-scan-fail'],
      copyItems: [
        {
          id: 'copy-azure-sub',
          label: 'Subscription ID',
          value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          note: '云资源结算主订阅',
          sensitive: false,
        },
        {
          id: 'copy-azure-tenant',
          label: 'Tenant ID',
          value: '8899aabb-ccdd-eeff-0011-223344556677',
          note: 'Microsoft Entra 租户 ID',
          sensitive: false,
        },
        {
          id: 'copy-azure-secret',
          label: 'Client Secret',
          value: 'Sec~DemoSecretKeyForAzDevOps9981',
          note: '自动化部署服务主体密钥',
          sensitive: true,
        },
      ],
      notes: '国际版 Azure 订阅，承载全球 CDN、存储桶及自动化部署流水线。',
      favorite: false,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 3600000 * 8,
    },
    {
      id: 'demo-office-365',
      boardId: 'board-outlook',
      name: 'Office 365 企业版',
      identifier: 'demo.m365@example.com',
      avatar: { type: 'initial', letter: 'M', color: '#EA580C' },
      tagIds: [],
      copyItems: [
        {
          id: 'copy-m365-onedrive',
          label: 'OneDrive 域名',
          value: 'https://businesscorp-my.sharepoint.com/personal/work',
          note: '5TB 开发者网盘主入口',
          sensitive: false,
        },
        {
          id: 'copy-m365-key',
          label: '临时恢复密钥',
          value: 'MS-RECOVER-8821-X992',
          note: '管理员重置验证密钥',
          sensitive: true,
        },
      ],
      notes: 'E5 开发者自动续期订阅，包含全套 Office 桌面版授权及 5TB 云端同步。',
      favorite: false,
      createdAt: now - 86400000 * 7,
      updatedAt: now - 3600000 * 20,
    },
    {
      id: 'demo-github-core',
      boardId: 'board-other',
      name: 'GitHub 核心贡献号',
      identifier: 'demo.github@example.com',
      avatar: { type: 'initial', letter: 'G', color: '#334155' },
      tagIds: [],
      copyItems: [
        {
          id: 'copy-gh-pat',
          label: 'Personal Access Token',
          value: 'ghp_ClassicTokenWithRepoWorkflowGist9981',
          note: '带 repo, workflow, gist 完整权限',
          sensitive: true,
        },
        {
          id: 'copy-gh-ssh',
          label: 'SSH Key 指纹',
          value: 'SHA256:abcd+efgh/1234demoOctoKeyFingerprint',
          note: 'ED25519 签名密钥',
          sensitive: false,
        },
      ],
      notes: '主要开源代码库所有者，配置有 GPG 提交签名与物理硬件 FIDO2 密钥。',
      favorite: true,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 3600000 * 4,
    },
    {
      id: 'demo-linuxdo-geek',
      boardId: 'board-other',
      name: 'Linux Do 极客社区号',
      identifier: 'demo.forum@example.com',
      avatar: { type: 'initial', letter: 'L', color: '#D94F4F' },
      tagIds: [],
      copyItems: [
        {
          id: 'copy-ld-token',
          label: 'Connect API Token',
          value: 'ld_token_oauth2_connect_889900',
          note: 'Discourse 论坛 API 令牌',
          sensitive: true,
        },
      ],
      notes: '活跃等级 3 级（信任用户），日常参与前沿开源技术与逆向安全讨论。',
      favorite: false,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 3600000 * 6,
    },
  ]

  return {
    version: 1,
    boards,
    tags,
    accounts,
  }
}

export function createEmptyVault(): VaultData {
  const seed = createSeedVault()
  return { ...seed, tags: [], accounts: [] }
}
