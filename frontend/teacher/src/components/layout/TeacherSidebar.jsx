import { createElement } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  BarChart3,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  School,
  Settings,
  UsersRound,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/exams', label: 'Exams', icon: ClipboardList },
  { to: '/classes', label: 'Classes', icon: School },
  { to: '/students', label: 'Students', icon: UsersRound },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/questions', label: 'Question Bank', icon: BookOpenCheck },
  { to: '/results', label: 'Results', icon: Gauge },
  { to: '/profile', label: 'Settings', icon: Settings },
];

function SidebarContent({ collapsed, onToggleCollapse, onClose, user }) {
  return (
    <>
      <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-950">
            <GraduationCap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-normal text-slate-950">AI English</p>
              <p className="truncate text-xs text-slate-500">Teacher Workspace</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
            title={collapsed ? label : undefined}
          >
            {createElement(icon, { className: 'h-5 w-5 shrink-0' })}
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <div className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
            {(user?.fullName?.[0] || user?.username?.[0] || 'T').toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName || user?.username || 'Teacher'}</p>
              <p className="truncate text-xs text-slate-500">{user?.email || 'Teacher workspace'}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="mt-3 hidden h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:flex"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );
}

export default function TeacherSidebar({ collapsed, mobileOpen, onToggleCollapse, onClose, user }) {
  const widthClass = collapsed ? 'lg:w-20' : 'lg:w-[260px]';

  return (
    <>
      <Motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-slate-200 bg-white shadow-sm lg:flex ${widthClass}`}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} user={user} />
      </Motion.aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            onClick={onClose}
            aria-label="Close navigation overlay"
          />
          <Motion.aside
            initial={{ x: -320, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0.6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative flex h-screen w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-slate-200 bg-white shadow-lg"
          >
            <SidebarContent collapsed={false} onToggleCollapse={onToggleCollapse} onClose={onClose} user={user} />
          </Motion.aside>
        </div>
      )}
    </>
  );
}
