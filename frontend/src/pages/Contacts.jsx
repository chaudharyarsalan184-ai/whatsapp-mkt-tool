import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PhoneInput from '../components/PhoneInput';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { phone: '+1', name: '', email: '', tags: '' } });

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tagFilter) params.tag = tagFilter;
      const [c, t] = await Promise.all([api.get('/contacts', { params }), api.get('/contacts/tags')]);
      setContacts(c.data.contacts || []);
      setTags(t.data.tags || []);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tagFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const columns = useMemo(
    () => [
      {
        key: 'phone',
        header: 'Phone',
        accessor: (r) => r.phone,
        sortable: true,
      },
      {
        key: 'name',
        header: 'Name',
        accessor: (r) => r.name || '—',
        sortable: true,
      },
      {
        key: 'tags',
        header: 'Tags',
        accessor: () => '',
        sortable: false,
        cell: (r) => (
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(r.tags) ? r.tags : []).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTagFilter(t)}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs hover:bg-wa-green/20"
              >
                {t}
              </button>
            ))}
          </div>
        ),
      },
      {
        key: 'opted_in',
        header: 'Opted in',
        accessor: (r) => (r.opted_in ? 1 : 0),
        sortable: true,
        cell: (r) => (
          <button
            type="button"
            onClick={async () => {
              try {
                if (r.opted_in) {
                  await api.post(`/contacts/${r.id}/opt-out`);
                  toast.success('Opted out');
                } else {
                  await api.put(`/contacts/${r.id}`, { opted_in: true });
                  toast.success('Opted in');
                }
                load();
              } catch (e) {
                toast.error(e.response?.data?.error || 'Update failed');
              }
            }}
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              r.opted_in ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {r.opted_in ? 'Yes' : 'No'}
          </button>
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        accessor: (r) => r.created_at || '',
        sortable: true,
        cell: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '—'),
      },
      {
        key: 'actions',
        header: 'Actions',
        sortable: false,
        cell: (r) => (
          <button
            type="button"
            className="text-red-600 hover:underline"
            onClick={async () => {
              if (!confirm('Delete this contact?')) return;
              try {
                await api.delete(`/contacts/${r.id}`);
                toast.success('Deleted');
                load();
              } catch (e) {
                toast.error(e.response?.data?.error || 'Delete failed');
              }
            }}
          >
            Delete
          </button>
        ),
      },
    ],
    []
  );

  const onAdd = async (data) => {
    const tagArr = data.tags
      ? data.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    try {
      await api.post('/contacts', {
        phone: data.phone,
        name: data.name || null,
        email: data.email || null,
        tags: tagArr,
      });
      toast.success('Contact added');
      setModalOpen(false);
      reset();
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add');
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/contacts/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(
        `Imported ${data.imported} of ${data.total} (${data.skipped} skipped, ${data.invalid} invalid)`
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search name or phone"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-white"
        >
          Add Contact
        </button>
        <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          {importing ? 'Importing…' : 'Import CSV'}
          <input type="file" accept=".csv" className="hidden" onChange={onImport} disabled={importing} />
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyMessage="No contacts yet"
        getRowClassName={(r) =>
          !r.opted_in ? 'bg-red-50/50 opacity-80 hover:bg-red-50' : 'hover:bg-gray-50'
        }
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add contact">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-4">
          <Controller
            name="phone"
            control={control}
            rules={{
              required: 'Phone required',
              validate: (v) =>
                /^\+1[2-9]\d{9}$/.test((v || '').trim()) || 'Must be +1 US number',
            }}
            render={({ field }) => (
              <PhoneInput label="Phone (US)" error={errors.phone?.message} {...field} />
            )}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" {...register('name')} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...register('email')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" {...register('tags')} />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-wa-green py-2 font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
