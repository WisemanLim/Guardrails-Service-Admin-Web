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
