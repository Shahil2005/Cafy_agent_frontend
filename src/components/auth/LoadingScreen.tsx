import { Loader2 } from "lucide-react";

const LoadingScreen = ({ message = "Preparing your dashboard..." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none"></div>

    <div className="relative z-10 flex flex-col items-center gap-4">
      <img
        src="/CAFY-Icon.svg"
        alt="Cafy Logo"
        className="w-24 h-24 object-contain mb-2"
      />
      <div className="p-4 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
      <div className="flex flex-col items-center">
        <div className="text-xl font-bold text-slate-900 tracking-tight">Cafy</div>
        <div className="text-sm font-medium text-slate-500 mt-1">{message}</div>
      </div>
    </div>
  </div>
);

export default LoadingScreen;
