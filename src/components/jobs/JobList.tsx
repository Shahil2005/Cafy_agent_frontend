import React, { useEffect, useRef, useState, useCallback } from "react";
import { JOB_STATUSES } from "../../utils/constants";

import { motion, AnimatePresence } from "framer-motion";
import type { Job, JobStatus } from "../../types";
import { TOUR_JOB_MARKER } from "../../tour/tourSelectors";
import {
  Search,
  X,
  Plus,
  Chrome,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Table as TableIcon
} from "lucide-react";
import JobCard from "./JobCard";
import TrackerEmptyState from "./TrackerEmptyState";
import { useKanbanHorizontalScroll } from "./useKanbanHorizontalScroll";

// RESPONSIVE UPDATE (2026-01-31):
// Columns display in a horizontally scrollable row on small screens (mobile/tablet) with scroll-snap and compact widths, and lay out naturally in multi-column Kanban on md+ screens.

interface JobListProps {
  jobs: Job[];
  updateStatus: (jobId: string, newStatus: JobStatus, interviewDate?: string, interviewTime?: string) => void;
  updateFavorite: (id: string, isFavorite: boolean) => void;
  statusCounts?: Record<string, number>;
  matchedCount?: number;
  isLoading?: boolean;
  onAddJobClick?: () => void;
  onExtensionGuideClick?: () => void;
  onToggleView?: () => void;
  onJobClick: (job: Job) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sourceFilter: 'Manual' | 'Extension' | 'All';
  onPromptDelete: (job: Job) => void;
  onPromptReject: (jobId: string) => void;
  onPromptInterview: (job: Job) => void;
}

const JobList: React.FC<JobListProps> = ({
  jobs,
  updateStatus,
  updateFavorite,
  isLoading = false,
  onAddJobClick,
  onExtensionGuideClick,
  onToggleView,
  onJobClick,
  searchQuery,
  onSearchChange,
  sourceFilter,
  onPromptDelete,
  onPromptReject,
  onPromptInterview
}) => {

  // Invisible drag image source
  const emptyImg = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      (emptyImg as any).current = img;
    }
  }, []);

  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const wishlistColumnRef = useRef<HTMLDivElement | null>(null);
  const wishlistScrollRef = useRef<HTMLDivElement | null>(null);
  const favoritesColumnRef = useRef<HTMLDivElement | null>(null);
  const favoritesScrollRef = useRef<HTMLDivElement | null>(null);
  const statusColumnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const statusScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [isDragging, setIsDragging] = useState(false);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  // Performance refs: use to avoid frequent state updates during drag
  const hoveredStatusRef = useRef<string | null>(null);
  const rafScheduled = useRef<number | null>(null);
  const lastRectUpdate = useRef<number>(0);

  // Pointer-touch drag fallback state (stored in ref to avoid re-renders)
  const pointerDragState = useRef<{
    active: boolean;
    pointerId: number | null;
    job: Job | null;
    startX: number;
    startY: number;
    moveHandler: ((e: PointerEvent) => void) | null;
    upHandler: ((e: PointerEvent) => void) | null;
    timer: number | null;
  }>({ active: false, pointerId: null, job: null, startX: 0, startY: 0, moveHandler: null, upHandler: null, timer: null });
  const boardRef = useRef<HTMLDivElement>(null);
  const boardRect = useRef<DOMRect | null>(null);
  const animationFrameId = useRef<number | null>(null);
  
  // Scroll Position Tracking for Indicators
  const [columnScrolls, setColumnScrolls] = useState<Record<string, { top: boolean; bottom: boolean }>>({});

  const checkColumnScroll = useCallback((status: string, el: HTMLDivElement | null) => {
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setColumnScrolls(prev => ({
      ...prev,
      [status]: {
        top: scrollTop > 10,
        bottom: scrollTop < scrollHeight - clientHeight - 10
      }
    }));
  }, []);

  // Drag and drop logic...

  const stopHorizontalAutoScroll = () => {
    boardRect.current = null;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };

  const updateDragPreviewPosition = (clientX: number, clientY: number) => {
    if (!dragPreviewRef.current || !boardViewportRef.current) return;

    const viewportRect = boardViewportRef.current.getBoundingClientRect();
    const previewWidth = dragPreviewRef.current.offsetWidth || Math.min(320, viewportRect.width);
    const previewHeight = dragPreviewRef.current.offsetHeight || 200;
    const halfWidth = previewWidth / 2;
    const halfHeight = previewHeight / 2;

    const relativeX = clientX - viewportRect.left;
    const relativeY = clientY - viewportRect.top;

    const clampedX = Math.max(halfWidth, Math.min(relativeX, viewportRect.width - halfWidth));
    const clampedY = Math.max(halfHeight, Math.min(relativeY, viewportRect.height - halfHeight));

    dragPreviewRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
  };


  // Handle drag over
  const handleDragOver = (e: React.DragEvent, target?: string) => {
    e.preventDefault();

    // Auto-scroll logic using requestAnimationFrame for 60fps smoothness
    if (boardRef.current) {
      const board = boardRef.current;

      // Recompute rect to account for scroll changes
      boardRect.current = board.getBoundingClientRect();

      const { left, right } = boardRect.current;
      const x = e.clientX;
      const threshold = 120; // Increased threshold for easier activation
      const maxScrollSpeed = 25; // Faster max speed

      // Calculate speed based on proximity to edge (ease-in effect)
      const getScrollSpeed = (distance: number) => {
        const ratio = 1 - Math.max(0, distance) / threshold;
        return maxScrollSpeed * (ratio * ratio); // Quadratic ease-in for smoother ramp-up
      };

      const scrollRight = x > right - threshold;
      const scrollLeft = x < left + threshold;

      if (scrollRight || scrollLeft) {
        if (!animationFrameId.current) {
          const scroll = () => {
            if (scrollRight) {
              const distance = right - x;
              board.scrollLeft += getScrollSpeed(distance);
            } else {
              const distance = x - left;
              board.scrollLeft -= getScrollSpeed(distance);
            }
            animationFrameId.current = requestAnimationFrame(scroll);
          };
          animationFrameId.current = requestAnimationFrame(scroll);
        }
      } else {
        stopHorizontalAutoScroll();
      }
    }

    updateDragPreviewPosition(e.clientX, e.clientY);

    // Determine hovered target by element under pointer if not provided
    try {
      // Throttle bounding rect recompute to avoid layout thrash when board is scrolling
      if (boardRef.current && (!boardRect.current || Date.now() - lastRectUpdate.current > 150)) {
        boardRect.current = boardRef.current.getBoundingClientRect();
        lastRectUpdate.current = Date.now();
      }

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const col = el?.closest('[data-status]') as HTMLElement | null;
      const detected = col?.getAttribute('data-status') || null;

      // Use RAF to avoid state thrashing — update hoveredStatus only when changed
      if (hoveredStatusRef.current !== detected) {
        hoveredStatusRef.current = detected;
        if (!rafScheduled.current) {
          rafScheduled.current = requestAnimationFrame(() => {
            setHoveredStatus(hoveredStatusRef.current);
            rafScheduled.current = null;
          });
        }
      }

      if (!target && detected) {
        target = detected;
      }
    } catch (err) {
      // elementFromPoint can fail in some contexts; ignore
    }

    // Rejected jobs can only be dragged to favorites or back to Rejected
    const normalizedTarget = (target || '').toString();
    if (draggedJob?.status === "Rejected" && normalizedTarget !== "favorites" && normalizedTarget !== "Rejected") {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
      return;
    }

    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  };

  const stopAutoScroll = () => {
    stopHorizontalAutoScroll();
    hoveredStatusRef.current = null;
    setHoveredStatus(null);
  };



  // Touch/pointer-based drag fallback for devices where HTML5 drag isn't reliable
  const initPointerDrag = (job: Job) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    const startX = e.clientX;
    const startY = e.clientY;


    let isCanceled = false;

    // Start a 250ms hold timer to distinguish between drag and scroll
    pointerDragState.current.timer = window.setTimeout(() => {
      if (isCanceled) return;
      pointerDragState.current.active = true;
      pointerDragState.current.job = job;
      setIsDragging(true);
      setDraggedJob(job);
      updateDragPreviewPosition(startX, startY);
    }, 250);

    const moveHandler = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!pointerDragState.current.active) {
        // If the user moves their finger > 10px before the 250ms timer finishes,
        // it's a scroll swipe. Cancel the drag.
        if (Math.hypot(dx, dy) > 10) {
          isCanceled = true;
          if (pointerDragState.current.timer) {
            clearTimeout(pointerDragState.current.timer);
            pointerDragState.current.timer = null;
          }
          // Remove listeners immediately back to native interaction
          window.removeEventListener('pointermove', moveHandler);
          window.removeEventListener('pointerup', upHandler);
          window.removeEventListener('pointercancel', upHandler);
        }
      } else {
        // Drag is active, update preview
        updateDragPreviewPosition(ev.clientX, ev.clientY);

        // Determine hovered status and schedule update
        try {
          const elAt = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
          const col = elAt?.closest('[data-status]') as HTMLElement | null;
          const detected = col?.getAttribute('data-status') || null;
          if (hoveredStatusRef.current !== detected) {
            hoveredStatusRef.current = detected;
            if (!rafScheduled.current) {
              rafScheduled.current = requestAnimationFrame(() => {
                setHoveredStatus(hoveredStatusRef.current);
                rafScheduled.current = null;
              });
            }
          }
        } catch (err) { /* ignore */ }

        // Auto-scroll if near edges
        if (boardRef.current) {
          try {
            if (!boardRect.current || Date.now() - lastRectUpdate.current > 150) {
              boardRect.current = boardRef.current.getBoundingClientRect();
              lastRectUpdate.current = Date.now();
            }
            const r = boardRect.current;
            const threshold = 120;
            if (ev.clientX > r.right - threshold) {
              boardRef.current.scrollLeft += 12;
            } else if (ev.clientX < r.left + threshold) {
              boardRef.current.scrollLeft -= 12;
            }
          } catch (err) { /* ignore */ }
        }
      }
    };

    const upHandler = (ev: PointerEvent) => {
      isCanceled = true; // prevent the timer from firing if it hasn't yet
      if (pointerDragState.current.timer) {
        clearTimeout(pointerDragState.current.timer);
        pointerDragState.current.timer = null;
      }

      if (pointerDragState.current.active && pointerDragState.current.job) {
        // Find drop target
        try {
          const elAt = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
          const col = elAt?.closest('[data-status]') as HTMLElement | null;
          const target = col?.getAttribute('data-status');
          if (target) {
            // Reuse handleDrop logic (cast an empty event)
            handleDrop({ preventDefault: () => { }, dataTransfer: null } as any, target as any);
          }
        } catch (err) { /* ignore */ }
      }

      // Cleanup
      pointerDragState.current.active = false;
      pointerDragState.current.job = null;
      setIsDragging(false);
      setDraggedJob(null);
      setHoveredStatus(null);

      window.removeEventListener('pointermove', moveHandler);
      window.removeEventListener('pointerup', upHandler);
      window.removeEventListener('pointercancel', upHandler);
    };

    // Attach handlers
    window.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', upHandler);
    window.addEventListener('pointercancel', upHandler);

    // Store handlers so we can clean up if needed
    pointerDragState.current.moveHandler = moveHandler;
    pointerDragState.current.upHandler = upHandler;
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, target: JobStatus | "favorites" | "Wishlist") => {
    e.preventDefault();
    stopAutoScroll();
    if (draggedJob) {
      if (draggedJob.status === "Rejected" && target !== "favorites" && target !== "Rejected") {
        setDraggedJob(null);
        return;
      }
      if (target === "favorites") {
        updateFavorite(draggedJob.id, true);
      } else if (target === "Wishlist") {
        // Wishlist is a UI view of all jobs rather than a distinct JobStatus. We don't change the job's status here.
        setDraggedJob(null);
        setHoveredStatus(null);
        return;
      } else if (target === "Rejected") {
        onPromptReject(draggedJob.id);
      } else if (target === "Interview") {
        onPromptInterview(draggedJob);
      } else {
        updateStatus(draggedJob.id, target as JobStatus);
      }
    }
    setDraggedJob(null);
    setHoveredStatus(null);
  };

  // handleScheduleSubmit removed (now in JobDetailModal)

  // Cleanup RAF and pointer handlers when component unmounts
  useEffect(() => {
    return () => {
      if (rafScheduled.current) cancelAnimationFrame(rafScheduled.current);
      if (pointerDragState.current.moveHandler) window.removeEventListener('pointermove', pointerDragState.current.moveHandler);
      if (pointerDragState.current.upHandler) window.removeEventListener('pointerup', pointerDragState.current.upHandler);
    };
  }, []);

  // Memoize filtered jobs
  const filteredJobs = React.useMemo(() => {
    let result = [...jobs];
    
    // 1. Source filter
    if (sourceFilter !== 'All') {
      result = result.filter(job => {
        if (sourceFilter === 'Manual') return job.isManual;
        if (sourceFilter === 'Extension') return !job.isManual;
        return true;
      });
    }

    // 2. Search filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(
        (job) =>
          job.company.toLowerCase().includes(query) ||
          job.role.toLowerCase().includes(query) ||
          job.portal.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [jobs, searchQuery, sourceFilter]);

  // Memoize jobs grouped by status
  const jobsByStatus = React.useMemo(() => {
    const groups: Record<string, Job[]> = {};
    filteredJobs.forEach((job) => {
      if (!groups[job.status]) groups[job.status] = [];
      groups[job.status].push(job);
    });
    return groups;
  }, [filteredJobs]);

  const getJobsByStatus = (status: JobStatus) => {
    return jobsByStatus[status] || [];
  };

  const isTourJob = (job: Job) =>
    Boolean(
      job.personalNotes?.includes(TOUR_JOB_MARKER) || job.notes?.includes(TOUR_JOB_MARKER)
    );

  // Column styles mapping
  const COLUMN_STYLES: Record<string, string> = {
    wishlist: "bg-slate-100/80 border-slate-200",
    favorites: "bg-rose-50 border-rose-100",
    Applied: "bg-blue-50 border-blue-100",
    Interview: "bg-violet-50 border-violet-100",
    Offer: "bg-emerald-50 border-emerald-100",
    Rejected: "bg-red-50 border-red-100",
    "On Hold": "bg-amber-50 border-amber-100",
  };

  const kanbanLayoutKey = `${jobs.length}:${filteredJobs.length}:${searchQuery}:${sourceFilter}`;
  const kanbanScrollEnabled = !isLoading && jobs.length > 0;
  const {
    showScrollButtons,
    canScrollLeft,
    canScrollRight,
    scrollBoard,
    onBoardScroll,
  } = useKanbanHorizontalScroll(boardRef, kanbanScrollEnabled, kanbanLayoutKey);

  const showKanbanNav = showScrollButtons && !isDragging;

  return (
    <div className="font-sans h-full flex flex-col min-h-0 bg-slate-50">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 px-2">

        {/* Sober Centered Search Bar */}
        <div className="flex-1 flex justify-center max-w-3xl mx-auto w-full order-3 lg:order-2 gap-3 lg:gap-4">
          <div className="relative group w-full min-w-0 flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-black transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Filter by company, role, or portal..."
              className="w-full pl-11 pr-11 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold text-black placeholder:text-slate-400 focus:outline-none focus:border-black transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-black transition-colors"
                title="Clear Search"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            )}
          </div>
          {jobs.length > 0 && onExtensionGuideClick && (
            <button
              type="button"
              onClick={onExtensionGuideClick}
              className="px-4 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:border-slate-400 transition-all inline-flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <Chrome className="w-4 h-4" />
              <span className="hidden sm:inline">Extension</span>
            </button>
          )}
          {onAddJobClick && (
            <button
              data-tour="tracker-add-job"
              onClick={onAddJobClick}
              className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Job
            </button>
          )}
          {onToggleView && (
            <button
              data-tour="tracker-table-toggle"
              onClick={onToggleView}
              className="px-4 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:border-slate-400 transition-all inline-flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Table View</span>
            </button>
          )}
        </div>

      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div data-tour="tracker-kanban" className="flex items-start gap-6 overflow-hidden h-full pb-4 px-2">
          {/* Wishlist Skeleton */}
          <div className="flex-shrink-0 w-[90vw] md:w-[340px] snap-start flex flex-col h-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 animate-pulse">
            <div className="mb-4 p-3 rounded-xl bg-slate-200/50 h-14 w-full" />
            <div className="space-y-4 px-1">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-48 rounded-lg bg-slate-200/40 w-full" />
              ))}
            </div>
          </div>
          {/* Favorites Skeleton */}
          <div className="flex-shrink-0 w-[90vw] md:w-[340px] snap-start flex flex-col h-full rounded-lg border border-slate-50/50 p-2 animate-pulse">
            <div className="mb-4 p-3 rounded-xl bg-slate-200/50 h-14 w-full" />
            <div className="space-y-4 px-1">
              {[1, 2].map((j) => (
                <div key={j} className="h-48 rounded-lg bg-slate-200/40 w-full" />
              ))}
            </div>
          </div>
          {/* Columns Skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[90vw] md:w-[340px] snap-start flex flex-col h-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 animate-pulse">
              <div className="mb-4 p-3 rounded-xl bg-slate-200/50 h-14 w-full" />
              <div className="space-y-4 px-1">
                <div className="h-48 rounded-lg bg-slate-200/40 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div ref={boardViewportRef} data-tour="tracker-kanban" className="relative flex-1 min-h-0 overflow-hidden">
          <div
            ref={boardRef}
            onScroll={onBoardScroll}
            onDragLeave={stopAutoScroll}
            onDragEnd={stopAutoScroll}
            className={`overflow-x-auto overflow-y-hidden flex-1 flex min-h-0 pb-4 custom-scrollbar h-full ${isDragging ? 'snap-none' : 'snap-x snap-mandatory'}`}
            style={{ touchAction: 'pan-x' }}
            aria-label="Job tracker kanban board"
          >
            {jobs.length === 0 ? (
              <TrackerEmptyState onAddJobClick={onAddJobClick} />
            ) : (
              <div className="flex-1 flex gap-4 md:gap-6 min-w-max h-full px-2 min-h-0">
                {/* Wishlist Column */}
                <div
                  key="total"
                  data-kanban-column
                  data-status="Wishlist"
                  onDragEnter={() => setHoveredStatus('Wishlist')}
                  onDragLeave={() => setHoveredStatus(null)}
                  ref={wishlistColumnRef}
                  className={`relative flex-shrink-0 w-[90vw] md:w-[340px] snap-start flex flex-col h-full rounded-lg border ${COLUMN_STYLES.wishlist} p-2 ${hoveredStatus === 'Wishlist' ? 'ring-2 ring-slate-300' : ''}`}
                >
                  <div className="mb-4 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-slate-950 text-sm tracking-wide">Wishlist</h3>
                      <span className="flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-black bg-white text-slate-800 rounded-lg border border-slate-300 shadow-sm">
                        {filteredJobs.length}
                      </span>
                    </div>
                  </div>

                  {/* Vertical Scroll Indicators for Wishlist - Now Absolute Parent-relative */}
                  {columnScrolls['Wishlist']?.bottom && (
                    <div className="absolute bottom-2 left-2 right-2 h-10 z-[2] pointer-events-none bg-gradient-to-t from-slate-100 to-transparent rounded-b-lg flex justify-center items-end pb-1">
                      <ChevronDown size={14} className="text-slate-400 animate-bounce" />
                    </div>
                  )}
                  {columnScrolls['Wishlist']?.top && (
                    <div className="absolute top-16 left-2 right-2 h-10 z-[2] pointer-events-none bg-gradient-to-b from-slate-100 to-transparent rounded-t-lg flex justify-center items-start pt-1">
                      <ChevronUp size={14} className="text-slate-400 animate-bounce" />
                    </div>
                  )}

                  <div
                    onDragOver={(e) => handleDragOver(e, "Wishlist")}
                    onDrop={(e) => handleDrop(e, 'Wishlist')}
                    onScroll={(e) => checkColumnScroll('Wishlist', e.currentTarget)}
                    ref={(node) => {
                      wishlistScrollRef.current = node;
                      if (node && !columnScrolls['Wishlist']) checkColumnScroll('Wishlist', node);
                    }}
                    data-column-scroll
                    className={`flex-1 space-y-4 p-1 rounded-lg overflow-y-auto custom-scrollbar ${draggedJob ? "bg-slate-200/50 ring-1 ring-slate-300/50" : "bg-transparent"} min-h-[150px]`}
                  >
                    <AnimatePresence mode="wait">
                      {filteredJobs.length === 0 && !searchQuery ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-lg m-2">
                          No jobs found
                        </div>
                      ) : (
                        filteredJobs.map((job) => (
                          <motion.div
                            layout={!isDragging}
                            key={job.id}
                            draggable={true}
                            onPointerDown={initPointerDrag(job)}
                            onDragStart={(e) => {
                              setIsDragging(true);
                              setDraggedJob(job);
                              const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
                              if (dragEvent.dataTransfer) {
                                dragEvent.dataTransfer.effectAllowed = "move";
                                if (emptyImg.current) {
                                  dragEvent.dataTransfer.setDragImage(emptyImg.current, 0, 0);
                                }
                              }
                            }}
                            onDragEnd={() => { setIsDragging(false); setDraggedJob(null); setHoveredStatus(null); }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                              layout: { type: "spring", stiffness: 500, damping: 25 },
                              opacity: { duration: 0.1 }
                            }}
                            className="!cursor-pointer active:!cursor-grabbing select-none"
                            style={{ willChange: "transform" }}
                            onDrag={(e: any) => {
                              if (e.clientX && e.clientX !== 0) {
                                updateDragPreviewPosition(e.clientX, e.clientY);
                              }
                            }}
                          >
                            <JobCard
                              job={job}
                              onClick={() => onJobClick(job)}
                              onToggleFavorite={() => updateFavorite(job.id, !job.isFavorite)}
                              onDelete={() => onPromptDelete(job)}
                              menuContainer={wishlistColumnRef.current}
                              menuScrollContainer={wishlistScrollRef.current}
                              onUpdateStatus={(newStatus) => {
                                if (newStatus === "Rejected") {
                                  onPromptReject(job.id);
                                } else if (newStatus === "Interview") {
                                  onPromptInterview(job);
                                } else {
                                  updateStatus(job.id, newStatus);
                                }
                              }}
                            />
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Favorites Column */}
                <div
                  key="favorites"
                  data-kanban-column
                  data-status="favorites"
                  onDragEnter={() => setHoveredStatus('favorites')}
                  onDragLeave={() => setHoveredStatus(null)}
                  ref={favoritesColumnRef}
                  className={`relative flex-shrink-0 w-[90vw] md:w-[340px] snap-start flex flex-col h-full rounded-lg border ${COLUMN_STYLES.favorites} p-2 ${hoveredStatus === 'favorites' ? 'ring-2 ring-slate-300' : ''}`}
                >
                  <div className="mb-4 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-slate-950 text-sm tracking-wide">Favorites</h3>
                      <span className="flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-black bg-white text-rose-700 rounded-lg border border-rose-200 shadow-sm">
                        {filteredJobs.filter((j) => j.isFavorite).length}
                      </span>
                    </div>
                  </div>

                  {/* Vertical Scroll Indicators for Favorites - Now Absolute Parent-relative */}
                  {columnScrolls['favorites']?.bottom && (
                    <div className="absolute bottom-2 left-2 right-2 h-10 z-[2] pointer-events-none bg-gradient-to-t from-rose-50 to-transparent rounded-b-lg flex justify-center items-end pb-1">
                      <ChevronDown size={14} className="text-rose-400 animate-bounce" />
                    </div>
                  )}
                  {columnScrolls['favorites']?.top && (
                    <div className="absolute top-16 left-2 right-2 h-10 z-[2] pointer-events-none bg-gradient-to-b from-rose-50 to-transparent rounded-t-lg flex justify-center items-start pt-1">
                      <ChevronUp size={14} className="text-rose-400 animate-bounce" />
                    </div>
                  )}

                  <div
                    onDragOver={(e) => handleDragOver(e, "favorites")}
                    onDrop={(e) => handleDrop(e, "favorites")}
                    onScroll={(e) => checkColumnScroll('favorites', e.currentTarget)}
                    ref={(node) => {
                      favoritesScrollRef.current = node;
                      if (node && !columnScrolls['favorites']) checkColumnScroll('favorites', node);
                    }}
                    data-column-scroll
                    className={`flex-1 space-y-4 p-1 rounded-xl transition-colors overflow-y-auto custom-scrollbar ${draggedJob ? "bg-slate-200/50 ring-1 ring-slate-300/50" : "bg-transparent"} min-h-[150px]`}
                  >
                    <AnimatePresence>
                      {filteredJobs.filter((j) => j.isFavorite).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-xl m-2">
                          No favorites yet
                        </div>
                      ) : (
                        filteredJobs
                          .filter((j) => j.isFavorite)
                          .map((job) => (
                            <motion.div
                              layout={!isDragging}
                              key={job.id}
                              draggable={true}
                              onPointerDown={initPointerDrag(job)}
                              onDragStart={(e) => {
                                setIsDragging(true);
                                setDraggedJob(job);
                                const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
                                if (dragEvent.dataTransfer) {
                                  dragEvent.dataTransfer.effectAllowed = "move";
                                  if (emptyImg.current) {
                                    dragEvent.dataTransfer.setDragImage(emptyImg.current, 0, 0);
                                  }
                                }
                              }}
                              onDragEnd={() => { setIsDragging(false); setDraggedJob(null); setHoveredStatus(null); }}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{
                                layout: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                              }}
                              className="!cursor-pointer active:!cursor-grabbing select-none"
                              style={{ willChange: "transform" }}
                              onDrag={(e: any) => {
                                if (e.clientX && e.clientX !== 0) {
                                  updateDragPreviewPosition(e.clientX, e.clientY);
                                }
                              }}
                            >
                              <JobCard
                                job={job}
                                onClick={() => onJobClick(job)}
                                onToggleFavorite={() => updateFavorite(job.id, !job.isFavorite)}
                                onDelete={() => onPromptDelete(job)}
                                menuContainer={favoritesColumnRef.current}
                                menuScrollContainer={favoritesScrollRef.current}
                                onUpdateStatus={(newStatus) => {
                                  if (newStatus === "Rejected") {
                                    onPromptReject(job.id);
                                  } else if (newStatus === "Interview") {
                                    onPromptInterview(job);
                                  } else {
                                    updateStatus(job.id, newStatus);
                                  }
                                }}
                              />
                            </motion.div>
                          ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {JOB_STATUSES.map((status) => (
                  <div
                    key={status}
                    data-kanban-column
                    data-status={status}
                    onDragEnter={() => setHoveredStatus(status)}
                    onDragLeave={() => setHoveredStatus(null)}
                    ref={(node) => {
                      statusColumnRefs.current[status] = node;
                    }}
                    className={`relative flex-shrink-0 w-[90vw] md:w-[340px] snap-start flex flex-col h-full rounded-lg border ${COLUMN_STYLES[status] || "bg-zinc-900/40 border-zinc-800"} p-2 ${hoveredStatus === status ? 'ring-2 ring-slate-300' : ''}`}
                  >
                    <div className="mb-4 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-slate-950 text-sm tracking-wide">{status}</h3>
                        <span className="flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-black bg-white text-slate-800 rounded-lg border border-slate-300 shadow-sm">
                          {getJobsByStatus(status as JobStatus).length}
                        </span>
                      </div>
                    </div>

                    {/* Vertical Scroll Indicators for Generic Status - Now Absolute Parent-relative */}
                    {columnScrolls[status]?.bottom && (
                      <div className="absolute bottom-2 left-2 right-2 h-10 z-[2] pointer-events-none bg-gradient-to-t from-white/80 to-transparent rounded-b-lg flex justify-center items-end pb-1">
                        <ChevronDown size={14} className="text-slate-400 opacity-60 animate-bounce" />
                      </div>
                    )}
                    {columnScrolls[status]?.top && (
                      <div className="absolute top-16 left-2 right-2 h-10 z-[2] pointer-events-none bg-gradient-to-b from-white/80 to-transparent rounded-t-lg flex justify-center items-start pt-1">
                        <ChevronUp size={14} className="text-slate-400 opacity-60 animate-bounce" />
                      </div>
                    )}

                    <div
                      onDragOver={(e) => handleDragOver(e, status)}
                      onDrop={(e) => handleDrop(e, status as JobStatus)}
                      onScroll={(e) => checkColumnScroll(status, e.currentTarget)}
                      ref={(node) => {
                        statusScrollRefs.current[status] = node;
                        if (node && !columnScrolls[status]) checkColumnScroll(status, node);
                      }}
                      data-column-scroll
                      className={`flex-1 space-y-4 p-1 rounded-xl transition-colors overflow-y-auto custom-scrollbar ${draggedJob && draggedJob.status !== status ? "bg-slate-50 border border-slate-300 shadow-inner" : "bg-transparent"} min-h-[150px]`}
                    >
                      <AnimatePresence>
                        {getJobsByStatus(status as JobStatus).map((job) => (
                          <motion.div
                            layout={!isDragging}
                            key={job.id}
                            data-tour={isTourJob(job) ? "tour-job-card" : undefined}
                            draggable={true}
                            onPointerDown={initPointerDrag(job)}
                            onDragStart={(e) => {
                              setIsDragging(true);
                              setDraggedJob(job);
                              const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
                              if (dragEvent.dataTransfer) {
                                dragEvent.dataTransfer.effectAllowed = "move";
                                if (emptyImg.current) {
                                  dragEvent.dataTransfer.setDragImage(emptyImg.current, 0, 0);
                                }
                              }
                            }}
                            onDragEnd={() => { setIsDragging(false); setDraggedJob(null); setHoveredStatus(null); }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                              layout: { type: "spring", stiffness: 300, damping: 30 },
                              opacity: { duration: 0.2 }
                            }}
                            className="!cursor-pointer active:!cursor-grabbing select-none"
                            style={{ willChange: "transform" }}
                            onDrag={(e: any) => {
                              if (e.clientX && e.clientX !== 0) {
                                updateDragPreviewPosition(e.clientX, e.clientY);
                              }
                            }}
                          >
                            <JobCard
                              job={job}
                              onClick={() => onJobClick(job)}
                              onToggleFavorite={() => updateFavorite(job.id, !job.isFavorite)}
                              onDelete={() => onPromptDelete(job)}
                              onUpdateStatus={(newStatus) => {
                                if (newStatus === "Rejected") {
                                  onPromptReject(job.id);
                                } else if (newStatus === "Interview") {
                                  onPromptInterview(job);
                                } else {
                                  updateStatus(job.id, newStatus);
                                }
                              }}
                              menuContainer={statusColumnRefs.current[status]}
                              menuScrollContainer={statusScrollRefs.current[status]}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}

                <div className="flex-shrink-0 w-[90vw] md:w-[340px]" aria-hidden="true" />
              </div>
            )}
          </div>

          {showKanbanNav && canScrollLeft && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-16 z-[4] bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent"
              aria-hidden
            />
          )}
          {showKanbanNav && canScrollRight && (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-16 z-[4] bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent"
              aria-hidden
            />
          )}

          {showKanbanNav && (
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-[5] flex items-center justify-between px-2 sm:px-3">
              <button
                type="button"
                aria-label="Scroll to previous column"
                disabled={!canScrollLeft}
                onClick={() => scrollBoard('left')}
                className="pointer-events-auto p-2.5 rounded-full border-2 border-slate-200 bg-white text-slate-600 shadow-md hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all disabled:opacity-0 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Scroll to next column"
                disabled={!canScrollRight}
                onClick={() => scrollBoard('right')}
                className="pointer-events-auto p-2.5 rounded-full border-2 border-slate-200 bg-white text-slate-600 shadow-md hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all disabled:opacity-0 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          )}

          {draggedJob && (
            <div
              ref={dragPreviewRef}
              className="absolute top-0 left-0 pointer-events-none z-20"
              style={{ willChange: 'transform', width: 'min(320px, 90vw)' }}
            >
              <div className="transform -translate-x-1/2 -translate-y-1/2 rotate-1 bg-white shadow-2xl rounded-lg ring-1 ring-slate-200">
                <JobCard job={draggedJob} onClick={() => { }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobList;
