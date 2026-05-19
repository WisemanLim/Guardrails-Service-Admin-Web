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
