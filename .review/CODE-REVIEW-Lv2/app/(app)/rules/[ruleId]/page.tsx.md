# app/(app)/rules/[ruleId]/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../../INDEX.md)

## 파일 요약
- 역할: 룰 편집/삭제 페이지. `useParams` → getRule → RuleForm → updateRule/deleteRule.
- 진입점 거리: 0 (동적 라우트 진입).
- LOC: 74
- export: default `EditRulePage`
- 의존 모듈: `next/link`, `next/navigation`, `@/components/RuleForm`, `@/lib/api`
- 외부 패키지: react, next
- 부수효과: useEffect mount 시 getRule, submit 시 updateRule, remove 시 deleteRule
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/rules/[ruleId]/page.tsx lines=1-74
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import RuleForm, { formToDto, ruleToForm, type RuleFormValue } from '@/components/RuleForm';
import { api } from '@/lib/api';

export default function EditRulePage() {
  const router = useRouter();
  const params = useParams<{ ruleId: string }>();
  const ruleId = decodeURIComponent(params.ruleId);
  const [value, setValue] = useState<RuleFormValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getRule(ruleId);
        setValue(ruleToForm(r));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [ruleId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setError(null);
    setLoading(true);
    try {
      await api.updateRule(ruleId, formToDto(value));
      setToast('저장 완료');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm(`'${ruleId}' 삭제할까요?`)) return;
    try {
      await api.deleteRule(ruleId);
      router.push('/rules');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>룰 편집 <code>{ruleId}</code></h1>
      {error && <div className="toast error">{error}</div>}
      {toast && <div className="toast success">{toast}</div>}
      {!value ? (
        <div className="muted">로딩 중...</div>
      ) : (
        <form className="card" onSubmit={submit}>
          <RuleForm value={value} onChange={setValue} disabledRuleId />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={loading}>{loading ? '저장 중...' : '저장'}</button>
            <Link href="/rules" className="btn subtle">목록</Link>
            <button type="button" className="btn danger" onClick={remove} style={{ marginLeft: 'auto' }}>삭제</button>
          </div>
        </form>
      )}
    </>
  );
}
```

**분석 (Level 2)**
- L12 **`decodeURIComponent(params.ruleId)`**: Next.js 가 dynamic segment 를 이미 한 번 decode 한다. 추가 decode 는 (a) 정상 ruleId 가 `%` 포함이 아닐 때 무해, (b) **이중 인코딩된 ruleId** (`%2520` → `%20` → ` ` 가 아닌, ruleId 자체에 `%20` 같은 부분 문자열이 들어있는 경우) 가 들어오면 의도와 다르게 풀린다. 또한 RFC 3986 에 따르면 segment 의 `%` 를 일반 텍스트로 받는 경우는 거의 없으므로 실용상 위험 낮음, 그러나 **불필요 + 함정**. 제거 권고.
- L11 `useParams<{ ruleId: string }>()`: Next 14 의 generic. ruleId 가 항상 string — OK.
- L18-26 useEffect: ruleId 의존성. ruleId 가 바뀌면 (예: in-app navigation `/rules/A` → `/rules/B`) 자동 재로드. 좋다.
- L27 cancellation 없음 — A → B 빠르게 클릭하면 A 응답이 늦게 도착해 B 화면을 덮어쓸 수 있다 (race). `AbortController` 또는 `let alive` 패턴 권고.
- L29-40 submit: try/catch/finally. setToast 후 page navigation 없음 — 사용자가 편집 후 머무를 수 있도록 의도. /rules 로 가지 않는 선택은 새로 보기 옵션을 막아 일관성↓.
- L36 `await api.updateRule(ruleId, formToDto(value))`: URL path 의 ruleId 와 body 의 ruleId 가 다를 수 있다 (사용자가 ruleId 입력은 disabled 라 같지만, formToDto 가 value.ruleId 를 보낸다). 백엔드가 URL 우선 vs body 우선 결정해야 함.
- L43-50 remove: `confirm` 후 deleteRule → /rules 푸시. 부분 실패 시 catch → 에러 표시 + 페이지 유지.
- L60-64 폼 렌더: `disabledRuleId` 로 ruleId 잠금. 일관 UX.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- **이중 디코드**: 위 L12 — 데이터 무결성 위험 (의도된 ruleId 와 실제로 fetch 한 ruleId 가 어긋날 수 있음).
- `<code>{ruleId}</code>` 표시: React escape — XSS 안전.
- 클라이언트 권한 가드 없음 — 백엔드가 admin/super_admin 이 아닌 viewer 의 PUT/DELETE 를 403 으로 거부해야 함.
- 페이지 mount 후 useEffect 가 fetch 가 끝나기 전 사용자가 폼 제출 가능? — `!value` 일 때 폼이 렌더되지 않아 불가능. 안전.
- Open redirect: `router.push('/rules')` 정적 — 안전.

**파일 수준 평가**
- 강점
  1. mount/submit/remove 의 3-action 흐름 명료.
  2. value null 가드로 폼 마운트 차단.
  3. disabledRuleId 로 ruleId 무결성 보호.
- 위험
  1. `decodeURIComponent(params.ruleId)` 의 이중 디코드 — 함정.
  2. ruleId race (빠른 사이드 네비) cancellation 부재.
  3. submit 성공 시 페이지 유지 — body.ruleId 와 URL.ruleId 충돌 가능.
- 개선 권고
  1. `const ruleId = params.ruleId` 로 추가 decode 제거.
  2. AbortController 도입.
  3. `formToDto` 에 ruleId 를 path 인자와 동일하게 강제하거나 body 에서 ruleId 제거.
- 재읽기 권고 레벨: **HIGH** — 이중 디코드 수정 + DTO 명세 합치.
