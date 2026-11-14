import React from "react";

interface PageHeaderProps {
  /** Small uppercase kicker above the title (e.g. "LinkedIn", "Career Path"). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Controls rendered on the right of the title row. */
  actions?: React.ReactNode;
  className?: string;
  "data-tour"?: string;
}

/**
 * Plain page header matching the Home tab — uppercase kicker, bold title, muted
 * subtitle, no card or gradient. Keeps every feature tab reading the same way.
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  className = "",
  ...rest
}) => (
  <header
    {...rest}
    className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
  >
    <div className="min-w-0">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cafy-600">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-xl">{subtitle}</p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
    )}
  </header>
);

export default PageHeader;
