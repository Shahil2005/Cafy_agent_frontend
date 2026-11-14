import React from "react";
import { AlertTriangle } from "lucide-react";

interface OfficialDirectoryDisclaimerProps {
    title?: string;
    children: React.ReactNode;
}

const OfficialDirectoryDisclaimer: React.FC<OfficialDirectoryDisclaimerProps> = ({
    title = "Official directory data",
    children,
}) => (
    <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-3 shadow-sm">
        <AlertTriangle className="shrink-0 w-5 h-5 text-blue-600 mt-0.5" />
        <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900">{title}: </span>
            {children}
        </p>
    </div>
);

export default OfficialDirectoryDisclaimer;
