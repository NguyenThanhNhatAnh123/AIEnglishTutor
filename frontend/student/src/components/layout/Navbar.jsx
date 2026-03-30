import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const titles = {
  '/dashboard': 'Dashboard',
  '/exams': 'Available Exams',
  '/submissions': 'My Submissions',
  '/profile': 'My Profile',
};

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const title = titles[location.pathname] || 'AI English Tutor';

  return (
    <header className="fixed top-0 left-60 right-0 h-16 bg-white border-b border-slate-100 z-20 flex items-center justify-between px-6 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.username?.[0]?.toUpperCase() || 'S'}
          </div>
          <span className="text-sm font-medium text-slate-700">{user?.username || 'Student'}</span>
        </div>
      </div>
    </header>
  );
}
