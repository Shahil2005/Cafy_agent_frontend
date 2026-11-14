import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronRight, Lock } from "lucide-react";
import type { HomeTool, HomeToolGroup } from "./homeToolGroups";

export default function ToolGroupsGrid({
  groups,
  onToolClick,
  badgeFor,
  lockedFor,
  highlightFor,
  compact = false,
}: {
  groups: HomeToolGroup[];
  /** Override default behaviour (navigate / external link). */
  onToolClick?: (tool: HomeTool) => void;
  /** Small pill next to the title, e.g. "Free preview". */
  badgeFor?: (tool: HomeTool) => string | null;
  /** Show a lock icon instead of the chevron. */
  lockedFor?: (tool: HomeTool) => boolean;
  /** Emphasise a tool (tint, accent border, filled icon, "Try now" pill) — public page only. */
  highlightFor?: (tool: HomeTool) => boolean;
  /** Tighter padding so the public page fits one screen. Home keeps the default. */
  compact?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <section aria-label="Tools" className="flex flex-1 flex-col">
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-3">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div
              key={group.title}
              className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className={`border-b border-cafy-100 bg-cafy-50 px-6 ${compact ? "py-3" : "py-4"}`}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GroupIcon size={16} className="text-cafy-600" aria-hidden />
                  {group.title}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">{group.description}</p>
              </div>
              <ul className="flex flex-1 flex-col divide-y divide-slate-100">
                {group.tools.map((tool) => {
                  const Icon = tool.icon;
                  const isExternal = Boolean(tool.href);
                  const locked = lockedFor?.(tool) ?? false;
                  const badge = badgeFor?.(tool) ?? null;
                  const highlighted = highlightFor?.(tool) ?? false;
                  const rowPadding = compact ? "py-3.5" : "py-5";
                  const className = highlighted
                    ? `group flex h-full w-full items-center gap-4 border-l-4 border-cafy-700 bg-cafy-50/60 ${rowPadding} pl-5 pr-6 text-left transition-colors hover:bg-cafy-50 focus-visible:bg-cafy-50 focus-visible:outline-none`
                    : `group flex h-full w-full items-center gap-4 px-6 ${rowPadding} text-left transition-colors hover:bg-cafy-50/50 focus-visible:bg-cafy-50/50 focus-visible:outline-none`;
                  const TrailingIcon = locked ? Lock : isExternal ? ArrowUpRight : ChevronRight;
                  const iconBoxClass = highlighted
                    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cafy-800 bg-cafy-800 text-white"
                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cafy-100 bg-cafy-50 text-cafy-600 transition-colors group-hover:border-cafy-600 group-hover:bg-cafy-600 group-hover:text-white";
                  const body = (
                    <>
                      <span className={iconBoxClass}>
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-slate-900 group-hover:text-cafy-700">
                          {tool.title}
                          {badge ? (
                            <span className="rounded-full bg-cafy-100 px-2 py-0.5 text-[11px] font-semibold text-cafy-800">
                              {badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
                          {tool.blurb}
                        </span>
                      </span>
                      {highlighted ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cafy-800 px-2.5 py-1 text-xs font-semibold text-white group-hover:bg-cafy-900">
                          <span className="hidden sm:inline">Preview</span>
                          <ArrowRight size={14} aria-hidden />
                        </span>
                      ) : (
                        <TrailingIcon
                          size={16}
                          className="shrink-0 text-slate-300 group-hover:text-cafy-600"
                          aria-hidden
                        />
                      )}
                    </>
                  );
                  return (
                    <li key={tool.id} className="flex-1">
                      {onToolClick ? (
                        <button type="button" onClick={() => onToolClick(tool)} className={className}>
                          {body}
                        </button>
                      ) : isExternal ? (
                        <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>
                          {body}
                        </a>
                      ) : (
                        <button type="button" onClick={() => navigate(tool.to!)} className={className}>
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
