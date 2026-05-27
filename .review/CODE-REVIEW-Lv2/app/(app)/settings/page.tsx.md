# app/(app)/settings/page.tsx — 코드 리뷰
> 리뷰 레벨: 2
> [← INDEX.md](../../../../INDEX.md)

## 파일 요약
- 역할: 계정 정보 표시 + TOTP 활성화 + 비밀번호 변경.
- 진입점 거리: 0 (라우트 진입).
- LOC: 119
- export: default `SettingsPage`
- 의존 모듈: `@/lib/api`, `@/lib/auth`, `@/lib/types`
- 외부 패키지: react
- 부수효과: me + totpQr + enableTotp + changePassword + updateStoredUser
- 동시성/렌더 경계: `'use client'`
- 테스트 커버리지: 0

```tsx path=app/(app)/settings/page.tsx lines=1-58
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { updateStoredUser } from '@/lib/auth';
import type { AuthedUser } from '@/lib/types';

export default function SettingsPage() {
  const [me, setMe] = useState<AuthedUser | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.me();
        setMe(m);
        if (!m.totpEnabled) {
          const qr = await api.totpQr();
          setQrUrl(qr.qrDataUrl);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setToast(null);
    try {
      await api.enableTotp(totpCode);
      setToast('TOTP gate가 활성화되었습니다.');
      setTotpCode('');
      const m = await api.me();
      setMe(m);
      updateStoredUser({ totpEnabled: m.totpEnabled });
      setQrUrl(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setToast(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setToast('비밀번호가 변경되었습니다.');
      setCurrentPassword(''); setNewPassword('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
```

**분석 (Level 2) — 핸들러**
- L17-29 mount fetch: me → (필요 시) totpQr. 두 호출 순차. me 성공 후 totpEnabled false 일 때만 QR 호출 — 좋다.
- L31-46 enableTotp: try/catch. setToast → setTotpCode('') → me 재조회 → updateStoredUser → setQrUrl(null). 성공 시 QR 사라지고 토스트.
- L40 `updateStoredUser({ totpEnabled: m.totpEnabled })`: localStorage user 메타 동기화. Sidebar 가 다음 렌더에서 반영. 좋다.
- L48-58 changePassword: 비번 변경 후 currentPassword/newPassword 클리어. **새 토큰 발급 없음** — 백엔드가 비번 변경 후 기존 JWT 를 무효화하는지 정책 확인 필요. 무효화한다면 다음 API 호출에서 401 → 자동 로그아웃. 그대로 사용 가능하다면 보안 이슈 (잠재 탈취된 토큰 계속 유효).

```tsx path=app/(app)/settings/page.tsx lines=60-119
  return (
    <>
      <h1>설정</h1>
      {error && <div className="toast error">{error}</div>}
      {toast && <div className="toast success">{toast}</div>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>계정</h2>
        <div className="muted">email: {me?.email ?? '—'}</div>
        <div className="muted">role: {me?.role ?? '—'}</div>
        <div className="muted">status: {me?.status ?? '—'}</div>
        <div className="muted">TOTP: {me?.totpEnabled ? '활성화' : '비활성'}</div>
      </div>

      {!me?.totpEnabled && qrUrl && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>TOTP 활성화</h2>
          <p className="muted">
            아래 QR을 Authenticator 앱에 등록한 뒤 6자리 코드를 입력하면 TOTP gate가 활성화됩니다.
          </p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
            <div className="qr-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} width={180} height={180} alt="TOTP QR" />
            </div>
            <form onSubmit={enableTotp} style={{ flex: 1 }}>
              <div className="row">
                <label>6자리 코드</label>
                <input
                  type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  value={totpCode} onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456" required
                />
              </div>
              <button className="btn" type="submit" disabled={totpCode.length !== 6}>TOTP 활성화</button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>비밀번호 변경</h2>
        <form onSubmit={changePassword} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="row">
            <label>현재 비밀번호</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="row">
            <label>새 비밀번호 (8자 이상)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="btn" type="submit">변경</button>
          </div>
        </form>
      </div>
    </>
  );
}
```

**분석 (Level 2) — UI**
- L83 `<img src={qrUrl}>`: 데이터 URL. register/page.tsx 와 동일 패턴 — `next/image` 우회.
- L89-93 TOTP input: pattern/maxLength/inputMode. 좋다.
- L94 `disabled={totpCode.length !== 6}`: 정확히 6자리. OK.
- L100-114 비번 변경 폼: 새 비번 confirmation 필드 없음 — 오타 위험. 추가 권고.
- L106 currentPassword 에 minLength 없음 (이미 가입된 비밀번호이므로 8자 미만일 수 없다는 가정).
- L109 `minLength={8}`: 새 비번. 동일 정책 8자 — 가입 시와 일치.

**짚어볼 점 (frontend security)**
- `dangerouslySetInnerHTML`/`eval`: 없음.
- `<img src=dataUrl>`: register 와 동일 — 백엔드 신뢰.
- 비번 변경 시 백엔드의 토큰 무효화 정책 확인 필요.
- autocomplete 누락: `current-password`, `new-password`, `one-time-code`.
- 비번 확인 필드 부재 — 사용자 오타 가능.
- enableTotp 후 lib/auth.updateStoredUser 호출 — XSS 가 있으면 이 localStorage 변경을 가로챔. 본 파일 자체 위험 아님.

**파일 수준 평가**
- 강점
  1. me + qr 조건부 호출.
  2. 활성화 후 상태 동기화 (me 재조회 + updateStoredUser).
  3. 6자리 정확 검증.
- 위험
  1. 비번 변경 후 토큰 무효화 정책 불명.
  2. 새 비번 확인 필드 없음.
  3. autocomplete 누락.
- 개선 권고
  1. 백엔드 정책: 비번 변경 시 토큰 무효화 + 클라이언트 자동 재로그인.
  2. 비번 확인 필드 + 일치 검증.
  3. `autoComplete` 추가.
- 재읽기 권고 레벨: **MEDIUM**.
