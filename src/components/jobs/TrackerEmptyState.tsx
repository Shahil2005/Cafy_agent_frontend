import React from "react";
import TrackerExtensionGuide from "./TrackerExtensionGuide";

interface TrackerEmptyStateProps {
  onAddJobClick?: () => void;
}

const TrackerEmptyState: React.FC<TrackerEmptyStateProps> = ({
  onAddJobClick,
}) => {
  return (
    <div className="w-full flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center p-10 sm:p-12 bg-white rounded-2xl shadow-sm border border-dashed border-slate-200 animate-in fade-in">
        <TrackerExtensionGuide variant="empty" onAddJobClick={onAddJobClick} />
      </div>
    </div>
  );
};

export default TrackerEmptyState;
