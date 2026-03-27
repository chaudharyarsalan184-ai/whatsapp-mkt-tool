import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Modal from '../components/Modal';

function statusColor(s) {
  if (s === 'APPROVED') return 'bg-green-100 text-green-800';
  if (s === 'REJECTED') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
}

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [headerMode, setHeaderMode] = useState('none');
  const [buttons, setButtons] = useState([]);
  const { register, handleSubmit, watch, reset, setValue, getValues, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      category: 'MARKETING',
      language: 'en_US',
      header_content: '',
      body: 'Hello {{1}}, your trip {{2}} is confirmed.',
      footer: '',
    },
  });

  const bodyVal = watch('body');
  const footerVal = watch('footer');
  const nameVal = watch('name');
  const headerContent = watch('header_content');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/templates');
      setTemplates(data.templates || []);
    } catch (e) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (values) => {
    try {
      const payload = {
        name: values.name,
        category: values.category,
        language: values.language,
        body: values.body,
        footer: values.footer || undefined,
        header_type:
          headerMode === 'none' ? null : headerMode === 'text' ? 'TEXT' : headerMode.toUpperCase(),
        header_content: headerMode !== 'none' ? values.header_content : undefined,
        buttons,
      };
      await api.post('/templates', payload);
      toast.success('Template submitted');
      setOpen(false);
      reset();
      setButtons([]);
      setHeaderMode('none');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Create failed');
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.get('/templates/sync');
      toast.success(`Synced ${data.synced} templates`);
      setTemplates(data.templates || []);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const addVar = (n) => {
    const el = document.getElementById('tpl-body');
    const cur = getValues('body') || '';
    const pos = el?.selectionStart ?? cur.length;
    const insert = `{{${n}}}`;
    setValue('body', cur.slice(0, pos) + insert + cur.slice(pos));
  };

  const addButton = () => {
    setButtons((b) => [...b, { type: 'QUICK_REPLY', label: 'OK', value: 'ok' }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-white"
        >
          Create Template
        </button>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        >
          {syncing ? 'Syncing…' : 'Sync from Meta'}
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(t.status)}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{t.category} · {t.language}</p>
              <p className="mt-2 line-clamp-3 text-sm text-gray-700">{t.body}</p>
              <button
                type="button"
                className="mt-3 text-sm text-red-600 hover:underline"
                onClick={async () => {
                  if (!confirm('Delete this template locally?')) return;
                  try {
                    await api.delete(`/templates/${t.id}`);
                    toast.success('Deleted');
                    load();
                  } catch (e) {
                    toast.error('Delete failed');
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
          {!templates.length && (
            <p className="col-span-full text-center text-gray-500">No templates yet</p>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create template" wide>
        <form onSubmit={handleSubmit(onCreate)} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('name', { required: true })} />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <select className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('category')}>
                <option value="MARKETING">MARKETING</option>
                <option value="UTILITY">UTILITY</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Header</label>
              <select
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={headerMode}
                onChange={(e) => setHeaderMode(e.target.value)}
              >
                <option value="none">None</option>
                <option value="text">Text</option>
                <option value="image">Image URL</option>
                <option value="video">Video URL</option>
              </select>
            </div>
            {headerMode !== 'none' && (
              <div>
                <label className="text-sm font-medium">Header content / URL</label>
                <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('header_content')} />
              </div>
            )}
            <div>
              <div className="mb-1 flex flex-wrap gap-1">
                <span className="text-sm font-medium">Body</span>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="rounded bg-gray-100 px-2 py-0.5 text-xs"
                    onClick={() => addVar(n)}
                  >
                    {`{{${n}}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="tpl-body"
                rows={6}
                className="w-full rounded border px-3 py-2 font-mono text-sm"
                {...register('body', { required: true })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Footer</label>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register('footer')} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Buttons (max 3)</span>
                <button type="button" className="text-xs text-wa-green" onClick={addButton}>
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {buttons.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      className="rounded border px-2 py-1 text-xs"
                      value={b.type}
                      onChange={(e) => {
                        const next = [...buttons];
                        next[i] = { ...next[i], type: e.target.value };
                        setButtons(next);
                      }}
                    >
                      <option value="QUICK_REPLY">QUICK_REPLY</option>
                      <option value="URL">URL</option>
                    </select>
                    <input
                      className="flex-1 rounded border px-2 py-1 text-xs"
                      placeholder="Label"
                      value={b.label}
                      onChange={(e) => {
                        const next = [...buttons];
                        next[i] = { ...next[i], label: e.target.value };
                        setButtons(next);
                      }}
                    />
                    <input
                      className="flex-1 rounded border px-2 py-1 text-xs"
                      placeholder="URL / value"
                      value={b.value}
                      onChange={(e) => {
                        const next = [...buttons];
                        next[i] = { ...next[i], value: e.target.value };
                        setButtons(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-wa-green py-2 font-semibold text-white"
            >
              {isSubmitting ? 'Submitting…' : 'Submit to Meta'}
            </button>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Preview</p>
            <div className="rounded-2xl border border-gray-200 bg-[#e5ddd5] p-4">
              <div className="ml-auto max-w-[95%] rounded-lg bg-white p-3 text-sm shadow">
                {headerMode === 'text' && headerContent && (
                  <p className="mb-1 font-semibold">{headerContent}</p>
                )}
                {(headerMode === 'image' || headerMode === 'video') && headerContent && (
                  <div className="mb-2 text-xs text-blue-600 underline">{headerContent}</div>
                )}
                <p className="whitespace-pre-wrap text-gray-900">{bodyVal}</p>
                {footerVal && <p className="mt-2 text-xs text-gray-500">{footerVal}</p>}
                {buttons.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                    {buttons.map((b, i) => (
                      <div key={i} className="text-center text-xs text-wa-green">
                        {b.label}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-2xs text-gray-400">{nameVal || 'template_name'}</p>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
