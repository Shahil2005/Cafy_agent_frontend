import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Trash2,
  ExternalLink,
  Heart,
  Calendar,
  LayoutGrid,
  ChevronDown,
  Chrome,
  Briefcase,
  Download,
  Database,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check
} from 'lucide-react';
import { getScoreRange } from '../../utils/scoreUtils';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import CompanyLogo from '../common/CompanyLogo';
import TrackerEmptyState from './TrackerEmptyState';
import type { Job, JobStatus } from '../../types';
import { JOB_STATUSES } from '../../utils/constants';
import { getSafeExternalUrl } from '../../utils/validation';
import { formatDate } from '../../utils/followUpStatus';

interface JobTableProps {
  jobs: Job[];
  onUpdateStatus: (jobId: string, status: JobStatus) => void;
  onUpdateFavorite: (jobId: string, isFavorite: boolean) => void;
  onToggleView: () => void;
  onJobClick: (job: Job) => void;
  onAddJobClick: () => void;
  onExtensionGuideClick?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: JobStatus | 'All';
  onStatusFilterChange: (status: JobStatus | 'All') => void;
  sourceFilter: 'Manual' | 'Extension' | 'All';
  onSourceFilterChange: (source: 'Manual' | 'Extension' | 'All') => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  onSortChange: (config: { key: string; direction: 'asc' | 'desc' | null }) => void;
  onPromptDelete: (job: Job) => void;
  onPromptReject: (jobId: string) => void;
  onPromptInterview: (job: Job) => void;
}

const JobTable: React.FC<JobTableProps> = ({
  jobs,
  onUpdateStatus,
  onUpdateFavorite,
  onToggleView,
  onJobClick,
  onAddJobClick,
  onExtensionGuideClick,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  sortConfig,
  onSortChange,
  onPromptDelete,
  onPromptReject,
  onPromptInterview
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSourceFilterOpen, setIsSourceFilterOpen] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [pageWindowStart, setPageWindowStart] = useState(1); // 1-based, shows 10 pages at a time

  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    if (statusFilter !== 'All') {
      result = result.filter(job => job.status === statusFilter);
    }

    // 1.5 Source filter
    if (sourceFilter !== 'All') {
      result = result.filter(job => {
        if (sourceFilter === 'Manual') return job.isManual;
        if (sourceFilter === 'Extension') return !job.isManual;
        return true;
      });
    }

    // 2. Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(job =>
        job.company.toLowerCase().includes(q) ||
        job.role.toLowerCase().includes(q) ||
        (job.portal && job.portal.toLowerCase().includes(q))
      );
    }

    // 3. Sorting
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const key = sortConfig.key as keyof Job;
        const valA = a[key];
        const valB = b[key];

        if (valA == null) return 1;
        if (valB == null) return -1;

        if (key === 'appliedDate') {
          const dateA = new Date(valA as string).getTime();
          const dateB = new Date(valB as string).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        return 0;
      });
    }

    return result;
  }, [jobs, searchQuery, sortConfig, statusFilter, sourceFilter]);

  const handleSort = (key: string) => {
    onSortChange({
      key,
      direction:
        sortConfig.key === key
          ? sortConfig.direction === 'asc' ? 'desc' : sortConfig.direction === 'desc' ? null : 'asc'
          : 'asc'
    });
  };

  const getSortIcon = (key: string) => {
    const isActive = sortConfig.key === key && sortConfig.direction;
    if (!isActive) return (
      <ArrowUpDown 
        size={14} 
        className="ml-1.5 text-slate-300 group-hover:text-slate-500 transition-colors" 
      />
    );
    
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1.5 text-blue-600" /> 
      : <ArrowDown size={14} className="ml-1.5 text-blue-600" />;
  };

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));

  useEffect(() => {
    // When pageSize changes, jump to first page.
    setPage(1);
    setPageWindowStart(1);
  }, [pageSize]);

  useEffect(() => {
    // Clamp page when data changes (e.g. delete job).
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  useEffect(() => {
    // Keep page window in sync with current page.
    const desiredWindowStart = Math.floor((page - 1) / 10) * 10 + 1;
    setPageWindowStart((cur) => (cur === desiredWindowStart ? cur : desiredWindowStart));
  }, [page]);

  const pageStartIdx = (page - 1) * pageSize;
  const pageEndIdx = Math.min(filteredJobs.length, pageStartIdx + pageSize);
  const paginatedJobs = useMemo(
    () => filteredJobs.slice(pageStartIdx, pageEndIdx),
    [filteredJobs, pageStartIdx, pageEndIdx]
  );

  const pageWindowEnd = Math.min(totalPages, pageWindowStart + 9);
  const canPrevWindow = pageWindowStart > 1;
  const canNextWindow = pageWindowEnd < totalPages;
  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    for (let p = pageWindowStart; p <= pageWindowEnd; p += 1) pages.push(p);
    return pages;
  }, [pageWindowStart, pageWindowEnd]);

  const handleExportCSV = () => {
    try {
      if (!filteredJobs || filteredJobs.length === 0) {
        alert('No jobs to export. Try adjusting your filters.');
        return;
      }

      // Robust helper for potentially non-array fields
      const safeJoin = (val: any) => Array.isArray(val) ? val.join(', ') : (val || '');

      const csvData = filteredJobs.map(job => ({
        Company: job.company || 'N/A',
        Role: job.role || 'N/A',
        Status: job.status || 'Applied',
        Portal: job.portal || 'Direct',
        Source: job.isManual ? 'Manual' : 'Extension',
        'Match Score': job.match_score ? `${job.match_score}%` : 'N/A',
        'Date Applied': formatDate(job.appliedDate || (job.createdAt as Date)),
        Link: job.link || '',
        Summary: job.summary || '',
        'Follow-up Message': job.followUpMessage || '',
        'Requirements Met': safeJoin(job.requirements_met),
        'Partially Met': safeJoin(job.requirements_partially_met),
        'Missing Requirements': safeJoin(job.requirements_not_met),
        Improvements: safeJoin(job.improvements_needed),
        Notes: job.personalNotes || '',
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `job_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up
    } catch (error) {
      console.error('CSV Export Error:', error);
      alert('Failed to export CSV. Please check the console for details or contact support.');
    }
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Applied': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Interview': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'Offer': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'On Hold': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'In Review': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Matched': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusDotColor = (status: JobStatus) => {
    switch (status) {
      case 'Applied': return 'bg-blue-500';
      case 'Interview': return 'bg-violet-500';
      case 'Offer': return 'bg-emerald-500';
      case 'Rejected': return 'bg-rose-500';
      case 'On Hold': return 'bg-amber-500';
      case 'In Review': return 'bg-indigo-500';
      case 'Matched': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div data-tour="tracker-table" className="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search company, role..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 scrollbar-hide custom-scrollbar">
          <div className="flex items-center gap-2">
            <button
              data-tour="tracker-add-job"
              onClick={onAddJobClick}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shrink-0 shadow-sm"
              title="Add job manually"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Job</span>
            </button>
            {jobs.length > 0 && onExtensionGuideClick && (
              <button
                type="button"
                onClick={onExtensionGuideClick}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                title="Chrome extension"
              >
                <Chrome size={16} />
                <span className="hidden sm:inline">Extension</span>
              </button>
            )}
            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
              title="Export to CSV"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onToggleView}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
            >
              <LayoutGrid size={16} />
              <span className="hidden xs:inline">Kanban View</span>
            </button>
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-xs font-bold uppercase tracking-wider shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {filteredJobs.length} Jobs Tracked
          </div>
        </div>
      </div>

      {/* Table container */}
      {jobs.length === 0 ? (
        <TrackerEmptyState onAddJobClick={onAddJobClick} />
      ) : (
        <>
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-white">
        <table className="min-w-full border-collapse text-left table-fixed">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th
                className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 min-w-[200px]"
              >
                Company & Role
              </th>
              <th
                onClick={() => handleSort('appliedDate')}
                className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap cursor-pointer hover:bg-slate-100/50 transition-colors group"
                title="Sort by Date Applied"
              >
                <div className="flex items-center">
                  Date Applied {getSortIcon('appliedDate')}
                </div>
              </th>
              <th
                className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap relative"
              >
                <button 
                  className="flex items-center gap-1 cursor-pointer hover:text-slate-600 transition-colors group"
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                >
                  Status
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterMenuOpen ? 'rotate-180' : ''} ${statusFilter !== 'All' ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                </button>

                {/* Simple Filter Dropdown */}
                <AnimatePresence>
                  {isFilterMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsFilterMenuOpen(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
                      >
                        <button
                          onClick={() => {
                            onStatusFilterChange('All');
                            setIsFilterMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold transition-colors ${statusFilter === 'All' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          All Statuses
                          {statusFilter === 'All' && <Check size={12} />}
                        </button>
                        <div className="h-px bg-slate-100 my-1" />
                        {JOB_STATUSES.map(status => (
                          <button
                            key={status}
                            onClick={() => {
                              onStatusFilterChange(status as JobStatus);
                              setIsFilterMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold transition-colors ${statusFilter === status ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            {status}
                            {statusFilter === status && <Check size={12} />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Portal</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap relative">
                <button 
                  className="flex items-center gap-1 cursor-pointer hover:text-slate-600 transition-colors group"
                  onClick={() => setIsSourceFilterOpen(!isSourceFilterOpen)}
                >
                  Source
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isSourceFilterOpen ? 'rotate-180' : ''} ${sourceFilter !== 'All' ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                </button>

                {/* Source Filter Dropdown */}
                <AnimatePresence>
                  {isSourceFilterOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsSourceFilterOpen(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute left-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
                      >
                        <button
                          onClick={() => {
                            onSourceFilterChange('All');
                            setIsSourceFilterOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold transition-colors ${sourceFilter === 'All' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          All Sources
                          {sourceFilter === 'All' && <Check size={12} />}
                        </button>
                        <div className="h-px bg-slate-100 my-1" />
                        {(['Manual', 'Extension'] as const).map(src => (
                          <button
                            key={src}
                            onClick={() => {
                              onSourceFilterChange(src);
                              setIsSourceFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold transition-colors ${sourceFilter === src ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            {src}
                            {sourceFilter === src && <Check size={12} />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </th>
              <th
                onClick={() => handleSort('match_score')}
                className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap cursor-pointer hover:bg-slate-100/50 transition-colors group"
                title="Sort by Match Score"
              >
                <div className="flex items-center">
                  Match {getSortIcon('match_score')}
                </div>
              </th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 w-full whitespace-nowrap">Personal Notes</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedJobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onJobClick(job)}
                >
                  {/* Company & Role */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <CompanyLogo company={job.company} size={36} className="shrink-0 rounded-lg border border-slate-100" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {job.role}
                        </div>
                        <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          {job.company}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Date Applied */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(job.appliedDate || (job.createdAt as Date))}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (job.status !== 'Rejected') {
                            setActiveMenu(activeMenu === job.id ? null : job.id);
                          }
                        }}
                        disabled={job.status === 'Rejected'}
                        className={`group/status flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${getStatusColor(job.status)} ${job.status !== 'Rejected' ? 'hover:shadow-sm cursor-pointer' : 'opacity-75 cursor-not-allowed'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(job.status)}`} />
                        {job.status}
                        {job.status !== 'Rejected' && <ChevronDown size={14} className={`transition-transform duration-200 ${activeMenu === job.id ? 'rotate-180' : ''}`} />}
                      </button>

                      {/* Status Menu Dropdown */}
                      <AnimatePresence>
                        {activeMenu === job.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(null);
                              }}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden"
                            >
                              {JOB_STATUSES.map(status => (
                                <button
                                  key={status}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (status === 'Rejected') {
                                      onPromptReject(job.id);
                                    } else if (status === 'Interview') {
                                      onPromptInterview(job);
                                    } else {
                                      onUpdateStatus(job.id, status as JobStatus);
                                    }
                                    setActiveMenu(null);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors ${job.status === status ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(status as JobStatus)}`} />
                                  {status}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>

                  {/* Portal */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded border border-slate-200">
                      {job.portal || 'Direct'}
                    </span>
                  </td>

                  {/* Source */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {job.isManual ? (
                        <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[10px] font-black uppercase tracking-wider">
                          <Database size={12} className="text-slate-400" />
                          Manual
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 text-[10px] font-black uppercase tracking-wider">
                          <Chrome size={12} className="text-blue-400" />
                          Extension
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Match Score */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {job.match_score !== undefined && job.match_score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${job.match_score * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          {getScoreRange(job.match_score * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300">N/A</span>
                    )}
                  </td>

                  {/* Notes Column */}
                  <td className="px-6 py-4">
                    <div className="text-[11px] font-medium text-slate-500 line-clamp-2 max-w-md" title={job.personalNotes}>
                      {job.personalNotes || '-'}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateFavorite(job.id, !job.isFavorite);
                        }}
                        className={`p-2 rounded-lg transition-colors ${job.isFavorite ? 'text-rose-600 bg-rose-50' : 'text-slate-400 hover:bg-slate-100'}`}
                      >
                        <Heart size={16} fill={job.isFavorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const safe = job.link ? getSafeExternalUrl(job.link) : null;
                          if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPromptDelete(job);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

            {filteredJobs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                      <Briefcase className="w-6 h-6 text-slate-300" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">No jobs found</div>
                    <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed mx-auto">
                      Try adjusting your search or add a new job to start tracking.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {filteredJobs.length > 0 && (
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-center">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                page <= 1
                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
              aria-label="Previous page"
            >
              Prev
            </button>

            {/* Page number window controls */}
            <button
              onClick={() => setPageWindowStart((s) => Math.max(1, s - 10))}
              disabled={!canPrevWindow}
              className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all ${
                !canPrevWindow
                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
              aria-label="Previous 10 pages"
              title="Previous 10 pages"
            >
              &lt;
            </button>

            <div className="flex items-center gap-1">
              {visiblePages.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-xl text-xs font-black border transition-all tabular-nums ${
                    p === page
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                  aria-label={`Go to page ${p}`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPageWindowStart((s) => Math.min(Math.max(1, totalPages - 9), s + 10))}
              disabled={!canNextWindow}
              className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all ${
                !canNextWindow
                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
              aria-label="Next 10 pages"
              title="Next 10 pages"
            >
              &gt;
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                page >= totalPages
                  ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
              aria-label="Next page"
            >
              Next
            </button>
            <div className="mx-2 h-6 w-px bg-slate-200" />
            <div className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              {`${pageStartIdx + 1}-${pageEndIdx}`} of {filteredJobs.length}
            </div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default JobTable;
