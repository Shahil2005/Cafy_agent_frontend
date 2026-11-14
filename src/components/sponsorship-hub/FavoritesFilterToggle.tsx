import React from "react";
import { Heart } from "lucide-react";

interface FavoritesFilterToggleProps {
    checked: boolean;
    count: number;
    onChange: (checked: boolean) => void;
    syncHint?: string;
}

const FavoritesFilterToggle: React.FC<FavoritesFilterToggleProps> = ({
    checked,
    count,
    onChange,
    syncHint = "Saved on this device only.",
}) => (
    <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Saved</h3>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                checked
                    ? "border-blue-200 bg-white shadow-sm"
                    : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white"
            }`}
        >
            <span className="flex items-center gap-2.5 min-w-0">
                <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        checked
                            ? "border-blue-100 bg-blue-50 text-blue-600"
                            : "border-slate-200 bg-white text-slate-400"
                    }`}
                >
                    <Heart size={15} className={checked ? "fill-current" : ""} />
                </span>
                <span className="text-sm font-medium text-slate-700">Favourites only</span>
            </span>
            <span
                className={`text-xs font-semibold tabular-nums shrink-0 ${
                    checked ? "text-blue-600" : "text-slate-400"
                }`}
            >
                {count}
            </span>
        </button>
        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
            {syncHint}
        </p>
    </div>
);

export default FavoritesFilterToggle;
