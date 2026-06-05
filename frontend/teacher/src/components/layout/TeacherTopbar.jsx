import { useMemo, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const pageLabels = {
  '/dashboard': 'Dashboard',
  '/exams': 'Exams',
  '/teachers': 'Teachers',
  '/students': 'Students',
  '/analytics': 'Analytics',
  '/questions': 'Question Bank',
  '/results': 'Results',
  '/profile': 'Settings',
  '/classes': 'Classes',
  '/ocr': 'OCR Workspace',
};

export default function TeacherTopbar({ collapsed, onOpenMobileNav, user, logout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const context = useMemo(() => {
    const path = location.pathname;
    return pageLabels[path] || 'Teacher Portal';
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-3 py-2 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-slate-500">Workspace</p>
            <h1 className="truncate text-base font-bold text-slate-950 sm:text-lg">{context}</h1>
          </div>
        </div>

        <div className="hidden min-w-[16rem] max-w-md flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 transition focus-within:border-slate-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-200 md:flex">
          <Search className="mr-2 h-4 w-4 shrink-0" />
          <input
            className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            placeholder="Search exams, students, results..."
            aria-label="Search"
          />
          <kbd className="ml-2 hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 xl:inline">
            /
          </kbd>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-app-danger ring-2 ring-white" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5 pr-2 text-left transition hover:bg-slate-50"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                {(user?.fullName?.[0] || user?.username?.[0] || 'T').toUpperCase()}
              </div>
              <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-800 sm:inline">
                {user?.fullName || user?.username || 'Teacher'}
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/profile');
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <UserRound className="h-4 w-4 text-slate-400" />
                  Profile settings
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="sr-only">Sidebar is {collapsed ? 'collapsed' : 'expanded'}</div>
    </header>
  );
}
