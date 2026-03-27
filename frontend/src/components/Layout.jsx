import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

function titleForPath(pathname) {
  if (pathname.startsWith('/campaigns/')) return 'Campaign detail';
  if (pathname.startsWith('/inbox/') && pathname !== '/inbox') return 'Conversation';
  const map = {
    '/': 'Dashboard',
    '/contacts': 'Contacts',
    '/templates': 'Templates',
    '/campaigns': 'Campaigns',
    '/automation': 'Automation',
    '/inbox': 'Inbox',
    '/analytics': 'Analytics',
  };
  return map[pathname] || 'Dashboard';
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  const title = titleForPath(loc.pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-[240px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-8 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <div className="text-sm text-gray-600">{user?.name}</div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
