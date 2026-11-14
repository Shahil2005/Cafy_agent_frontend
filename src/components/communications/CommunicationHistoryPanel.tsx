import React, { useMemo, useState } from 'react';
import { Clock, FileText, Mail, History, Trash2, Loader2 } from 'lucide-react';
import type { CommunicationRecord } from '../../types';

interface CommunicationHistoryPanelProps {
  communications: CommunicationRecord[];
  isLoading: boolean;
  error: string;
  selectedJobId?: string | null;
  activeCommId?: string | null;
  onSelect: (record: CommunicationRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  variant?: 'inline' | 'sidebar';
  hideHeader?: boolean;
}

function FilterToggle({
  filter,
  onChange,
}: {
  filter: 'all' | 'job';
  onChange: (value: 'all' | 'job') => void;
}) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px]">
      <button
        type="button"
        onClick={() => onChange('all')}
        title="Every saved item across all jobs"
        className={`px-2 py-1 ${filter === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
      >
        All jobs
      </button>
      <button
        type="button"
        onClick={() => onChange('job')}
        title="Only items for the job selected in Configuration"
        className={`px-2 py-1 ${filter === 'job' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
      >
        Current job
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const CommunicationHistoryPanel: React.FC<CommunicationHistoryPanelProps> = ({
  communications,
  isLoading,
  error,
  selectedJobId,
  activeCommId,
  onSelect,
  onDelete,
  onLoadMore,
  hasMore,
  variant = 'inline',
  hideHeader = false,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'job'>('all');

  const visibleItems = useMemo(() => {
    if (filter === 'job' && selectedJobId) {
      return communications.filter((item) => item.jobId === selectedJobId);
    }
    return communications;
  }, [communications, filter, selectedJobId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved item from history?')) return;

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-700">
            <History size={16} />
            <h3 className="text-sm font-bold">History</h3>
          </div>
          {selectedJobId && (
            <FilterToggle filter={filter} onChange={setFilter} />
          )}
        </div>
      )}

      {hideHeader && selectedJobId && (
        <FilterToggle filter={filter} onChange={setFilter} />
      )}

      {selectedJobId && (
        <p className="text-[10px] text-slate-400 leading-snug">
          {filter === 'all'
            ? 'Showing every saved cover letter and email across all your tracked jobs.'
            : 'Showing only items linked to the job currently selected in Configuration.'}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {isLoading && visibleItems.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 size={14} className="animate-spin" />
          Loading history...
        </div>
      ) : visibleItems.length === 0 ? (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-3 py-3">
          Generated cover letters and emails will appear here automatically.
        </p>
      ) : (
        <div
          className={`space-y-2 overflow-y-auto custom-scrollbar pr-1 ${
            variant === 'sidebar' ? 'max-h-none' : 'max-h-[280px]'
          }`}
        >
          {visibleItems.map((item) => {
            const isActive = activeCommId === item.id;
            const TypeIcon = item.documentType === 'coverletter' ? FileText : Mail;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(item);
                  }
                }}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors group cursor-pointer ${
                  isActive
                    ? 'border-blue-300 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TypeIcon size={12} className="text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {item.title}
                      </span>
                      {item.version > 1 && (
                        <span className="text-[10px] text-slate-500 shrink-0">v{item.version}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{item.preview}</p>
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                      <Clock size={10} />
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => void handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === item.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoading}
          className="w-full text-xs font-medium text-blue-700 hover:text-blue-800 py-2"
        >
          {isLoading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
};

export default CommunicationHistoryPanel;
