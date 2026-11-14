import React from "react";

interface MarketingFeatureShellProps {
  children: React.ReactNode;
  className?: string;
}

const MarketingFeatureShell: React.FC<MarketingFeatureShellProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className="h-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-4 xl:py-6">
      <div className="relative min-h-[min(100%,32rem)] h-full bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 rounded-3xl overflow-hidden shadow-xl p-6 lg:p-6 xl:p-8">
        <div className="absolute top-10 right-20 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-20 right-40 w-40 h-40 bg-purple-200 rounded-full blur-3xl opacity-30 pointer-events-none" />
        <div className="absolute top-1/2 right-10 w-24 h-24 bg-pink-200 rounded-full blur-2xl opacity-30 pointer-events-none" />

        <div className={`relative z-10 h-full min-w-0 max-w-full overflow-x-hidden ${className}`}>{children}</div>
      </div>
    </div>
  );
};

export default MarketingFeatureShell;
