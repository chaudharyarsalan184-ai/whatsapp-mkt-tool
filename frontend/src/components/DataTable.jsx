import { useMemo, useState } from 'react';

export default function DataTable({
  columns,
  rows,
  loading,
  emptyMessage = 'No data',
  pageSize = 20,
  getRowClassName,
}) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av;
      }
      return sort.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
    setPage(0);
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="animate-pulse space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-gray-500">
        <div className="mb-2 text-4xl opacity-40">📭</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="cursor-pointer px-4 py-3 text-left font-semibold text-gray-700"
                  onClick={() => c.sortable !== false && toggleSort(c.key)}
                >
                  {c.header}
                  {sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className={getRowClassName ? getRowClassName(row) : 'hover:bg-gray-50'}
              >
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-4 py-3 text-gray-800">
                    {c.cell ? c.cell(row) : String(c.accessor(row) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
        <span>
          Page {page + 1} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            className="rounded border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            className="rounded border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
