'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { storeSession } from '@/lib/auth';

// useSearchParams forces client-side rendering — opt out of static prerender.
export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    search?.get('reason') === 'expired' ? '세션이 만료되었습니다. 다시 로그인해주세요.' : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.login(email, password, totp || undefined);
      storeSession(r);
      router.replace('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h1>로그인</h1>
      {error && <div className="toast error">{error}</div>}
      <div className="row">
        <label>이메일</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div className="row">
        <label>비밀번호</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="row">
        <label>TOTP 코드 (등록된 경우)</label>
        <input
          type="text" inputMode="numeric" pattern="[0-9]{6}" placeholder="123456"
          value={totp} onChange={(e) => setTotp(e.target.value)} maxLength={6}
        />
      </div>
      <button className="btn" type="submit" disabled={loading}>
        {loading ? '로그인 중...' : '로그인'}
      </button>
      <div className="alt">
        계정이 없으신가요? <Link href="/register">회원가입</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<div className="auth-card"><h1>로그인</h1><div className="muted">로딩 중...</div></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
