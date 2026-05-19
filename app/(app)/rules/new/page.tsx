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
