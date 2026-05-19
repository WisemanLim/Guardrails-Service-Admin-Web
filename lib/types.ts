export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IoType = 'input' | 'output' | 'both';
export type Action =
  | 'allow' | 'warn' | 'redact' | 'sanitize' | 'block'
  | 'block_or_redact' | 'block_or_pseudonymize' | 'aggregate_only'
  | 'refuse' | 'escalate' | 'add_disclaimer' | 'route';
export type Role = 'admin' | 'super_admin' | 'viewer';

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; email: string; role: Role; totpEnabled: boolean };
}

export interface RegisterResponse {
  userId: string;
  email: string;
  role: Role;
  totp: {
    otpauth: string;
    secret: string;
    qrDataUrl: string;
    enabled: boolean;
    hint: string;
  };
}

export interface Rule {
  rule_id: string;
  domain: string;
  locale: string;
  io_type: IoType;
  category: string;
  sub_category: string | null;
  severity: Severity;
  priority: number;
  action: Action;
  pattern_bundle: Record<string, unknown>;
  message_template: Record<string, string>;
  regulation_tags: string[];
  examples_positive: string[];
  examples_negative: string[];
  enabled: boolean;
  version: string;
  source: string;
}

export interface RuleListResponse {
  items: Rule[];
  total: number;
}

export interface LoginHistoryEntry {
  id: string;
  user_id: string | null;
  email: string;
  ip: string | null;
  user_agent: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}
