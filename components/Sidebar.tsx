'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getStoredUser } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/rules', label: 'Rules' },
  { href: '/rules/import', label: 'CSV Import' },
  { href: '/audit', label: 'Audit' },
  { href: '/users', label: 'Users', role: 'super_admin' as const },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <aside className="sidebar">
      <h2>Guardrails Admin</h2>
      <nav>
        {NAV.filter((n) => !n.role || n.role === user?.role).map((n) => (
          <Link key={n.href} href={n.href} className={pathname.startsWith(n.href) ? 'active' : ''}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="user-card">
        <div>{user?.email ?? '—'}</div>
        <div>role: {user?.role ?? '—'}</div>
        <button className="logout" onClick={logout}>로그아웃</button>
      </div>
    </aside>
  );
}
