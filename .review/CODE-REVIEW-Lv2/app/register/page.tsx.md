# app/register/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../INDEX.md)

## 파일 요약
- 역할: 3-step 회원가입 wizard (form → totp → done). 등록 직후 password-only 로그인 → JWT 획득 → TOTP enable.
- 진입점 거리: 0 (라우트 진입).
- LOC: 177
- export: default `RegisterPage`, `dynamic = 'force-dynamic'`
- 의존 모듈: `next/navigation`, `next/link`, `@/lib/api`, `@/lib/auth`, `@/lib/types`
- 외부 패키지: react, next
- 부수효과: localStorage 저장, router.replace
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/register/page.tsx lines=1-72
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { storeSession, updateStoredUser } from '@/lib/auth';
import type { RegisterResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Step = 'form' | 'totp' | 'done';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registered, setRegistered] = useState<RegisterResponse | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.register(email, password);
      setRegistered(r);
      setStep('totp');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!registered) return;
    setError(null);
    setLoading(true);
    try {
      // TOTP gate is OFF immediately after register, so password-only login
      // succeeds and yields a JWT we can use to call /admin/auth/totp/enable.
      const login = await api.login(email, password);
      storeSession(login);

      await api.enableTotp(totpCode);
      updateStoredUser({ totpEnabled: true });
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function skipTotp() {
    if (!registered) return;
    setSkipping(true);
    setError(null);
    try {
      const login = await api.login(email, password);
      storeSession(login);
      router.replace('/dashboard');
    } catch (err) {
      setError((err as Error).message);
      setSkipping(false);
    }
  }
```

**분석 (Level 2) — flow**
- L16 `Step = 'form' | 'totp' | 'done'`: 작은 상태기. enum 대신 union — TS-친화적.
- L28-37 `submitRegister`: api.register → setRegistered → step='totp'. catch 에서 finally 가 loading 을 false 로 reset — OK.
- L39-57 `enableTotp`: 등록 직후 password-only login 으로 JWT 획득 후 TOTP enable. **주석이 명확** (L46-47: "TOTP gate is OFF immediately after register").
  - L54 catch 분기: finally 없음 — 성공 시 loading 그대로 두는 것이 의도일 수 있으나 step='done' 으로 가면 loading 가 더 이상 표시되지 않음. catch 에서만 setLoading(false). 비대칭이지만 동작 OK.
- L48 `storeSession(login)`: localStorage 에 세션 저장.
- L51 `await api.enableTotp(totpCode)`: 실패 시 catch — 그러나 이 시점에 이미 세션이 저장되어 있어 사용자가 `setStep('done')` 으로 못 가도 다음에 settings 로 가 TOTP 활성화 가능. 부분-상태이지만 회복 가능.
- L59-71 `skipTotp`: TOTP 없이 로그인 후 /dashboard. **여기서 사용자가 TOTP 등록을 영구 회피 가능** — 정책상 강제 등록이 필요하면 백엔드가 미등록 사용자에게 protected route 접근을 제한해야 함.

```tsx path=app/register/page.tsx lines=74-177
  // ───── Step 1: Email + password ─────
  if (step === 'form') {
    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={submitRegister}>
          <h1>회원가입</h1>
          {error && <div className="toast error">{error}</div>}
          <div className="row">
            <label>이메일</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} autoFocus
            />
          </div>
          <div className="row">
            <label>비밀번호 (8자 이상)</label>
            <input
              type="password" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? '가입 중...' : '가입하기'}
          </button>
          <div className="alt">
            이미 계정이 있나요? <Link href="/login">로그인</Link>
          </div>
        </form>
      </div>
    );
  }

  // ───── Step 2: TOTP enroll ─────
  if (step === 'totp' && registered) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ maxWidth: 560 }}>
          <h1>TOTP 등록</h1>
          <div className="toast success">
            계정이 생성되었습니다. 보안 강화를 위해 아래 QR을 Authenticator 앱에 등록하고 6자리 코드를 입력하세요.
          </div>
          {error && <div className="toast error">{error}</div>}

          <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'start', flexWrap: 'wrap' }}>
            <div className="qr-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={registered.totp.qrDataUrl} width={180} height={180} alt="TOTP QR" />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                수동 입력용 secret:{' '}
                <code style={{ wordBreak: 'break-all' }}>{registered.totp.secret}</code>
              </div>
              <form onSubmit={enableTotp}>
                <div className="row">
                  <label>Authenticator 6자리 코드</label>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]{6}"
                    maxLength={6} required autoFocus
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" type="submit" disabled={loading || totpCode.length !== 6}>
                    {loading ? '등록 중...' : 'TOTP 활성화 + 로그인'}
                  </button>
                  <button
                    type="button" className="btn subtle"
                    onClick={skipTotp} disabled={skipping}
                    title="나중에 설정 페이지에서 TOTP를 활성화할 수 있습니다"
                  >
                    {skipping ? '건너뛰는 중...' : '나중에 설정'}
                  </button>
                </div>
              </form>
              <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
                Google Authenticator / 1Password / Authy 등 호환. QR을 스캔한 뒤 표시되는 6자리 숫자를 입력하면
                다음 로그인부터 TOTP gate가 적용됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───── Step 3: Done ─────
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>완료</h1>
        <div className="toast success">
          TOTP가 활성화되었습니다. 대시보드로 이동합니다.
        </div>
        <button className="btn" onClick={() => router.replace('/dashboard')}>
          대시보드로 이동
        </button>
      </div>
    </div>
  );
}
```

**분석 (Level 2) — UI**
- L91 `minLength={8}`: 클라이언트 검증. 백엔드도 동일한 정책이어야 함.
- L120 `<img src={registered.totp.qrDataUrl}>`: data: URL 의 QR. `next/image` 가 data URL 을 처리하지 못해 `<img>` 로 우회 — ESLint 룰 비활성화 코멘트. 위험 분석:
  - data URL 이 백엔드에서 생성 — 신뢰 가능 출처. 그러나 사용자가 백엔드 응답을 가로채면 임의 이미지 주입 가능. HTTPS 와 백엔드 무결성에 의존.
  - `width/height` 가 명시되어 CLS 발생 없음.
- L125 `<code>{registered.totp.secret}</code>`: secret 평문 노출. **회원가입 직후 단일 시점**에만 보이므로 UX 적정. 화면 캡처 위험은 사용자 책임.
- L131 input attributes: TOTP UI 양호.
- L139 `disabled={loading || totpCode.length !== 6}`: 6자리 검증 — 좋다.
- L143 `onClick={skipTotp}`: 사용자가 skip 가능 — 정책 결정 사항. UX 친화.
- L162-174 Step 3: 자동 redirect 없음 — 사용자가 명시적으로 버튼 클릭. OK.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`/`Function()`: 없음.
- `<img src=dataUrl>`: 데이터 URL 자체는 코드 실행 위험 없음 (PNG/SVG 등). SVG 라면 내부 `<script>` 가 위험할 수 있는데, QR PNG 가정. 백엔드 응답을 신뢰함을 명시화 권고.
- TOTP secret 평문 노출: 의도된 UX. **secret 을 console.log 하거나 분석 툴로 보내면 안 됨** — 본 파일 코드는 그러지 않음.
- 비밀번호 minLength=8: 약함 (12자, 복잡도 정책 권고). 백엔드 정책이 우선.
- JWT 저장 → lib/auth.ts (localStorage).
- autocomplete attributes 부재: `new-password`, `email`, `one-time-code` 권고.
- self-elevation: `api.register(email, password)` 호출에 role 미지정 — 백엔드가 기본 role 강제. 다만 lib/api.ts 의 register 시그니처는 role 인자를 받아 — 호출부에서 무시하더라도 SDK 사용 시 위험 (lib/api.ts 평가 참조).

**파일 수준 평가**
- 강점
  1. 3-step wizard 상태기 명확.
  2. TOTP 등록 직후 단일 화면에서 secret + QR 노출 (사용성).
  3. enableTotp/skipTotp 두 갈래 흐름 처리.
- 위험
  1. enableTotp catch 의 비대칭 setLoading.
  2. TOTP 강제 등록 정책 없음 — skipTotp 로 우회 가능.
  3. autocomplete 누락.
- 개선 권고
  1. catch 후 finally 로 loading 통일.
  2. 정책상 TOTP 가 필수면 skip 버튼 제거 또는 백엔드가 TOTP 미등록 사용자의 protected route 차단.
  3. `autoComplete` attributes 추가.
- 재읽기 권고 레벨: **MEDIUM** — TOTP 정책 결정 시 재방문.
