import React from "react";

export interface YearCount {
    year: string;
    count: number;
}

export interface RangeCount {
    id: string;
    label: string;
    count: number;
}

interface IrelandFilterSidebarProps {
    yearOptions: YearCount[];
    selectedYears: string[];
    onToggleYear: (year: string) => void;

    rangeOptions: RangeCount[];
    selectedRanges: string[];
    onToggleRange: (rangeId: string) => void;

    /** When true, volume buckets are counted against selected year(s). */
    volumeScopedToYears?: boolean;
}

function CheckRow({
    label,
    count,
    checked,
    onChange,
}: {
    label: string;
    count: number;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <label className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-blue-50/50 cursor-pointer group">
            <span className="flex items-center gap-2.5 min-w-0">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 truncate">{label}</span>
            </span>
            <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600">
                {count.toLocaleString()}
            </span>
        </label>
    );
}

const IrelandFilterSidebar: React.FC<IrelandFilterSidebarProps> = ({
    yearOptions,
    selectedYears,
    onToggleYear,
    rangeOptions,
    selectedRanges,
    onToggleRange,
    volumeScopedToYears = false,
}) => {
    return (
        <div className="space-y-7">
            <section>
                <h3 className="text-sm font-bold text-slate-800 mb-1">Permit volume</h3>
                <p className="text-xs text-slate-500 mb-3">
                    {volumeScopedToYears
                        ? `Counted within selected year${selectedYears.length === 1 ? "" : "s"} (${selectedYears.join(", ")})`
                        : "Counted across all years (2020–2026)"}
                </p>
                <div className="space-y-1">
                    {rangeOptions.map((r) => (
                        <CheckRow
                            key={r.id}
                            label={r.label}
                            count={r.count}
                            checked={selectedRanges.includes(r.id)}
                            onChange={() => onToggleRange(r.id)}
                        />
                    ))}
                </div>
            </section>

            <section>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Year of permits</h3>
                <div className="space-y-1">
                    {yearOptions.map((y) => (
                        <CheckRow
                            key={y.year}
                            label={y.year}
                            count={y.count}
                            checked={selectedYears.includes(y.year)}
                            onChange={() => onToggleYear(y.year)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default IrelandFilterSidebar;
