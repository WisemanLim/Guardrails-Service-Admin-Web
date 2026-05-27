# components/RuleForm.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: Rule ↔ form value ↔ DTO 변환 + 입력 UI. controlled component 패턴.
- 진입점 거리: 2 (`rules/new`, `rules/[ruleId]`).
- LOC: 205 (최대 파일이지만 600 LOC 임계 미달 → block-mode 미적용)
- export: default `RuleForm`; `ruleToForm`, `emptyForm`, `formToDto`, `RuleFormValue` (type)
- 의존 모듈: `@/lib/types` (Rule, Severity, IoType, Action)
- 외부 패키지: react
- 부수효과: 없음 (pure controlled component)
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0 (단위 테스트 적정 — round-trip)

```tsx path=components/RuleForm.tsx lines=1-32
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
```

**분석 (Level 2) — 데이터 모델**
- L3 `import { useState } from 'react'` 가 있는데 본 파일에서 useState 미사용 — 죽은 import. 제거 가능.
- L6-12 enum 배열: literal union 과 1:1. Action 12개 전수 등록. 향후 새 액션 추가 시 두 곳(types.ts + 이 배열) 동기화 필요 — `Object.values` 또는 const-array-as-source-of-truth 패턴 권고.
- L14-31 `RuleFormValue`: JSON 컬럼을 **문자열로** 보관 (`patternBundle: string`, `messageTemplate: string`). 사용자가 자유 편집할 수 있어 UX 적절. CSV/newline 분리도 문자열 유지.

```tsx path=components/RuleForm.tsx lines=33-98
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
```

**분석 (Level 2) — 변환 함수**
- L33-52 `ruleToForm`: snake_case → camelCase 매핑 + 빈 배열/null 폴백. `version: r.version ?? '1.0.0'` 의 매직 문자열은 `emptyForm` 과 일치하나 두 곳에 중복 — 상수화 권고.
- L44-45 `JSON.stringify(... null, 2)`: 2-space indent 로 textarea 가독성 ↑.
- L75-94 `formToDto`: camelCase 로 보냄. 그러나 응답은 snake_case (`Rule`). **요청/응답 case 비대칭** — 백엔드가 변환을 책임지는 패턴. 이 비대칭은 `lib/types.ts` 평가에서도 지적.
- L82 `subCategory: v.subCategory || undefined`: 빈 문자열은 undefined 로 정규화 — JSON.stringify 가 키를 drop. OK.
- L84 `priority: Number(v.priority)`: 이미 number 인데 한 번 더 캐스팅. 폼이 string-typed input 이라도 onChange 에서 `Number(...)` 호출하므로 redundant 이지만 무해.
- L86-87 `patternBundle/messageTemplate: safeJson(..., {})`: **silent fallback** — 사용자가 JSON 을 잘못 입력해도 빈 객체로 전송. 토스트/에러 없음. INDEX.md 4.5 의 "silent fallback" 우려와 일치. 차라리 throw → form 레벨 에러 처리가 안전.
- L88-90 `split(',')`/`split('\n')`: 빈 문자열 입력 시 `['']` 이 되지만 `filter(Boolean)` 으로 제거. trim 도 적용. OK.
- L96-98 `safeJson(s, fb)`: 위 silent fallback 문제의 본진.

```tsx path=components/RuleForm.tsx lines=100-205
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
```

**분석 (Level 2) — UI**
- L107 `set` 헬퍼: 제네릭 K extends keyof — 타입 안전 partial update. 좋다.
- L130 `set('ioType', e.target.value as IoType)`: select 의 value 는 string 이고 옵션이 IO_TYPES 로 한정되므로 cast 안전. severity/action 동일.
- L149 `priority` input: type=number 이지만 React 의 `Number(...)` 적용 — 비어있을 때 `Number('')` 가 `0` 으로 들어감. 사용자가 한 글자 지운 순간 0 으로 점프 → UX 함정. 별도로 `value === '' ? 0 : Number(...)` 또는 string state 유지 권고.
- L164-169 patternBundle textarea: rows=4. JSON 검증 인디케이터 없음 — 입력 중 빨간 테두리 등 표시 권고.
- L173-178 messageTemplate textarea: 동일. placeholder 가 locale-key 패턴 안내.
- L195-201 enabled 체크박스: gridColumn 1/-1 로 전폭. label 안에 input 을 감싸는 패턴 — a11y OK.
- 전반: `disabledRuleId` props 가 ruleId 필드만 잠금. update 페이지에서 사용.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`/`Function()`: 없음.
- 사용자가 입력하는 JSON 은 `JSON.parse` 로만 처리되어 코드 실행 위험 없음.
- XSS: 모든 출력이 React escape. placeholder 도 안전.
- Open redirect, hardcoded URL: 없음.
- silent JSON fallback: 데이터 무결성 위험 — JSON 오류가 사용자에게 보이지 않은 채 빈 객체로 저장될 수 있음.
- 사용자 입력 길이 제한 없음: 사용자가 거대한 examples 를 넣으면 폼 전송이 거대해질 수 있다. UI/API 양쪽 가드 권고.

**파일 수준 평가**
- 강점
  1. controlled component + `set` 제네릭 헬퍼로 타입 안전 부분 갱신.
  2. enum 배열 ↔ literal union 일관성.
  3. ruleToForm/formToDto 의 양방향 변환을 명시.
- 위험
  1. `safeJson` 의 silent fallback — JSON 오류가 표면화되지 않음 (`{}` 로 전송).
  2. `priority` input 의 `Number('')→0` UX 함정.
  3. 죽은 import (`useState`).
- 개선 권고
  1. `formToDto` 에서 JSON 파싱 실패 시 throw, 호출부가 toast.
  2. priority/version 입력의 빈 값 정규화.
  3. ACTIONS/IO_TYPES/SEVERITIES 를 types.ts 의 const-array 단일 소스로 통합.
- 재읽기 권고 레벨: **MEDIUM** — DTO 명세 확정 (`api.createRule`/`updateRule` 의 any 제거) 와 함께 재방문.
