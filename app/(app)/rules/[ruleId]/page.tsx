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
