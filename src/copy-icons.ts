import {
  Mail,
  FileText,
  Link,
  MessageSquare,
  User,
  Code,
  Globe,
  Database,
  Shield,
  Key,
  Smartphone,
  CreditCard,
  Hash,
  type LucideIcon,
} from 'lucide-react'

export interface CopyIconOption {
  id: string
  name: string
  icon: LucideIcon
}

export const COPY_ICON_OPTIONS: CopyIconOption[] = [
  { id: 'mail', name: '邮箱', icon: Mail },
  { id: 'shield', name: '安全口令', icon: Shield },
  { id: 'key', name: '密钥Token', icon: Key },
  { id: 'link', name: '链接网址', icon: Link },
  { id: 'code', name: '代码API', icon: Code },
  { id: 'user', name: '用户名', icon: User },
  { id: 'smartphone', name: '手机号', icon: Smartphone },
  { id: 'credit-card', name: '卡号支付', icon: CreditCard },
  { id: 'message-square', name: '短语回复', icon: MessageSquare },
  { id: 'hash', name: '数字验证码', icon: Hash },
  { id: 'database', name: '数据参数', icon: Database },
  { id: 'file-text', name: '普通文本', icon: FileText },
]

export const COPY_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  COPY_ICON_OPTIONS.map((item) => [item.id, item.icon]),
)

export const COPY_COLOR_OPTIONS = [
  { name: '蓝', value: '#2563eb' },
  { name: '绿', value: '#10b981' },
  { name: '紫', value: '#8b5cf6' },
  { name: '橙', value: '#f97316' },
  { name: '青', value: '#06b6d4' },
  { name: '红', value: '#ef4444' },
  { name: '黄', value: '#eab308' },
  { name: '灰', value: '#64748b' },
]

const PATTERN_RULES: Array<{ pattern: RegExp; icon: string; color: string }> = [
  { pattern: /\S+@\S+\.\S+/i, icon: 'mail', color: '#2563eb' },
  { pattern: /邮箱|email|mail|gmail|outlook|163|qq/i, icon: 'mail', color: '#2563eb' },
  { pattern: /密码|password|pwd|passphrase/i, icon: 'shield', color: '#8b5cf6' },
  { pattern: /token|session|secret|jwt|bearer|key|公钥|私钥|auth/i, icon: 'key', color: '#8b5cf6' },
  { pattern: /https?:\/\/|www\.|\.(com|cn|io|org|net|dev)/i, icon: 'link', color: '#06b6d4' },
  { pattern: /api[_\s]|curl|function|const|select|json/i, icon: 'code', color: '#10b981' },
  { pattern: /用户名|username|account|user|工号|昵称/i, icon: 'user', color: '#f97316' },
  { pattern: /手机|phone|tel|mobile|\b1[3-9]\d{9}\b/i, icon: 'smartphone', color: '#06b6d4' },
  { pattern: /卡号|银行|card|pay|cvv/i, icon: 'credit-card', color: '#ef4444' },
  { pattern: /验证码|otp|2fa|code|\b\d{4,8}\b/i, icon: 'hash', color: '#eab308' },
]

export function autoDetectCopyIcon(label: string, value: string): { icon: string; color: string } {
  const combined = `${label} ${value}`.trim()
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(combined)) {
      return { icon: rule.icon, color: rule.color }
    }
  }
  return { icon: 'file-text', color: '#64748b' }
}

export function getCopyIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return FileText
  return COPY_ICON_MAP[iconName] ?? Globe ?? FileText
}
