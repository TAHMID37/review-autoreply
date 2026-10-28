"use client";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** Page-size selector (10/25/50/100) + prev/next + "x-y of N" summary. */
export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm text-muted">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-pink focus:outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span>
          {from}–{to} of {total}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onPageChange(current - 1)}
            disabled={current <= 1}
            className="rounded-md border border-gray-300 px-2 py-1 text-ink disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() => onPageChange(current + 1)}
            disabled={current >= totalPages}
            className="rounded-md border border-gray-300 px-2 py-1 text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
