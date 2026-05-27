# app/(app)/rules/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../INDEX.md)

## 파일 요약
- 역할: 룰 목록. 필터/페이지네이션/벌크 선택/삭제.
- 진입점 거리: 0 (라우트 진입).
- LOC: 203
- export: default `RulesPage`
- 의존 모듈: `next/link`, `@/lib/api`, `@/lib/types`
- 외부 패키지: react, next
- 부수효과: useEffect+useCallback 으로 listRules, deleteRule, bulkDelete
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/rules/page.tsx lines=1-44
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Rule } from '@/lib/types';

const CATEGORIES = [
  '', 'pii', 'compliance', 'ip', 'safety', 'financial', 'health',
  'credentials', 'location', 'sensitive', 'children', 'biometrics',
  'fraud', 'prompt_injection', 'scope', 'hallucination',
];

export default function RulesPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [total, setTotal] = useState(0);
  const [domain, setDomain] = useState('');
  const [locale, setLocale] = useState('');
  const [ioType, setIoType] = useState('');
  const [category, setCategory] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listRules({ domain, locale, ioType, category, enabledOnly, limit, offset });
      setItems(r.items);
      setTotal(r.total);
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [domain, locale, ioType, category, enabledOnly, limit, offset]);

  useEffect(() => { load(); }, [load]);
```

**분석 (Level 2) — state + load**
- L8-12 `CATEGORIES`: 첫 원소 `''` 가 "전체" 옵션. types.ts 의 enum 과 별도 — drift 위험.
- L15-27 상태 10개: 단일 컴포넌트가 너무 많은 상태를 보유. `useReducer` 또는 URL state (search params) 분리 권고. **현재 필터가 URL 에 반영되지 않아 새로고침 시 손실**.
- L26 `useState(50)` 의 setter 미사용 — `const limit = 50` 으로 충분.
- L29-42 `load` useCallback: 의존성에 모든 필터 + limit/offset. 필터 변경 시 useEffect 가 재실행 → debounce 없음 — input 타이핑마다 fetch 발사. **API 트래픽 폭주 위험**.
- L36 `setSelected(new Set())`: 새로고침 시 선택 리셋 — 의도된 동작.
- L44 `useEffect(() => { load(); }, [load])`: load 가 의존성 — useCallback 덕에 안정적.
- **unmount race**: cancellation 없음. 빠른 라우트 이탈 + filter 입력으로 인한 setState-after-unmount.

```tsx path=app/(app)/rules/page.tsx lines=46-78
  function toggle(ruleId: string) {
    const next = new Set(selected);
    if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((r) => r.rule_id)));
  }

  async function deleteOne(ruleId: string) {
    if (!confirm(`'${ruleId}' 삭제할까요?`)) return;
    try {
      const r = await api.deleteRule(ruleId);
      setToast(`삭제 완료 (${r.deleted}건)`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`선택된 ${selected.size}건을 삭제할까요?`)) return;
    try {
      const r = await api.bulkDelete([...selected]);
      setToast(`벌크 삭제 완료 (${r.deleted}/${r.requested}건)`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
```

**분석 (Level 2) — 액션**
- L46-50 toggle: immutable Set 패턴. OK.
- L51-54 toggleAll: 현재 페이지 items 만 — 다른 페이지로 넘기면 선택 리셋 (load 가 호출되어). 동작 OK.
- L57 `confirm(... ${ruleId} ...)`: 네이티브 confirm — `ruleId` 가 사용자 입력에서 만들어진 값이지만 confirm 메시지는 평문 string 이라 XSS 없음. 다만 UX 가 dated — 모달 컴포넌트로 교체 권고.
- L59 `api.deleteRule(ruleId)`: encodeURIComponent 는 api.ts 내부에서 처리.
- L60 `setToast(...)`: 토스트만 표시 → load → setSelected reset. 토스트는 새 load 후에도 유지 (재설정 안 함).
- L66 `confirm(...)` 동일.
- L68 `api.bulkDelete([...selected])`: Set→Array. OK.
- error 표시는 동일 자리(setError) → 이전 토스트와 충돌 가능 (toast + error 동시 표시).

```tsx path=app/(app)/rules/page.tsx lines=80-203
  return (
    <>
      <h1>룰 목록 <span className="muted">({total}건)</span></h1>
      {error && <div className="toast error">{error}</div>}
      {toast && <div className="toast success">{toast}</div>}

      <div className="toolbar">
        <div>
          <label>domain</label>
          <input value={domain} onChange={(e) => { setOffset(0); setDomain(e.target.value); }} placeholder="global, manufacturing-food..." />
        </div>
        <div>
          <label>locale</label>
          <input value={locale} onChange={(e) => { setOffset(0); setLocale(e.target.value); }} placeholder="ko-KR / en" />
        </div>
        <div>
          <label>ioType</label>
          <select value={ioType} onChange={(e) => { setOffset(0); setIoType(e.target.value); }}>
            <option value="">전체</option>
            <option value="input">input</option>
            <option value="output">output</option>
            <option value="both">both</option>
          </select>
        </div>
        <div>
          <label>category</label>
          <select value={category} onChange={(e) => { setOffset(0); setCategory(e.target.value); }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c || '전체'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ visibility: 'hidden' }}>x</label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={enabledOnly} onChange={(e) => setEnabledOnly(e.target.checked)} />
            enabled only
          </label>
        </div>
        <div>
          <label style={{ visibility: 'hidden' }}>x</label>
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? '로딩...' : '새로고침'}
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <label style={{ visibility: 'hidden' }}>x</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/rules/new" className="btn">+ 룰 추가</Link>
            <Link href="/rules/import" className="btn secondary">CSV import</Link>
            <button className="btn danger" disabled={selected.size === 0} onClick={deleteSelected}>
              선택 삭제 ({selected.size})
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                />
              </th>
              <th>ruleId</th>
              <th>domain</th>
              <th>locale</th>
              <th>io</th>
              <th>category</th>
              <th>sub</th>
              <th>severity</th>
              <th>action</th>
              <th>source</th>
              <th style={{ textAlign: 'right' }}>actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.rule_id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.rule_id)}
                    onChange={() => toggle(r.rule_id)}
                  />
                </td>
                <td><Link href={`/rules/${encodeURIComponent(r.rule_id)}`}><code>{r.rule_id}</code></Link></td>
                <td>{r.domain}</td>
                <td>{r.locale}</td>
                <td>{r.io_type}</td>
                <td>{r.category}</td>
                <td className="muted">{r.sub_category ?? '—'}</td>
                <td><span className={`badge severity-${r.severity}`}>{r.severity}</span></td>
                <td><span className="badge action">{r.action}</span></td>
                <td className="muted">{r.source}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link href={`/rules/${encodeURIComponent(r.rule_id)}`} className="btn subtle">편집</Link>
                  {' '}
                  <button className="btn danger" onClick={() => deleteOne(r.rule_id)}>삭제</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={11} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                결과 없음. 필터를 변경하거나 룰을 추가하세요.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <span className="muted">offset {offset} / total {total}</span>
        <div>
          <button className="btn secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>← 이전</button>
          {' '}
          <button className="btn secondary" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>다음 →</button>
        </div>
      </div>
    </>
  );
}
```

**분석 (Level 2) — UI**
- L88-95 input 들의 onChange 에서 `setOffset(0)` + 필터 setter — 필터 변경 시 페이지 1로 리셋. 좋다.
- L110/117/123 `label style={{ visibility: 'hidden' }}>x</label>`: 정렬을 위한 hack. ARIA 적합 — `aria-hidden` 또는 spacer div 권고.
- L139 `checked={items.length > 0 && selected.size === items.length}`: 부분 선택 시 indeterminate 미표시. ref 로 `indeterminate=true` 설정 권고.
- L167 `<Link href={`/rules/${encodeURIComponent(r.rule_id)}`}>`: encode 적용. 그러나 동적 라우트의 `[ruleId]/page.tsx` 가 `decodeURIComponent(params.ruleId)` 를 또 호출 — Next 가 자동 decode 하므로 이중 디코드 (별도 평가에서 지적).
- L173 `<span className={`badge severity-${r.severity}`}>`: severity 가 union('low'|...) 이라 안전. 만약 backend 가 미지의 severity 를 보내면 `severity-?` 클래스 — CSS 미적용일 뿐 XSS 없음.
- L184-187 빈 상태: 명확.
- L195 페이지네이션: offset 기반. `offset + limit >= total` 가드 — 마지막 페이지에서 다음 버튼 비활성. OK.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- 모든 출력 React escape — XSS 안전.
- 네이티브 `confirm()`: 사용자 입력은 confirm 메시지 내 평문 — 인용 부호로 묶여있어 시각 혼동 가능하지만 보안 영향 없음.
- DELETE + body (bulkDelete): 일부 프록시가 body 를 버릴 수 있다 — api.ts 평가 참조.
- 필터/페이지가 URL 에 반영되지 않아 (deep link 부재) 새로고침 시 손실. 보안 아닌 UX.

**파일 수준 평가**
- 강점
  1. 명확한 필터/페이지/벌크 UI.
  2. 필터 변경 시 offset 리셋.
  3. encode-on-link.
- 위험
  1. 필터 입력 시 debounce 부재 — 매 키스트로크마다 listRules 호출.
  2. 필터 상태가 URL 에 없어 deep link 불가.
  3. unmount race + 다중 toast/error 경합.
- 개선 권고
  1. `useDeferredValue` 또는 debounce 200ms.
  2. 필터를 `useSearchParams` + `router.replace(?...)` 로 URL 동기화.
  3. `useReducer` 로 상태 폭발 정리.
- 재읽기 권고 레벨: **MEDIUM** — 운영 트래픽 발생 시점에 debounce 검토.
