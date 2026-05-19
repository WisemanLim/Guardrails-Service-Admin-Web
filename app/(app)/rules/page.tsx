'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Rule } from '@/lib/types';

const CATEGORIES = [
  '', 'pii', 'compliance', 'ip', 'safety', 'financial', 'health',
  'credentials', 'location', 'sensitive', 'children', 'biometrics',
  'fraud', 'prompt_injection', 'scope', 'hallucination',
];

export default function RulesPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [total, setTotal] = useState(0);
  const [domain, setDomain] = useState('');
  const [locale, setLocale] = useState('');
  const [ioType, setIoType] = useState('');
  const [category, setCategory] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.listRules({ domain, locale, ioType, category, enabledOnly, limit, offset });
      setItems(r.items);
      setTotal(r.total);
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [domain, locale, ioType, category, enabledOnly, limit, offset]);

  useEffect(() => { load(); }, [load]);

  function toggle(ruleId: string) {
    const next = new Set(selected);
    if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((r) => r.rule_id)));
  }

  async function deleteOne(ruleId: string) {
    if (!confirm(`'${ruleId}' 삭제할까요?`)) return;
    try {
      const r = await api.deleteRule(ruleId);
      setToast(`삭제 완료 (${r.deleted}건)`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`선택된 ${selected.size}건을 삭제할까요?`)) return;
    try {
      const r = await api.bulkDelete([...selected]);
      setToast(`벌크 삭제 완료 (${r.deleted}/${r.requested}건)`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <h1>룰 목록 <span className="muted">({total}건)</span></h1>
      {error && <div className="toast error">{error}</div>}
      {toast && <div className="toast success">{toast}</div>}

      <div className="toolbar">
        <div>
          <label>domain</label>
          <input value={domain} onChange={(e) => { setOffset(0); setDomain(e.target.value); }} placeholder="global, manufacturing-food..." />
        </div>
        <div>
          <label>locale</label>
          <input value={locale} onChange={(e) => { setOffset(0); setLocale(e.target.value); }} placeholder="ko-KR / en" />
        </div>
        <div>
          <label>ioType</label>
          <select value={ioType} onChange={(e) => { setOffset(0); setIoType(e.target.value); }}>
            <option value="">전체</option>
            <option value="input">input</option>
            <option value="output">output</option>
            <option value="both">both</option>
          </select>
        </div>
        <div>
          <label>category</label>
          <select value={category} onChange={(e) => { setOffset(0); setCategory(e.target.value); }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c || '전체'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ visibility: 'hidden' }}>x</label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={enabledOnly} onChange={(e) => setEnabledOnly(e.target.checked)} />
            enabled only
          </label>
        </div>
        <div>
          <label style={{ visibility: 'hidden' }}>x</label>
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? '로딩...' : '새로고침'}
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <label style={{ visibility: 'hidden' }}>x</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/rules/new" className="btn">+ 룰 추가</Link>
            <Link href="/rules/import" className="btn secondary">CSV import</Link>
            <button className="btn danger" disabled={selected.size === 0} onClick={deleteSelected}>
              선택 삭제 ({selected.size})
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                />
              </th>
              <th>ruleId</th>
              <th>domain</th>
              <th>locale</th>
              <th>io</th>
              <th>category</th>
              <th>sub</th>
              <th>severity</th>
              <th>action</th>
              <th>source</th>
              <th style={{ textAlign: 'right' }}>actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.rule_id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.rule_id)}
                    onChange={() => toggle(r.rule_id)}
                  />
                </td>
                <td><Link href={`/rules/${encodeURIComponent(r.rule_id)}`}><code>{r.rule_id}</code></Link></td>
                <td>{r.domain}</td>
                <td>{r.locale}</td>
                <td>{r.io_type}</td>
                <td>{r.category}</td>
                <td className="muted">{r.sub_category ?? '—'}</td>
                <td><span className={`badge severity-${r.severity}`}>{r.severity}</span></td>
                <td><span className="badge action">{r.action}</span></td>
                <td className="muted">{r.source}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link href={`/rules/${encodeURIComponent(r.rule_id)}`} className="btn subtle">편집</Link>
                  {' '}
                  <button className="btn danger" onClick={() => deleteOne(r.rule_id)}>삭제</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={11} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                결과 없음. 필터를 변경하거나 룰을 추가하세요.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <span className="muted">offset {offset} / total {total}</span>
        <div>
          <button className="btn secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>← 이전</button>
          {' '}
          <button className="btn secondary" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>다음 →</button>
        </div>
      </div>
    </>
  );
}
