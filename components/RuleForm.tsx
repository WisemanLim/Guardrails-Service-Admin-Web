'use client';

import { useState } from 'react';
import type { Rule, Severity, IoType, Action } from '@/lib/types';

const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const IO_TYPES: IoType[] = ['input', 'output', 'both'];
const ACTIONS: Action[] = [
  'allow', 'warn', 'redact', 'sanitize', 'block',
  'block_or_redact', 'block_or_pseudonymize', 'aggregate_only',
  'refuse', 'escalate', 'add_disclaimer', 'route',
];

export interface RuleFormValue {
  ruleId: string;
  domain: string;
  locale: string;
  ioType: IoType;
  category: string;
  subCategory?: string;
  severity: Severity;
  priority: number;
  action: Action;
  patternBundle: string;     // JSON text
  messageTemplate: string;   // JSON text
  regulationTags: string;    // CSV
  examplesPositive: string;  // newline-separated
  examplesNegative: string;
  enabled: boolean;
  version: string;
}

export function ruleToForm(r: Rule): RuleFormValue {
  return {
    ruleId: r.rule_id,
    domain: r.domain,
    locale: r.locale,
    ioType: r.io_type,
    category: r.category,
    subCategory: r.sub_category ?? '',
    severity: r.severity,
    priority: r.priority,
    action: r.action,
    patternBundle: JSON.stringify(r.pattern_bundle ?? {}, null, 2),
    messageTemplate: JSON.stringify(r.message_template ?? {}, null, 2),
    regulationTags: (r.regulation_tags ?? []).join(', '),
    examplesPositive: (r.examples_positive ?? []).join('\n'),
    examplesNegative: (r.examples_negative ?? []).join('\n'),
    enabled: r.enabled,
    version: r.version ?? '1.0.0',
  };
}

export function emptyForm(): RuleFormValue {
  return {
    ruleId: '',
    domain: 'global',
    locale: 'ko-KR',
    ioType: 'input',
    category: 'pii',
    subCategory: '',
    severity: 'high',
    priority: 500,
    action: 'block',
    patternBundle: '{}',
    messageTemplate: '{"ko-KR":""}',
    regulationTags: 'KR_PIPA',
    examplesPositive: '',
    examplesNegative: '',
    enabled: true,
    version: '1.0.0',
  };
}

export function formToDto(v: RuleFormValue) {
  return {
    ruleId: v.ruleId,
    domain: v.domain,
    locale: v.locale,
    ioType: v.ioType,
    category: v.category,
    subCategory: v.subCategory || undefined,
    severity: v.severity,
    priority: Number(v.priority),
    action: v.action,
    patternBundle: safeJson(v.patternBundle, {}),
    messageTemplate: safeJson(v.messageTemplate, {}),
    regulationTags: v.regulationTags.split(',').map((s) => s.trim()).filter(Boolean),
    examplesPositive: v.examplesPositive.split('\n').map((s) => s.trim()).filter(Boolean),
    examplesNegative: v.examplesNegative.split('\n').map((s) => s.trim()).filter(Boolean),
    enabled: v.enabled,
    version: v.version,
  };
}

function safeJson(s: string, fb: unknown): unknown {
  try { return JSON.parse(s); } catch { return fb; }
}

export default function RuleForm({
  value, onChange, disabledRuleId,
}: {
  value: RuleFormValue;
  onChange: (v: RuleFormValue) => void;
  disabledRuleId?: boolean;
}) {
  const set = <K extends keyof RuleFormValue>(k: K, v: RuleFormValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="row">
        <label>ruleId</label>
        <input
          value={value.ruleId} onChange={(e) => set('ruleId', e.target.value)}
          disabled={disabledRuleId} placeholder="PRIV_KR_001 등"
        />
      </div>
      <div className="row">
        <label>domain</label>
        <input value={value.domain} onChange={(e) => set('domain', e.target.value)} placeholder="global / manufacturing-food ..." />
      </div>
      <div className="row">
        <label>locale</label>
        <input value={value.locale} onChange={(e) => set('locale', e.target.value)} placeholder="ko-KR / en / ja-JP / *" />
      </div>
      <div className="row">
        <label>ioType</label>
        <select value={value.ioType} onChange={(e) => set('ioType', e.target.value as IoType)}>
          {IO_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="row">
        <label>category</label>
        <input value={value.category} onChange={(e) => set('category', e.target.value)} placeholder="pii / compliance / ip / safety ..." />
      </div>
      <div className="row">
        <label>subCategory</label>
        <input value={value.subCategory ?? ''} onChange={(e) => set('subCategory', e.target.value)} placeholder="national_id_kr 등" />
      </div>
      <div className="row">
        <label>severity</label>
        <select value={value.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
          {SEVERITIES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="row">
        <label>priority (0-1000)</label>
        <input type="number" value={value.priority} onChange={(e) => set('priority', Number(e.target.value))} />
      </div>
      <div className="row">
        <label>action</label>
        <select value={value.action} onChange={(e) => set('action', e.target.value as Action)}>
          {ACTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="row">
        <label>version</label>
        <input value={value.version} onChange={(e) => set('version', e.target.value)} />
      </div>
      <div className="row" style={{ gridColumn: '1 / -1' }}>
        <label>patternBundle (JSON)</label>
        <textarea
          value={value.patternBundle}
          onChange={(e) => set('patternBundle', e.target.value)}
          rows={4}
          placeholder='{"regex":["..."],"luhnCheck":true}'
        />
      </div>
      <div className="row" style={{ gridColumn: '1 / -1' }}>
        <label>messageTemplate (JSON, locale → message)</label>
        <textarea
          value={value.messageTemplate}
          onChange={(e) => set('messageTemplate', e.target.value)}
          rows={3}
          placeholder='{"ko-KR":"...", "en":"..."}'
        />
      </div>
      <div className="row" style={{ gridColumn: '1 / -1' }}>
        <label>regulationTags (콤마 구분)</label>
        <input
          value={value.regulationTags}
          onChange={(e) => set('regulationTags', e.target.value)}
          placeholder="KR_PIPA, EU_GDPR"
        />
      </div>
      <div className="row">
        <label>examplesPositive (줄바꿈 구분)</label>
        <textarea value={value.examplesPositive} onChange={(e) => set('examplesPositive', e.target.value)} rows={3} />
      </div>
      <div className="row">
        <label>examplesNegative (줄바꿈 구분)</label>
        <textarea value={value.examplesNegative} onChange={(e) => set('examplesNegative', e.target.value)} rows={3} />
      </div>
      <div className="row" style={{ gridColumn: '1 / -1' }}>
        <label>
          <input
            type="checkbox" checked={value.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          /> enabled
        </label>
      </div>
    </div>
  );
}
