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
