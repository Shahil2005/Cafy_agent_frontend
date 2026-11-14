import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Building2,
  Car,
  Check,
  CircuitBoard,
  Clock3,
  Cpu,
  Download,
  Eye,
  Factory,
  FileText,
  Landmark,
  Loader2,
  Shield,
  Sparkles,
  Trophy,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import PdfPreview from '../common/PdfPreview';
import {
  downloadResourceFile,
  FALLBACK_CATEGORIES,
  FALLBACK_RESOURCES,
  fetchResourceBlobUrl,
  listResourcesCatalog,
  ResourcesApiError,
  sortCategories,
  trackResourceDownload,
  type ResourceCategoryId,
  type ResourceCategoryItem,
  type ResourceId,
  type ResourceItem,
} from '../../services/resourcesService';
import { captureProductEvent } from '../../lib/observability/posthog';
import { ProductEvents } from '../../lib/observability/events';
import { useAuth } from '../../hooks/useAuth';
import { isIrelandCareerLocation } from '../../utils/sponsorshipHubRouting';
import UkOnlyFeatureNotice from '../common/UkOnlyFeatureNotice';

const CATEGORY_ICONS: Record<ResourceCategoryId, LucideIcon> = {
  nhs: Building2,
  council: Landmark,
  manufacturing: Factory,
  automobile: Car,
  finance: Wallet,
  football: Trophy,
  technology: Cpu,
  'supply-chain': Truck,
  electronics: CircuitBoard,
};

/** Renders simple `**bold**` markers from catalog description strings. */
function renderDescriptionWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

type ViewerState = {
  resourceId: ResourceId;
  categoryId: ResourceCategoryId;
  title: string;
  url: string;
};

function ResourcePdfViewerModal({
  viewer,
  downloading,
  onClose,
  onDownload,
}: {
  viewer: ViewerState;
  downloading: boolean;
  onClose: () => void;
  onDownload: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-pdf-viewer-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22 }}
        className="bg-white w-full sm:max-w-4xl h-[92vh] sm:h-[88vh] rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 bg-white shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Viewing
            </p>
            <h2
              id="resource-pdf-viewer-title"
              className="text-sm sm:text-base font-semibold text-slate-900 truncate"
            >
              {viewer.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3 py-2 min-h-[40px]"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="w-3.5 h-3.5" aria-hidden />
            )}
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Close viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-slate-100/80 p-2 sm:p-4">
          <PdfPreview url={viewer.url} />
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function PdfPreviewArt({
  reduceMotion,
  label,
  icon: Icon,
}: {
  reduceMotion: boolean;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative mx-auto w-full">
      <motion.div
        className="absolute -inset-4 sm:-inset-6 rounded-[40px] bg-gradient-to-br from-sky-200/50 via-blue-100/30 to-transparent blur-2xl"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        className="relative w-full aspect-[3/4] rounded-2xl sm:rounded-[22px] border border-white/70 bg-white shadow-[0_30px_60px_-28px_rgba(15,23,42,0.45)] overflow-hidden"
        initial={reduceMotion ? false : { opacity: 0, y: 18, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: reduceMotion ? 0 : -1.5 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="h-11 sm:h-12 bg-slate-900 px-3.5 sm:px-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-white tracking-wide truncate">
              {label}
            </p>
            <p className="text-[9px] text-slate-300 truncate">Cafy Careers · UK</p>
          </div>
        </div>
        <div className="p-3.5 sm:p-4 space-y-2 h-[calc(100%-2.75rem)]">
          <div className="h-2 w-2/3 rounded-full bg-slate-200" />
          <div className="h-1.5 w-full rounded-full bg-slate-100" />
          <div className="h-1.5 w-[92%] rounded-full bg-slate-100" />
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 space-y-1.5"
              >
                <div className="h-1.5 w-8 rounded-full bg-sky-200/80" />
                <div className="h-1.5 w-full rounded-full bg-slate-200" />
                <div className="h-1.5 w-3/4 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-white to-transparent" />
      </motion.div>
      <motion.div
        className="absolute -right-1 top-12 sm:-right-3 sm:top-14 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-lg shadow-slate-200/60"
        initial={reduceMotion ? false : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
          Format
        </p>
        <p className="text-xs font-semibold text-slate-800">PDF</p>
      </motion.div>
    </div>
  );
}

const ResourcesTab: React.FC = () => {
  const { user, profileLoaded } = useAuth();
  const irelandProfile = isIrelandCareerLocation(user?.preferences?.locations);
  const [ukOnlyFromApi, setUkOnlyFromApi] = useState(false);
  const reduceMotion = useReducedMotion() === true;
  const [categories, setCategories] =
    useState<ResourceCategoryItem[]>(FALLBACK_CATEGORIES);
  const [resourcesById, setResourcesById] = useState<Partial<Record<ResourceId, ResourceItem>>>(
    () => Object.fromEntries(FALLBACK_RESOURCES.map((r) => [r.id, r]))
  );
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<ResourceCategoryId>('council');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<ResourceId | null>(null);
  const [justDownloadedId, setJustDownloadedId] = useState<ResourceId | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [viewerOpening, setViewerOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const viewerBlobUrlRef = useRef<string | null>(null);

  const closeViewer = useCallback(() => {
    setViewer(null);
    if (viewerBlobUrlRef.current) {
      URL.revokeObjectURL(viewerBlobUrlRef.current);
      viewerBlobUrlRef.current = null;
    }
  }, []);

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => c.id === selectedCategoryId) ??
      categories[0] ??
      FALLBACK_CATEGORIES[0],
    [categories, selectedCategoryId]
  );
  const selectedResource = selectedCategory.resourceId
    ? resourcesById[selectedCategory.resourceId]
    : undefined;
  const isAvailable =
    selectedCategory.status === 'available' && selectedCategory.resourceId != null;
  const SelectedIcon = CATEGORY_ICONS[selectedCategory.id] ?? Building2;
  const title = selectedResource?.title ?? selectedCategory.title;
  const description = selectedResource?.description ?? selectedCategory.description;
  const badge = selectedResource?.badge ?? selectedCategory.badge;
  const highlights =
    (selectedResource?.highlights?.length
      ? selectedResource.highlights
      : selectedCategory.highlights) || [];
  const downloadCount =
    selectedResource?.downloadCount ?? selectedCategory.downloadCount ?? 0;
  const moreCategories = useMemo(
    () => categories.filter((c) => c.id !== selectedCategoryId),
    [categories, selectedCategoryId]
  );

  useEffect(() => {
    if (!profileLoaded || irelandProfile) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const data = await listResourcesCatalog(controller.signal);
        if (controller.signal.aborted) return;
        if (data.categories.length) {
          setCategories(sortCategories(data.categories));
        }
        if (data.resources.length) {
          setResourcesById(
            Object.fromEntries(data.resources.map((r) => [r.id, r]))
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ResourcesApiError && err.code === 'RESOURCES_UK_ONLY') {
          setUkOnlyFromApi(true);
          return;
        }
        setNotice('Showing offline catalog details. Download still works.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [profileLoaded, irelandProfile]);

  useEffect(() => {
    if (!justDownloadedId) return;
    const t = window.setTimeout(() => setJustDownloadedId(null), 2500);
    return () => window.clearTimeout(t);
  }, [justDownloadedId]);

  const openViewer = useCallback(
    async (resourceId: ResourceId, categoryId: ResourceCategoryId) => {
      const resource = resourcesById[resourceId];
      if (!resource) {
        setError('That file is not available right now.');
        return;
      }
      if (resource.fileReady === false) {
        setError('This file is temporarily unavailable. Please try again later.');
        return;
      }

      setError(null);
      setViewerOpening(true);
      try {
        const url = await fetchResourceBlobUrl(resourceId, 'inline');
        if (viewerBlobUrlRef.current) {
          URL.revokeObjectURL(viewerBlobUrlRef.current);
        }
        viewerBlobUrlRef.current = url;
        setViewer({
          resourceId,
          categoryId,
          title: resource.title,
          url,
        });
        captureProductEvent(ProductEvents.RESOURCE_VIEWED, {
          resource_id: resourceId,
          category_id: categoryId,
          file_name: resource.fileName,
        });
      } catch (err) {
        if (err instanceof ResourcesApiError && err.code === 'RESOURCES_UK_ONLY') {
          setUkOnlyFromApi(true);
          return;
        }
        const message =
          err instanceof ResourcesApiError
            ? err.message
            : 'Could not open this PDF. Please try again.';
        setError(message);
      } finally {
        setViewerOpening(false);
      }
    },
    [resourcesById]
  );

  const handleDownload = useCallback(
    async (resourceId: ResourceId, categoryId: ResourceCategoryId) => {
      if (inFlightRef.current) return;
      const resource = resourcesById[resourceId];
      if (!resource) {
        setError('That file is not available right now.');
        return;
      }
      if (resource.fileReady === false) {
        setError('This file is temporarily unavailable. Please try again later.');
        return;
      }

      inFlightRef.current = true;
      setDownloadingId(resourceId);
      setError(null);
      setNotice(null);

      const fileName = resource.fileName;

      try {
        const result = await trackResourceDownload(resourceId);
        setResourcesById((prev) => ({
          ...prev,
          [resourceId]: {
            ...resource,
            ...result,
            downloadCount: result.downloadCount,
            uniqueDownloaderCount: result.uniqueDownloaderCount,
          },
        }));
        setCategories((prev) =>
          prev.map((c) =>
            c.resourceId === resourceId
              ? {
                  ...c,
                  downloadCount: result.downloadCount,
                  uniqueDownloaderCount: result.uniqueDownloaderCount,
                }
              : c
          )
        );
        captureProductEvent(ProductEvents.RESOURCE_DOWNLOADED, {
          resource_id: resourceId,
          category_id: categoryId,
          file_name: result.fileName || fileName,
          download_count: result.downloadCount,
        });
      } catch (err) {
        if (err instanceof ResourcesApiError && err.code === 'RESOURCES_UK_ONLY') {
          setDownloadingId(null);
          inFlightRef.current = false;
          setUkOnlyFromApi(true);
          return;
        }
        const message =
          err instanceof ResourcesApiError
            ? err.message
            : 'Could not record this download.';
        setNotice(`${message} Starting file download anyway.`);
      }

      try {
        await downloadResourceFile(resourceId, fileName);
        setJustDownloadedId(resourceId);
      } catch (err) {
        if (err instanceof ResourcesApiError && err.code === 'RESOURCES_UK_ONLY') {
          setUkOnlyFromApi(true);
          return;
        }
        const message =
          err instanceof ResourcesApiError
            ? err.message
            : 'Download failed. Please try again.';
        setError(message);
      } finally {
        setDownloadingId(null);
        inFlightRef.current = false;
      }
    },
    [resourcesById]
  );

  if (!profileLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (irelandProfile || ukOnlyFromApi) {
    return (
      <UkOnlyFeatureNotice
        title="Resources aren’t available for Ireland yet."
        body={
          "These directories currently cover UK employers listed on the UK Register of Licensed Sponsors. You can still use all other Cafy features.\nIf your location is set incorrectly, you can update it in your Profile."
        }
      />
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl sm:rounded-[28px] border border-[#E7ECFF] bg-[linear-gradient(145deg,#F8FAFF_0%,#EEF3FF_48%,#F5F8FF_100%)] shadow-sm">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-16 -right-10 w-56 sm:w-72 h-56 sm:h-72 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 sm:w-80 h-40 sm:h-56 bg-blue-100/50 blur-3xl" />
        </div>

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar">
          <div className="min-h-full flex flex-col gap-8 sm:gap-10 p-5 sm:p-7 md:p-8 lg:p-10 xl:p-12">
            <section aria-labelledby="resources-featured-heading">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">
                Cafy Resources
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 lg:items-center">
                <div className="order-2 flex items-center justify-center py-2 lg:py-0 w-full">
                  {isAvailable && selectedCategory.resourceId ? (
                    <button
                      type="button"
                      onClick={() =>
                        void openViewer(
                          selectedCategory.resourceId!,
                          selectedCategory.id
                        )
                      }
                      disabled={viewerOpening}
                      aria-busy={viewerOpening}
                      className="group relative block w-full max-w-[220px] sm:max-w-[260px] md:max-w-[280px] lg:max-w-[300px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-[22px]"
                      aria-label={`View ${title} PDF`}
                    >
                      <PdfPreviewArt
                        reduceMotion={reduceMotion}
                        label={selectedCategory.label}
                        icon={SelectedIcon}
                      />
                      <span className="pointer-events-none absolute inset-x-6 bottom-4 mx-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold px-3 py-1.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                        <Eye className="w-3.5 h-3.5" aria-hidden />
                        View PDF
                      </span>
                    </button>
                  ) : (
                    <div className="w-full max-w-[220px] sm:max-w-[260px] md:max-w-[280px] lg:max-w-[300px]">
                      <PdfPreviewArt
                        reduceMotion={reduceMotion}
                        label={selectedCategory.label}
                        icon={SelectedIcon}
                      />
                    </div>
                  )}
                </div>

                <div className="order-1 flex flex-col justify-center max-w-xl">
                  <motion.div
                    key={selectedCategory.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <h1
                      id="resources-featured-heading"
                      className="text-[1.75rem] leading-[1.15] sm:text-4xl lg:text-[2.5rem] font-semibold tracking-tight text-slate-900 sm:leading-[1.1]"
                    >
                      {title}
                    </h1>
                    <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                      {renderDescriptionWithBold(description)}
                    </p>
                  </motion.div>

                  <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-slate-700">
                      <Shield className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden />
                      {badge}
                    </span>
                    {isAvailable && selectedResource ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-slate-600">
                          <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          {selectedResource.format} · {selectedResource.fileSizeLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-slate-600">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden />
                          {loading
                            ? 'Loading stats…'
                            : `${downloadCount.toLocaleString()} download${downloadCount === 1 ? '' : 's'}`}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-amber-800">
                        <Clock3 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        Coming soon
                      </span>
                    )}
                  </div>

                  {highlights.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 text-sm text-slate-700"
                        >
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" strokeWidth={3} aria-hidden />
                          </span>
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
                    {isAvailable && selectedCategory.resourceId ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void openViewer(
                              selectedCategory.resourceId!,
                              selectedCategory.id
                            )
                          }
                          disabled={viewerOpening}
                          aria-busy={viewerOpening}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold px-5 py-3.5 min-h-[48px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                        >
                          <Eye className="w-4 h-4" aria-hidden />
                          View PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDownload(
                              selectedCategory.resourceId!,
                              selectedCategory.id
                            )
                          }
                          disabled={downloadingId === selectedCategory.resourceId}
                          aria-busy={downloadingId === selectedCategory.resourceId}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-3.5 transition-colors shadow-lg shadow-slate-900/15 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                        >
                          {downloadingId === selectedCategory.resourceId ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          ) : justDownloadedId === selectedCategory.resourceId ? (
                            <Check className="w-4 h-4" aria-hidden />
                          ) : (
                            <Download className="w-4 h-4" aria-hidden />
                          )}
                          {downloadingId === selectedCategory.resourceId
                            ? 'Preparing download…'
                            : justDownloadedId === selectedCategory.resourceId
                              ? 'Downloaded'
                              : 'Download PDF'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-200 text-slate-500 text-sm font-semibold px-5 py-3.5 min-h-[48px] cursor-not-allowed"
                      >
                        <Clock3 className="w-4 h-4" aria-hidden />
                        Coming soon
                      </button>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.p
                        key="err"
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2"
                        role="alert"
                      >
                        {error}
                      </motion.p>
                    )}
                    {!error && notice && (
                      <motion.p
                        key="notice"
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                      >
                        {notice}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            <section aria-labelledby="resources-more-heading">
              <div className="mb-4">
                <h2
                  id="resources-more-heading"
                  className="text-base sm:text-lg font-semibold text-slate-900"
                >
                  More directories
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Download available directories, or check back for ones still on the way.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {moreCategories.map((category, index) => {
                  const Icon = CATEGORY_ICONS[category.id] ?? Building2;
                  const available =
                    category.status === 'available' && category.resourceId != null;
                  const resource = category.resourceId
                    ? resourcesById[category.resourceId]
                    : undefined;
                  const busy =
                    category.resourceId != null &&
                    downloadingId === category.resourceId;
                  const done =
                    category.resourceId != null &&
                    justDownloadedId === category.resourceId;

                  return (
                    <motion.div
                      key={category.id}
                      role="button"
                      tabIndex={0}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduceMotion ? 0 : 0.04 * index,
                        duration: 0.3,
                      }}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setError(null);
                        setNotice(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCategoryId(category.id);
                          setError(null);
                          setNotice(null);
                        }
                      }}
                      className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 sm:p-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {category.label}
                            </h3>
                            {!available && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                <Clock3 className="w-3 h-3" aria-hidden />
                                Coming soon
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                            {renderDescriptionWithBold(category.description)}
                          </p>
                          {available && resource && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              PDF · {resource.fileSizeLabel}
                              {!loading && resource.downloadCount > 0
                                ? ` · ${resource.downloadCount.toLocaleString()} downloads`
                                : ''}
                            </p>
                          )}
                          {available && category.resourceId && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openViewer(category.resourceId!, category.id);
                                }}
                                disabled={viewerOpening}
                                aria-busy={viewerOpening}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3.5 py-2 min-h-[40px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDownload(
                                    category.resourceId!,
                                    category.id
                                  );
                                }}
                                disabled={busy}
                                aria-busy={busy}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 min-h-[40px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                                ) : done ? (
                                  <Check className="w-3.5 h-3.5" aria-hidden />
                                ) : (
                                  <Download className="w-3.5 h-3.5" aria-hidden />
                                )}
                                {busy
                                  ? 'Preparing…'
                                  : done
                                    ? 'Downloaded'
                                    : 'Download'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {viewer && (
          <ResourcePdfViewerModal
            key={viewer.resourceId}
            viewer={viewer}
            downloading={downloadingId === viewer.resourceId}
            onClose={closeViewer}
            onDownload={() =>
              void handleDownload(viewer.resourceId, viewer.categoryId)
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResourcesTab;
