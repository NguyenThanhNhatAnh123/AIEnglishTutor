import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const titles = {
  '/dashboard': 'Dashboard',
  '/exams': 'Practice Center',
  '/submissions': 'My Submissions',
  '/profile': 'My Profile',
};

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const title = titles[location.pathname] || 'AI English Tutor';

  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)] backdrop-blur md:left-64 md:px-7">
      <h1 className="truncate pr-3 text-base font-semibold text-slate-800 sm:text-lg">{title}</h1>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 sm:px-3">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {user?.username?.[0]?.toUpperCase() || 'S'}
          </div>
          <span className="max-w-28 truncate text-sm font-medium text-slate-700 sm:max-w-40">{user?.username || 'Student'}</span>
        </div>
      </div>
    </header>
  );
}
