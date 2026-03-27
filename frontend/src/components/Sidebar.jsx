import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api/axios';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/contacts', label: 'Contacts' },
  { to: '/templates', label: 'Templates' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/automation', label: 'Automation' },
  { to: '/inbox', label: 'Inbox' },
  { to: '/analytics', label: 'Analytics' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get('/inbox/unread-count')
        .then((r) => {
          if (!cancelled) setUnread(r.data.count || 0);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col bg-wa-sidebar text-gray-100 shadow-lg">
      <div className="flex items-center gap-2 border-b border-gray-700 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wa-green text-lg font-bold text-white">
          W
        </div>
        <div>
          <div className="text-sm font-semibold">Travel WA</div>
          <div className="text-xs text-gray-400">Marketing</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-wa-green/20 text-wa-green' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <span>{l.label}</span>
            {l.to === '/inbox' && unread > 0 && (
              <span className="rounded-full bg-red-500 px-2 text-xs text-white">{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-700 p-4">
        <div className="mb-2 truncate text-xs text-gray-400">{user?.email}</div>
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg border border-gray-600 py-2 text-sm hover:bg-gray-800"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
