# app/(app)/rules/new/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../../INDEX.md)

## 파일 요약
- 역할: 룰 신규 작성. emptyForm 으로 시작 → submit → createRule → /rules 푸시.
- 진입점 거리: 0 (정적 라우트 진입).
- LOC: 43
- export: default `NewRulePage`
- 의존 모듈: `next/link`, `next/navigation`, `@/components/RuleForm`, `@/lib/api`
- 외부 패키지: react, next
- 부수효과: submit 시 createRule, router.push
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/rules/new/page.tsx lines=1-43
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RuleForm, { emptyForm, formToDto, type RuleFormValue } from '@/components/RuleForm';
import { api } from '@/lib/api';

export default function NewRulePage() {
  const router = useRouter();
  const [value, setValue] = useState<RuleFormValue>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const dto = formToDto(value);
      await api.createRule(dto);
      router.push('/rules');
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <h1>룰 추가</h1>
      {error && <div className="toast error">{error}</div>}
      <form className="card" onSubmit={submit}>
        <RuleForm value={value} onChange={setValue} />
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? '저장 중...' : '저장'}</button>
          <Link href="/rules" className="btn subtle">취소</Link>
        </div>
      </form>
    </>
  );
}
```

**분석 (Level 2)**
- L11 `useState(emptyForm())`: emptyForm 이 매 렌더마다 호출되지 않는 점은 useState 가 첫 호출만 사용하기 때문 — lazy init `() => emptyForm()` 으로 명시 권고 (현재 emptyForm 은 단순 객체 리터럴이라 비용 0, 무해).
- L15-26 submit: try/catch. 성공 시 `router.push('/rules')` — back 으로 다시 new 페이지에 올 수 있어 OK.
- L23 catch 안에서 setLoading(false). finally 가 아니므로 성공 시 loading=true 상태로 페이지 이탈 — 동작에는 영향 없음 (페이지 unmount).
- L21 `formToDto(value)`: silent JSON fallback 위험 — RuleForm 평가에서 지적. 잘못된 JSON 이 빈 객체로 전송됨.
- L33 `<RuleForm value={value} onChange={setValue} />`: disabledRuleId 없음 — 신규는 ruleId 자유 입력.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- 권한 가드: 클라이언트 측 없음. 백엔드가 viewer 의 POST /admin/rules 를 거부해야 함.
- 사용자 입력 ruleId: encodeURIComponent 가 api.createRule 내부에서 적용 — 안전.
- Open redirect: 정적 — 안전.
- emptyForm 의 default category 'pii', severity 'high', action 'block' — 안전한 기본값.

**파일 수준 평가**
- 강점
  1. 43 LOC 의 명료한 wizardless 폼.
  2. 적절한 안전 기본값(severity/action).
  3. router.push 성공 후 /rules 로 이동.
- 위험
  1. formToDto silent fallback (RuleForm 위험).
  2. catch 에서 setLoading(false) 만 — 패턴 비대칭 (편집은 finally).
- 개선 권고
  1. submit catch/finally 를 [ruleId]/page.tsx 와 동일하게 통일.
  2. ruleId 중복 시 백엔드 응답(409 등) 을 사용자 친화 메시지로 변환.
- 재읽기 권고 레벨: **LOW**.
