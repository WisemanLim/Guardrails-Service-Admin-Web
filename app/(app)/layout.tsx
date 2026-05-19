import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="app-layout">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </AuthGuard>
  );
}
