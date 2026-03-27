import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';

const triggerLabels = {
  opt_in: 'Opt-in',
  tag_added: 'Tag added',
  inactivity: 'Inactivity',
  schedule: 'Schedule',
};

function cronPreview(expr) {
  if (!expr) return '—';
  return expr;
}

export default function Automation() {
  const [items, setItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      trigger_type: 'opt_in',
      delay_hours: 0,
      tag: '',
      days: 30,
      cron: '0 9 * * 1',
      timezone: 'America/New_York',
      template_id: '',
      is_active: true,
    },
  });

  const triggerType = watch('trigger_type');

  const load = async () => {
    setLoading(true);
    try {
      const [a, t, tg] = await Promise.all([
        api.get('/automations'),
        api.get('/templates'),
        api.get('/contacts/tags'),
      ]);
      setItems(a.data.automations || []);
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

  const onCreate = async (values) => {
    try {
      const cfg = {};
      if (values.trigger_type === 'opt_in' || values.trigger_type === 'tag_added') {
        cfg.delay_hours = Number(values.delay_hours) || 0;
      }
      if (values.trigger_type === 'tag_added') {
        cfg.tag = values.tag;
      }
      if (values.trigger_type === 'inactivity') {
        cfg.days = Number(values.days) || 30;
      }
      if (values.trigger_type === 'schedule') {
        cfg.cron = values.cron;
        cfg.timezone = values.timezone;
        cfg.tag = values.tag || '';
      }
      await api.post('/automations', {
        name: values.name,
        trigger_type: values.trigger_type,
        trigger_config: cfg,
        template_id: Number(values.template_id),
        is_active: !!values.is_active,
      });
      toast.success('Automation created');
      setOpen(false);
      reset();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const toggle = async (id) => {
    try {
      await api.put(`/automations/${id}/toggle`);
      load();
    } catch (e) {
      toast.error('Toggle failed');
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-white"
      >
        New Automation
      </button>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div>
                <div className="font-semibold text-gray-900">{a.name}</div>
                <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {triggerLabels[a.trigger_type] || a.trigger_type}
                </span>
                <div className="mt-1 text-xs text-gray-500">Template: {a.template_name || a.template_id}</div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!a.is_active}
                  onChange={() => toggle(a.id)}
                />
                Active
              </label>
            </div>
          ))}
          {!items.length && <p className="text-gray-500">No automations</p>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New automation" wide>
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('name', { required: true })} />
          </div>
          <div>
            <label className="text-sm font-medium">Trigger</label>
            <select className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('trigger_type')}>
              <option value="opt_in">Opt-in</option>
              <option value="tag_added">Tag added</option>
              <option value="inactivity">Inactivity</option>
              <option value="schedule">Schedule</option>
            </select>
          </div>
          {(triggerType === 'opt_in' || triggerType === 'tag_added') && (
            <div>
              <label className="text-sm font-medium">Delay (hours)</label>
              <input type="number" className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('delay_hours')} />
            </div>
          )}
          {triggerType === 'tag_added' && (
            <div>
              <label className="text-sm font-medium">Tag</label>
              <select className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('tag')}>
                <option value="">Select…</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          {triggerType === 'inactivity' && (
            <div>
              <label className="text-sm font-medium">Days without message</label>
              <input type="number" className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('days')} />
            </div>
          )}
          {triggerType === 'schedule' && (
            <>
              <div>
                <label className="text-sm font-medium">Cron expression</label>
                <input className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" {...register('cron')} />
                <p className="mt-1 text-xs text-gray-500">Preview: {cronPreview(watch('cron'))}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Timezone</label>
                <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('timezone')} />
              </div>
              <div>
                <label className="text-sm font-medium">Optional tag segment (empty = all)</label>
                <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('tag')} placeholder="e.g. vip" />
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium">Template</label>
            <select className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('template_id', { required: true })}>
              <option value="">Select…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('is_active')} />
            Active
          </label>
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
