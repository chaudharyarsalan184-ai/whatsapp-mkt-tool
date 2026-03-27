import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import DataTable from '../components/DataTable';

export default function CampaignDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data: d } = await api.get(`/campaigns/${id}`);
      setData(d);
    } catch (e) {
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!data?.campaign || data.campaign.status !== 'sending') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [data?.campaign?.status, id]);

  if (loading || !data) {
    return <div className="animate-pulse text-gray-500">Loading…</div>;
  }

  const c = data.campaign;
  const logs = data.message_logs || [];
  const total = c.total_contacts || 0;
  const sent = c.sent_count || 0;
  const del = c.delivered_count || 0;
  const read = c.read_count || 0;
  const failed = c.failed_count || 0;
  const delRate = sent ? Math.round((del / sent) * 1000) / 10 : 0;
  const readRate = sent ? Math.round((read / sent) * 1000) / 10 : 0;
  const progress = total ? Math.round((sent / total) * 100) : 0;

  const columns = [
    { key: 'phone', header: 'Phone', accessor: (r) => r.phone, sortable: true },
    { key: 'status', header: 'Status', accessor: (r) => r.status, sortable: true },
    {
      key: 'sent_at',
      header: 'Sent',
      accessor: (r) => r.sent_at || '',
      sortable: true,
      cell: (r) => (r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'),
    },
    {
      key: 'error',
      header: 'Error',
      accessor: (r) => r.error_message || '',
      cell: (r) => r.error_message || '—',
    },
  ];

  return (
    <div className="space-y-6">
      <Link to="/campaigns" className="text-sm text-wa-green hover:underline">
        ← Back to campaigns
      </Link>
      <h2 className="text-xl font-bold text-gray-900">{c.name}</h2>
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: 'Total', value: total },
          { label: 'Sent', value: sent },
          { label: 'Delivered', value: del },
          { label: 'Read', value: read },
          { label: 'Failed', value: failed },
        ].map((x) => (
          <div key={x.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">{x.label}</div>
            <div className="text-2xl font-bold text-gray-900">{x.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-semibold">Rates</h3>
        <p className="text-sm text-gray-700">
          Delivery rate: {delRate}% · Read rate: {readRate}%
        </p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-wa-green transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Progress: {progress}%</p>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Message log</h3>
        <DataTable columns={columns} rows={logs} loading={false} emptyMessage="No messages" />
      </div>
    </div>
  );
}
