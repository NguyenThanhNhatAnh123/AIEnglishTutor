import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import TeacherSidebar from './layout/TeacherSidebar';
import TeacherTopbar from './layout/TeacherTopbar';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-app-background text-app-ink">
      <TeacherSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        user={user}
      />

      <div className={collapsed ? 'min-h-screen transition-[padding] duration-300 lg:pl-20' : 'min-h-screen transition-[padding] duration-300 lg:pl-[260px]'}>
        <TeacherTopbar
          collapsed={collapsed}
          onOpenMobileNav={() => setMobileOpen(true)}
          user={user}
          logout={logout}
        />
        <main className="px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
