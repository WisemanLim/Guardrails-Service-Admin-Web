# app/(app)/rules/import/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../../INDEX.md)

## 파일 요약
- 역할: CSV 대량 import. 템플릿 다운로드 + 파일 업로드 + 결과 표시.
- 진입점 거리: 0 (라우트 진입).
- LOC: 100
- export: default `ImportPage`
- 의존 모듈: `next/link`, `@/lib/api`
- 외부 패키지: react, next
- 부수효과: importCsv POST, Blob/URL.createObjectURL 다운로드
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/rules/import/page.tsx lines=1-44
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface ImportResult {
  ok: boolean;
  total: number;
  accepted: number;
  rejected: { row: number; reason: string; raw: Record<string, string> }[];
}

const CSV_TEMPLATE = `ruleId,domain,locale,ioType,category,subCategory,severity,priority,action,patternBundle,messageTemplate,regulationTags,examplesPositive,examplesNegative,enabled,version
PRIV_KR_999,global,ko-KR,input,pii,national_id_kr,critical,950,block,{},"{""ko-KR"":""주민번호 입력 불가""}",KR_PIPA|EU_GDPR,예시,반례,1,1.0.0`;

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null); setResult(null); setLoading(true);
    try {
      const r = await api.importCsv(file) as ImportResult;
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'guardrails-rules-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
```

**분석 (Level 2) — 코어**
- L7-12 `ImportResult` 로컬 인터페이스: `api.ts` 의 `importCsv` 반환 (`rejected: any[]`) 을 좁힘. 단 `as ImportResult` 캐스트 — 백엔드 응답 형태가 다르면 런타임 폭발.
- L14-15 `CSV_TEMPLATE`: 인라인 상수. JSON 안에 `""` 이스케이프 정상.
- L17-23 상태 4개.
- L25 `if (!file) return`: 가드 OK. 그러나 button 의 `disabled={!file || loading}` 와 중복.
- L26 `setResult(null)`: 이전 결과 클리어.
- L28 `api.importCsv(file) as ImportResult`: 캐스트.
- L37-44 `downloadTemplate`: Blob + createObjectURL + anchor click + revokeObjectURL — 표준 패턴. `revokeObjectURL` 을 `a.click()` **직후 즉시** 호출하는데, 브라우저 다운로드 트리거가 비동기여서 일부 환경(Safari)에서 즉시 revoke 시 다운로드 실패 가능. `setTimeout(..., 0)` 권고.
- L41 `a.click()`: programmatic click — DOM 에 append 안 했는데 동작. modern 브라우저 OK.

```tsx path=app/(app)/rules/import/page.tsx lines=46-100
  return (
    <>
      <h1>CSV 대량 import</h1>
      {error && <div className="toast error">{error}</div>}

      <div className="card">
        <p className="muted">
          헤더 행 필수 (대소문자 구분). JSON 컬럼(`patternBundle`, `messageTemplate`)은 valid JSON, 배열 컬럼은 valid JSON 또는 pipe(`|`) 구분 문자열.
        </p>
        <button className="btn subtle" type="button" onClick={downloadTemplate}>샘플 CSV 다운로드</button>
        <pre style={{ marginTop: 12 }}>{CSV_TEMPLATE}</pre>
      </div>

      <form className="card" onSubmit={submit}>
        <div className="row">
          <label>CSV 파일 (최대 20MB)</label>
          <input
            type="file" accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={!file || loading}>{loading ? '업로드 중...' : '업로드'}</button>
          <Link href="/rules" className="btn subtle">목록으로</Link>
        </div>
      </form>

      {result && (
        <>
          <div className={`toast ${result.rejected.length === 0 ? 'success' : 'info'}`}>
            total={result.total}, accepted={result.accepted}, rejected={result.rejected.length}
          </div>
          {result.rejected.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>row</th><th>reason</th><th>ruleId</th><th>raw</th></tr></thead>
                <tbody>
                  {result.rejected.map((r, i) => (
                    <tr key={i}>
                      <td>{r.row}</td>
                      <td className="muted">{r.reason}</td>
                      <td><code>{r.raw?.ruleId ?? '—'}</code></td>
                      <td><pre style={{ whiteSpace: 'pre-wrap', maxWidth: 480 }}>{JSON.stringify(r.raw, null, 2)}</pre></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
```

**분석 (Level 2) — UI**
- L61 `accept=".csv,text/csv"`: 보호용 hint — 사용자가 다른 파일을 강제 첨부 가능. 백엔드 검증 필수.
- L62 `e.target.files?.[0] ?? null`: 단일 파일.
- L62 **파일 크기 클라이언트 검증 없음**: 라벨에 "최대 20MB" 라고 적혀있지만 실제 검증은 백엔드만. 5GB 파일 업로드 시도 시 네트워크 자원 낭비. `file.size > 20*1024*1024` 가드 권고.
- L82-83 `<pre>{JSON.stringify(r.raw, null, 2)}</pre>`: rejected 행의 raw JSON 표시. React text-node — XSS 안전.
- L83 `key={i}`: 인덱스 키 — 정렬 변경 없으므로 OK.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- 파일 업로드 → multipart/form-data. api.ts 의 `importCsv` 가 FormData 구성. Content-Type 자동 boundary — OK.
- 사용자가 업로드한 CSV 의 **악성 macro** (예: =cmd|...): 표시는 안전 (pre 텍스트), 그러나 사용자가 다운로드 받은 CSV 를 Excel 로 열 때 발화 가능. UI 영향 0.
- 파일 사이즈 가드 부재 — DoS 표면.
- `revokeObjectURL` 타이밍 함정.

**파일 수준 평가**
- 강점
  1. 템플릿 다운로드 + 결과 표시 + rejected 상세.
  2. 명확한 ImportResult 타입.
  3. 결과 toast 색 분기 (success/info).
- 위험
  1. 파일 크기 클라이언트 가드 없음.
  2. revokeObjectURL 즉시 호출 — Safari/일부 환경 실패 가능.
  3. `as ImportResult` 캐스트 — 백엔드 변경 시 런타임 폭발.
- 개선 권고
  1. `if (file.size > 20_000_000) return setError('파일이 20MB 초과')`.
  2. `setTimeout(() => URL.revokeObjectURL(url), 0)`.
  3. `ImportResult` 를 `lib/types.ts` 로 이동 + `api.importCsv` 반환 타입 좁힘.
- 재읽기 권고 레벨: **MEDIUM** — 파일 크기 가드 부재가 운영에서 표면화 가능.
