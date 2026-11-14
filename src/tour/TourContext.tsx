import { createContext, useContext } from 'react';

export interface TourUIState {
  currentStepId: string | null;
  isRunning: boolean;
  openAddJobModal: boolean;
  lockAddJobModal: boolean;
  allowKanbanInteraction: boolean;
  trackerViewMode?: 'kanban' | 'table';
}

export const defaultTourUIState: TourUIState = {
  currentStepId: null,
  isRunning: false,
  openAddJobModal: false,
  lockAddJobModal: false,
  allowKanbanInteraction: false,
};

export interface TourContextValue {
  tourUI: TourUIState;
  /** Pass `expectedStepId` so button clicks only advance when that tour step is active. */
  advanceTour: (expectedStepId?: string) => Promise<void>;
  goToTourStepId: (stepId: string) => Promise<void>;
  /** Destroy the highlight overlay but keep the tour running (e.g. while Career Path generates). */
  hideTourHighlight: () => void;
}

const TourContext = createContext<TourContextValue>({
  tourUI: defaultTourUIState,
  advanceTour: async () => {},
  goToTourStepId: async () => {},
  hideTourHighlight: () => {},
});

export const useTourUI = () => useContext(TourContext).tourUI;
export const useTourActions = () => useContext(TourContext);

export default TourContext;
