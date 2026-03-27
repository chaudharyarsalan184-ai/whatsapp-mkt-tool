import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reach, setReach] = useState(0);
  const { register, handleSubmit, watch, reset, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      template_id: '',
      segment_tags: [],
      scheduled_at: '',
      send_mode: 'now',
      variables: {},
    },
  });

  const selectedTags = watch('segment_tags') || [];
  const templateIdWatch = watch('template_id');

  const load = async () => {
    setLoading(true);
    try {
      const [c, t, tg] = await Promise.all([
        api.get('/campaigns'),
        api.get('/templates'),
        api.get('/contacts/tags'),
      ]);
      setCampaigns(c.data.campaigns || []);
      setTemplates((t.data.templates || []).filter((x) => x.status === 'APPROVED'));
      setTags(tg.data.tags || []);
    } catch (e) {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/contacts');
        const list = data.contacts || [];
        const seg = Array.isArray(selectedTags) ? selectedTags : [];
        const count = list.filter((c) => {
          if (!c.opted_in) return false;
          const ct = Array.isArray(c.tags) ? c.tags : [];
          if (!seg.length) return true;
          return seg.some((s) => ct.includes(s));
        }).length;
        setReach(count);
      } catch {
        setReach(0);
      }
    })();
  }, [selectedTags]);

  const onCreate = async (values) => {
    if (values.send_mode === 'schedule' && !values.scheduled_at) {
      toast.error('Choose a date and time for scheduled send');
      return;
    }
    try {
      const payload = {
        name: values.name,
        template_id: Number(values.template_id),
        segment_tags: Array.isArray(values.segment_tags) ? values.segment_tags : [],
        scheduled_at:
          values.send_mode === 'schedule' && values.scheduled_at
            ? new Date(values.scheduled_at).toISOString()
            : null,
        variable_values: values.variables || {},
      };
      const { data } = await api.post('/campaigns', payload);
      if (values.send_mode === 'now') {
        await api.post(`/campaigns/${data.campaign.id}/send`);
        toast.success('Campaign sending started');
      } else {
        toast.success('Campaign scheduled');
      }
      setOpen(false);
      reset();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const tplVars = useMemo(() => {
    const t = templates.find((x) => String(x.id) === String(templateIdWatch));
    if (!t) return [];
    try {
      return JSON.parse(t.variables || '[]');
    } catch {
      return [];
    }
  }, [templateIdWatch, templates]);

  const statusBadge = (s) => {
    const map = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      sending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return map[s] || 'bg-gray-100';
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-white"
      >
        New Campaign
      </button>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const total = c.total_contacts || 0;
            const pct = total ? Math.round(((c.sent_count || 0) / total) * 100) : 0;
            return (
              <Link
                key={c.id}
                to={`/campaigns/${c.id}`}
                className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-wa-green/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div>
                      Sent {c.sent_count || 0}/{total || '—'} ·{' '}
                      Delivered {c.delivered_count || 0} · Read {c.read_count || 0}
                    </div>
                  </div>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-wa-green transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
          {!campaigns.length && <p className="text-gray-500">No campaigns yet</p>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New campaign" wide>
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('name', { required: true })} />
          </div>
          <div>
            <label className="text-sm font-medium">Template (approved only)</label>
            <select className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('template_id', { required: true })}>
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Segment tags (multi)</label>
            <select
              multiple
              className="mt-1 h-28 w-full rounded border px-3 py-2 text-sm"
              value={selectedTags}
              onChange={(e) => {
                const opts = [...e.target.selectedOptions].map((o) => o.value);
                setValue('segment_tags', opts);
              }}
            >
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Estimated reach: {reach} opted-in contacts</p>
          </div>
          {tplVars.map((v, i) => (
            <div key={i}>
              <label className="text-sm font-medium">{`Variable {{${v}}}`}</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                {...register(`variables.${v}`)}
              />
            </div>
          ))}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="now" {...register('send_mode')} defaultChecked />
              Send now
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="schedule" {...register('send_mode')} />
              Schedule
            </label>
          </div>
          <div>
            <label className="text-sm font-medium">Schedule at (local)</label>
            <input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('scheduled_at')} />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-wa-green py-2 font-semibold text-white"
          >
            {isSubmitting ? 'Saving…' : 'Create'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
