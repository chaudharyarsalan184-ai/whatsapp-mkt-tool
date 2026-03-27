import { useEffect, useState } from 'react';
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

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, m, c, f] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/messages'),
          api.get('/analytics/campaigns'),
          api.get('/analytics/funnel'),
        ]);
        setOverview(o.data);
        setMessages(m.data.series || []);
        setCampaigns((c.data.campaigns || []).slice(0, 5));
        setFunnel(f.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading analytics…</div>;
  }

  const funnelData = funnel
    ? [
        { name: 'Sent', value: funnel.sent },
        { name: 'Delivered', value: funnel.delivered },
        { name: 'Read', value: funnel.read },
        { name: 'Replied', value: funnel.replied },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Contacts" value={overview?.total_contacts ?? '—'} />
        <StatCard title="Opted-In Rate" value={`${overview?.opted_in_percent ?? 0}%`} />
        <StatCard title="Campaigns (month)" value={overview?.campaigns_sent_this_month ?? '—'} />
        <StatCard title="Avg Read Rate" value={`${overview?.average_read_rate ?? 0}%`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-semibold">Messages per day</h3>
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
          <h3 className="mb-4 font-semibold">Campaigns</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaigns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="read_rate" fill="#25D366" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold">Funnel</h3>
        <div className="space-y-2">
          {funnelData.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <span className="w-24 text-sm text-gray-600">{f.name}</span>
              <div className="h-8 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-wa-green"
                  style={{
                    width: `${Math.min(100, (f.value / (funnelData[0]?.value || 1)) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-10 text-right text-sm">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
