import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <Navbar />
      <main className="md:ml-64 pt-16">
        <div className="p-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
