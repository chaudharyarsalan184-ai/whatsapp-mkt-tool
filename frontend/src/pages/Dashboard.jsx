import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import api from '../api/axios';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [recent, setRecent] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, m, c, f, camp, u] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/messages'),
          api.get('/analytics/campaigns'),
          api.get('/analytics/funnel'),
          api.get('/campaigns'),
          api.get('/inbox/unread-count'),
        ]);
        if (cancelled) return;
        setOverview(o.data);
        setMessages(m.data.series || []);
        const top = (c.data.campaigns || [])
          .sort((a, b) => (b.read_rate || 0) - (a.read_rate || 0))
          .slice(0, 5);
        setCampaigns(top);
        setFunnel(f.data);
        setRecent((camp.data.campaigns || []).slice(0, 5));
        setUnread(u.data.count || 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="animate-pulse text-gray-500">Loading dashboard…</div>;
  }

  const funnelData = funnel
    ? [
        { name: 'Sent', value: funnel.sent, fill: '#25D366' },
        { name: 'Delivered', value: funnel.delivered, fill: '#128C7E' },
        { name: 'Read', value: funnel.read, fill: '#075E54' },
        { name: 'Replied', value: funnel.replied, fill: '#34B7F1' },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Contacts" value={overview?.total_contacts ?? '—'} />
        <StatCard
          title="Opted-In Rate"
          value={`${overview?.opted_in_percent ?? 0}%`}
        />
        <StatCard
          title="Campaigns Sent (Month)"
          value={overview?.campaigns_sent_this_month ?? '—'}
        />
        <StatCard
          title="Avg Read Rate"
          value={`${overview?.average_read_rate ?? 0}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Messages sent (30 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={messages}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#25D366" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Top campaigns by read rate</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaigns} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="read_rate" fill="#25D366" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Engagement funnel</h3>
        <div className="space-y-2">
          {funnelData.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <span className="w-24 text-sm text-gray-600">{f.name}</span>
              <div className="h-8 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (f.value / (funnelData[0]?.value || 1)) * 100)}%`,
                    backgroundColor: f.fill,
                  }}
                />
              </div>
              <span className="w-12 text-right text-sm font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-4 font-semibold text-gray-900">Recent campaigns</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Name</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === 'sent'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'sending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>{r.sent_count}</td>
                  <td>{r.read_count}</td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    No campaigns yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Link
          to="/inbox"
          className="flex flex-col justify-center rounded-xl border border-wa-green/30 bg-wa-green/5 p-6 text-center shadow-sm transition hover:bg-wa-green/10"
        >
          <div className="text-3xl font-bold text-wa-green">{unread}</div>
          <div className="mt-1 text-sm font-medium text-gray-800">Unread inbox messages</div>
          <div className="mt-2 text-sm text-wa-green">Open Inbox →</div>
        </Link>
      </div>
    </div>
  );
}
