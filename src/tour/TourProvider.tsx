import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';

import type { User } from '../types';
import { PRODUCT_TOUR_STEPS, type TourStepConfig } from './tourSteps';
import { TOUR_SELECTORS } from './tourSelectors';
import { getTourHighlightSelector, isMobileViewport, tourJobCardExists, waitForElement } from './tourUtils';
import { shouldShowProductTour, TOUR_PENDING_SESSION_KEY } from '../services/tourService';
import {
  isIrelandCareerLocation,
  resolveTourStepPath,
} from '../utils/sponsorshipHubRouting';
import TourContext, { defaultTourUIState, type TourUIState } from './TourContext';

interface TourProviderProps {
  user: User | null;
  hideSidebar: boolean;
  appReady: boolean;
  children: React.ReactNode;
  onCloseMobileSidebar?: () => void;
  updateTourStatus: (updates: {
    status: 'in_progress' | 'completed' | 'skipped';
    currentStepId?: string;
  }) => Promise<void>;
}

const INTERACTIVE_TRACKER_STEPS = new Set([
  'tracker-add-btn',
  'tracker-add-form',
  'tracker-drag',
]);

/** Tour steps that open an external site in a new tab — defer in-app navigation until the user returns. */
const EXTERNAL_LINK_TOUR_STEPS = new Set(['resume-studio', 'chrome-extension']);

const TourProvider: React.FC<TourProviderProps> = ({
  user,
  hideSidebar,
  appReady,
  children,
  onCloseMobileSidebar,
  updateTourStatus,
}) => {
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const currentIndexRef = useRef(0);
  const isRunningRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const startTourRef = useRef<() => Promise<void>>(async () => {});
  const goToStepRef = useRef<(index: number) => Promise<void>>(async () => {});
  const pendingExternalStepRef = useRef<number | null>(null);
  const externalStepTimerRef = useRef<number | null>(null);
  const [tourUI, setTourUI] = useState<TourUIState>(defaultTourUIState);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const clearPendingExternalStep = useCallback(() => {
    if (externalStepTimerRef.current !== null) {
      window.clearTimeout(externalStepTimerRef.current);
      externalStepTimerRef.current = null;
    }
    pendingExternalStepRef.current = null;
  }, []);

  const resumePendingExternalStep = useCallback(() => {
    const pending = pendingExternalStepRef.current;
    if (pending === null || !isRunningRef.current) return;
    clearPendingExternalStep();
    void goToStepRef.current(pending);
  }, [clearPendingExternalStep]);

  const clearTourChrome = useCallback(() => {
    document.body.classList.remove('cafy-tour-kanban-active', 'cafy-tour-add-job-active');
    setTourUI(defaultTourUIState);
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
    }
    driverRef.current = null;
    isRunningRef.current = false;
    setIsTransitioning(false);
  }, []);

  const applyStepUI = useCallback((step: TourStepConfig) => {
    const openModal = Boolean(step.openAddJobModal) && !step.closeAddJobModal;
    setTourUI({
      currentStepId: step.id,
      isRunning: true,
      openAddJobModal: openModal,
      lockAddJobModal: Boolean(step.lockAddJobModal),
      allowKanbanInteraction: Boolean(step.allowKanbanInteraction),
      trackerViewMode: step.trackerViewMode,
    });
    const isAddJobStep = step.id === 'tracker-add-form';
    document.body.classList.toggle('cafy-tour-add-job-active', isAddJobStep);

    if (step.allowKanbanInteraction) {
      document.body.classList.add('cafy-tour-kanban-active');
    } else {
      document.body.classList.remove('cafy-tour-kanban-active');
    }
  }, []);

  const persistStep = useCallback(
    async (stepId: string) => {
      if (!user) return;
      await updateTourStatus({ status: 'in_progress', currentStepId: stepId });
    },
    [updateTourStatus, user]
  );

  const completeTour = useCallback(async () => {
    sessionStorage.removeItem(TOUR_PENDING_SESSION_KEY);
    clearTourChrome();
    await updateTourStatus({ status: 'completed', currentStepId: undefined });
    navigate('/home', { replace: true });
  }, [clearTourChrome, navigate, updateTourStatus]);

  const skipTour = useCallback(async () => {
    sessionStorage.removeItem(TOUR_PENDING_SESSION_KEY);
    clearTourChrome();
    await updateTourStatus({ status: 'skipped', currentStepId: undefined });
    navigate('/home', { replace: true });
  }, [clearTourChrome, navigate, updateTourStatus]);

  const waitForStepTarget = useCallback(async (step: TourStepConfig) => {
    const timeout =
      step.openAddJobModal || step.id === 'career-counselling' || step.id === 'part-time-jobs'
        ? 15000
        : 10000;
    const attempts = INTERACTIVE_TRACKER_STEPS.has(step.id) ? 3 : 1;
    // Career Counselling hero remounts after status load — wait for the real panel.
    const selector =
      step.id === 'career-counselling'
        ? `${TOUR_SELECTORS.CAREER_COUNSELLING_HERO}:not([data-tour-loading])`
        : getTourHighlightSelector(step);

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await waitForElement(selector, timeout);
        return;
      } catch (err) {
        if (step.id === 'tracker-drag') {
          try {
            await waitForElement(TOUR_SELECTORS.TRACKER_KANBAN, timeout);
            return;
          } catch {
            // fall through
          }
        }
        if (attempt < attempts - 1) {
          await new Promise((r) => setTimeout(r, 600));
        } else {
          throw err;
        }
      }
    }
  }, []);

  const ensureRouteAndElement = useCallback(
    async (step: TourStepConfig) => {
      applyStepUI(step);

      if (isMobileViewport()) {
        onCloseMobileSidebar?.();
        await new Promise((r) => setTimeout(r, 200));
      }

      const targetPath = resolveTourStepPath(step.path, user?.preferences);
      const samePath = window.location.pathname === targetPath;
      const navState: Record<string, unknown> = {};
      if (step.trackerViewMode) navState.tourViewMode = step.trackerViewMode;
      if (step.openAddJobModal) navState.openAddJob = true;

      if (!samePath || Object.keys(navState).length > 0) {
        navigate(targetPath, { replace: samePath, state: navState });
      }

      // Let TrackerTab apply tour view mode (table/kanban) before we wait for targets.
      const waitMs = samePath
        ? step.trackerViewMode
          ? 150
          : 0
        : step.openAddJobModal
          ? 200
          : step.trackerViewMode
            ? 200
            : 100;
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }

      await waitForStepTarget(step);

      if (step.scrollTargetIntoView) {
        const el = document.querySelector(step.selector);
        if (el instanceof HTMLElement) {
          // Snap instantly without smooth scroll and remove the forced 450ms scroll wait timeout
          el.scrollIntoView({ block: 'center' });
        }
      }
    },
    [applyStepUI, navigate, onCloseMobileSidebar, user?.preferences, waitForStepTarget]
  );

  const waitForTourJobCard = useCallback(async () => {
    try {
      await waitForElement(TOUR_SELECTORS.TOUR_JOB_CARD, 20000);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1200));
      try {
        await waitForElement(TOUR_SELECTORS.TOUR_JOB_CARD, 12000);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const hasTourJobOnBoard = useCallback(
    () => tourJobCardExists(TOUR_SELECTORS.TOUR_JOB_CARD),
    []
  );

  const shouldSkipStep = useCallback(
    (step: TourStepConfig): boolean => {
      if (step.id === 'tracker-drag' && !hasTourJobOnBoard()) return true;
      if (
        step.id === 'part-time-jobs' &&
        isIrelandCareerLocation(user?.preferences?.locations)
      ) {
        return true;
      }
      return false;
    },
    [hasTourJobOnBoard, user?.preferences?.locations]
  );

  /** Skip drag-and-drop when the user chose not to add a tour job, and part-time jobs for Ireland. */
  const getNextStepIndex = useCallback(
    (currentIndex: number): number => {
      let next = currentIndex + 1;
      while (next < PRODUCT_TOUR_STEPS.length) {
        const step = PRODUCT_TOUR_STEPS[next];
        if (shouldSkipStep(step)) {
          next += 1;
          continue;
        }
        return next;
      }
      return next;
    },
    [shouldSkipStep]
  );

  const getPrevStepIndex = useCallback(
    (currentIndex: number): number => {
      let prev = currentIndex - 1;
      while (prev >= 0) {
        const step = PRODUCT_TOUR_STEPS[prev];
        if (shouldSkipStep(step)) {
          prev -= 1;
          continue;
        }
        return prev;
      }
      return prev;
    },
    [shouldSkipStep]
  );

  const getDriver = useCallback(() => {
    if (!driverRef.current) {
      driverRef.current = driver({
        animate: true,
        allowClose: false,
        disableActiveInteraction: false,
        overlayClickBehavior: () => {
          /* Ignore outside clicks — do not close the tour or dismiss modals */
        },
        overlayColor: '#0f172a',
        overlayOpacity: 0.55,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: 'cafy-tour-popover',
      });
    }
    return driverRef.current;
  }, []);

  const showStepHighlight = useCallback(
    (index: number, step: TourStepConfig) => {
      const driverObj = getDriver();
      const isLast = index === PRODUCT_TOUR_STEPS.length - 1;
      const popoverClass = ['cafy-tour-popover', step.popoverClass].filter(Boolean).join(' ');
      const isIreland = isIrelandCareerLocation(user?.preferences?.locations);
      const countedSteps = PRODUCT_TOUR_STEPS.filter(
        (item) => !(item.id === 'part-time-jobs' && isIreland)
      );
      const progressIndex = countedSteps.findIndex((item) => item.id === step.id);
      const sponsorshipDescription =
        step.id === 'sponsorship' && isIreland
          ? 'Search the Irish employment permits register to find employers who have sponsored workers.'
          : step.description;
      const jobsPortalDescription =
        step.id === 'jobs-portal' && isIreland
          ? 'Browse Ireland roles aligned with your onboarding preferences. Search by title, company, or location across the Ireland jobs catalog.'
          : step.id === 'jobs-portal'
            ? step.description
            : null;
      const companiesDescription =
        step.id === 'companies' && isIreland
          ? 'Browse companies hiring in Ireland and open one to see its open roles.'
          : step.id === 'companies'
            ? step.description
            : null;
      const stepDescription =
        step.id === 'sponsorship'
          ? sponsorshipDescription
          : step.id === 'companies'
            ? companiesDescription ?? step.description
            : jobsPortalDescription ?? step.description;

      const driveStep: DriveStep = {
        element: getTourHighlightSelector(step),
        disableActiveInteraction: !step.allowActiveInteraction,
        popover: {
          title: step.title,
          description: stepDescription,
          side:
            step.id === 'tracker-add-form' && isMobileViewport()
              ? 'top'
              : (step.side ?? 'bottom'),
          popoverClass,
          showButtons: ['next', 'previous'],
          disableButtons: step.requireButtonClick ? ['next'] : [],
          showProgress: true,
          progressText: `${progressIndex + 1} of ${countedSteps.length}`,
          doneBtnText: isLast ? 'Get started' : 'Next',
          nextBtnText: 'Next',
          onNextClick: async () => {
            setIsTransitioning(true);

            if (driverObj.isActive()) {
              driverObj.destroy();
            }

            const nextIndex = getNextStepIndex(index);
            if (nextIndex >= PRODUCT_TOUR_STEPS.length) {
              await completeTour();
              return;
            }

            await persistStep(PRODUCT_TOUR_STEPS[nextIndex].id);
            await goToStepRef.current(nextIndex);
          },
          onPrevClick: async () => {
            const prevIndex = getPrevStepIndex(index);
            if (prevIndex < 0) return;
            setIsTransitioning(true);
            if (driverObj.isActive()) {
              driverObj.destroy();
            }
            await persistStep(PRODUCT_TOUR_STEPS[prevIndex].id);
            await goToStepRef.current(prevIndex);
          },
          onPopoverRender: (popover) => {
            const skipBtn = document.createElement('button');
            skipBtn.type = 'button';
            skipBtn.className = 'cafy-tour-skip-btn';
            skipBtn.textContent = 'Skip tour';
            skipBtn.addEventListener('click', () => {
              if (driverObj.isActive()) {
                driverObj.destroy();
              }
              void skipTour();
            });
            popover.wrapper.appendChild(skipBtn);
          },
        },
      };

            if (step.id === 'tracker-add-form' && isMobileViewport()) {
        requestAnimationFrame(() => {
          const submit = document.querySelector('[data-tour="add-job-submit"]');
          if (submit instanceof HTMLElement) {
            submit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        });
      }

      driverObj.highlight(driveStep);
      setIsTransitioning(false);
    },
    [
      completeTour,
      getDriver,
      getNextStepIndex,
      getPrevStepIndex,
      persistStep,
      skipTour,
      user?.preferences?.locations,
    ]
  );

  const goToStep = useCallback(
    async (index: number) => {
      const step = PRODUCT_TOUR_STEPS[index];
      if (!step) return;

      setIsTransitioning(true);

      if (shouldSkipStep(step)) {
        const nextIndex = getNextStepIndex(index);
        if (nextIndex < PRODUCT_TOUR_STEPS.length) {
          await goToStep(nextIndex);
          return;
        }
        await completeTour();
        return;
      }

      currentIndexRef.current = index;
      isRunningRef.current = true;
      sessionStorage.removeItem(TOUR_PENDING_SESSION_KEY);

      try {
        await ensureRouteAndElement(step);
      } catch (err) {
        console.warn('[Tour] Could not find target:', step.id, err);
        setIsTransitioning(false);
        if (INTERACTIVE_TRACKER_STEPS.has(step.id)) {
          window.alert(
            'We could not load this tour step. Please open the Tracker tab and try again, or skip the tour.'
          );
          await skipTour();
          return;
        }
        if (index < PRODUCT_TOUR_STEPS.length - 1) {
          await persistStep(PRODUCT_TOUR_STEPS[index + 1].id);
          await goToStep(index + 1);
        } else {
          await completeTour();
        }
        return;
      }

      await persistStep(step.id);
      showStepHighlight(index, step);
    },
    [
      completeTour,
      ensureRouteAndElement,
      getNextStepIndex,
      persistStep,
      shouldSkipStep,
      showStepHighlight,
      skipTour,
    ]
  );

  goToStepRef.current = goToStep;

  const goToTourStepId = useCallback(
    async (stepId: string) => {
      if (!isRunningRef.current) return;
      const index = PRODUCT_TOUR_STEPS.findIndex((s) => s.id === stepId);
      if (index < 0) return;
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      await goToStep(index);
    },
    [goToStep]
  );

  const hideTourHighlight = useCallback(() => {
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
    }
  }, []);

  const advanceTour = useCallback(
    async (expectedStepId?: string) => {
      if (!isRunningRef.current) return;

      const index = currentIndexRef.current;
      const step = PRODUCT_TOUR_STEPS[index];
      if (!step) return;
      if (expectedStepId && step.id !== expectedStepId) return;

      setIsTransitioning(true);

      try {
        if (step.id === 'tracker-add-form') {
          const dragIndex = PRODUCT_TOUR_STEPS.findIndex((s) => s.id === 'tracker-drag');
          if (dragIndex < 0) return;

          const found = await waitForTourJobCard();
          if (!found) return;

          if (driverRef.current?.isActive()) {
            driverRef.current.destroy();
          }
          await persistStep(PRODUCT_TOUR_STEPS[dragIndex].id);
          await goToStep(dragIndex);
          return;
        }

        if (!step.requireButtonClick) return;

        if (driverRef.current?.isActive()) {
          driverRef.current.destroy();
        }

        const nextIndex = getNextStepIndex(index);
        if (nextIndex >= PRODUCT_TOUR_STEPS.length) {
          await completeTour();
          return;
        }

        await persistStep(PRODUCT_TOUR_STEPS[nextIndex].id);
        currentIndexRef.current = nextIndex;

        if (EXTERNAL_LINK_TOUR_STEPS.has(step.id)) {
          clearPendingExternalStep();
          pendingExternalStepRef.current = nextIndex;
          externalStepTimerRef.current = window.setTimeout(() => {
            externalStepTimerRef.current = null;
            resumePendingExternalStep();
          }, 2500);
          return;
        }

        await goToStep(nextIndex);
      } finally {
        setIsTransitioning(false);
      }
    },
    [
      clearPendingExternalStep,
      completeTour,
      getNextStepIndex,
      goToStep,
      persistStep,
      resumePendingExternalStep,
      waitForTourJobCard,
    ]
  );

  const startTour = useCallback(async () => {
    if (!user || !appReady) return;
    if (isRunningRef.current) return;

    const resumeStepId = user.tour?.currentStepId;
    // Removed Career Path finale — don't trap anyone who was mid-step there.
    if (resumeStepId === 'career-path') {
      await completeTour();
      return;
    }
    const foundIndex = resumeStepId
      ? PRODUCT_TOUR_STEPS.findIndex((s) => s.id === resumeStepId)
      : 0;
    // Unknown / removed step ids (e.g. old `finish`) restart from the beginning.
    const resumeIndex = foundIndex >= 0 ? foundIndex : 0;

    await goToStep(resumeIndex);
  }, [appReady, completeTour, goToStep, user]);

  startTourRef.current = startTour;

  useEffect(() => {
    if (!user || hideSidebar || !appReady) return;

    const pendingFromOnboarding = sessionStorage.getItem(TOUR_PENDING_SESSION_KEY) === '1';
    const canShow =
      pendingFromOnboarding || shouldShowProductTour(user.onboardingCompleted, user.tour?.status);

    if (!canShow) return;
    if (hasAutoStartedRef.current) return;

    const delay = pendingFromOnboarding ? 500 : 1000;

    const timer = window.setTimeout(() => {
      hasAutoStartedRef.current = true;
      startTourRef.current().catch((err) => console.error('[Tour] Failed to start:', err));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [user?.uid, user?.onboardingCompleted, user?.tour?.status, hideSidebar, appReady]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumePendingExternalStep();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [resumePendingExternalStep]);

  useEffect(
    () => () => {
      clearPendingExternalStep();
      clearTourChrome();
    },
    [clearPendingExternalStep, clearTourChrome]
  );

  return (
    <TourContext.Provider value={{ tourUI, advanceTour, goToTourStepId, hideTourHighlight }}>
      {children}
      {isTransitioning && (
        <div className="fixed inset-0 z-[99999] bg-transparent cursor-wait pointer-events-auto" />
      )}
    </TourContext.Provider>
  );
};

export default TourProvider;
