import { Fragment, type ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import type { JobChatGroundedWeb, JobChatGroundedWebStatus } from "../../services/jobChatContract";
import { calendarLabel, sourceDate } from "./sourceDates";

function groundedTextFragments(
  data: Pick<JobChatGroundedWeb, "text" | "sources" | "citations">,
): ReactNode[] {
  const fragments: ReactNode[] = [];
  {
    const endpoints = new Map<number, Set<number>>();
    for (const citation of data.citations) {
      const indexes = endpoints.get(citation.endIndex) || new Set<number>();
      citation.sourceIndexes.forEach((index) => indexes.add(index));
      endpoints.set(citation.endIndex, indexes);
    }
    let cursor = 0;
    for (const [end, indexes] of [...endpoints].sort(
      ([left], [right]) => left - right,
    )) {
      fragments.push(
        <Fragment key={end}>
          {data.text.slice(cursor, end)}
          <sup className="ml-0.5 inline-flex gap-0.5">
            {[...indexes].map((index) => (
              <a
                key={index}
                href={data.sources[index].url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                aria-label={`Source ${index + 1}: ${data.sources[index].title}`}
                className="ph-no-capture font-medium text-cafy-700 underline"
              >
                [{index + 1}]
              </a>
            ))}
          </sup>
        </Fragment>,
      );
      cursor = end;
    }
    fragments.push(
      <Fragment key="remaining">{data.text.slice(cursor)}</Fragment>,
    );
  }
  return fragments;
}

/** Attributed, display-only Google results. No save, tracker, CV or resume actions belong here. */
export default function GroundedSearchPanel({
  data,
  status,
}: {
  data?: JobChatGroundedWeb;
  status: JobChatGroundedWebStatus;
}) {
  if (status === "not_requested") return null;
  const statuses = {
    unavailable:
      "Google couldn’t return supported job adverts for this request. Your filters are saved; you can retry.",
    skipped:
      "Google Search was not run for this request. Review the search guidance and try again.",
    premium_required: "Google Search requires a paid job-search plan.",
  };
  const fragments = data && status === "searched"
    ? groundedTextFragments(data)
    : [];
  return (
    <section
      data-google-grounded="true"
      data-ph-no-capture="true"
      data-sentry-block="true"
      className="ph-no-capture ph-sensitive sentry-block mt-4 rounded-xl border border-cafy-200 bg-white p-4"
      aria-label="Google Search results"
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {data?.format === "job-cards" ? "Web discoveries" : "Google Search"}
      </h3>
      {data && status === "searched" ? (
        <>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            {data.format === "job-cards"
              ? "Found with Google Search"
              : "Web research with sources"}{" "}
            · {sourceDate(data.retrievedAt, true)}.{" "}
            {data.retrievedUrls?.length
              ? "Advert details retrieved by Google. Confirm current availability."
              : "Confirm current availability on the original advert."}
          </p>
          {data.format === "job-cards" ? (
            <>
              {data.cards?.length === 0 && (
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  No individual adverts could be supported for these filters.
                  Your search criteria are unchanged.
                </p>
              )}
              <div className="mt-4 space-y-3">
                {data.cards?.map((card, index) => (
                  <section
                    key={index}
                    aria-label={`Web discovery: ${card.title}`}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <p className="break-words text-xs text-slate-500">
                      {card.employer}
                    </p>
                    <h4 className="mt-1 break-words text-base font-semibold leading-snug text-slate-900">
                      {card.title}
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} className="shrink-0" />
                        {card.location}
                      </span>
                      {card.employmentType && (
                        <span>{card.employmentType}</span>
                      )}
                      {card.workingArrangement && (
                        <span>{card.workingArrangement}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {card.salary ?? "Salary not stated"}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {card.closingDate ? (
                        <>
                          Closes{" "}
                          <time dateTime={card.closingDate}>
                            {calendarLabel(card.closingDate)}
                          </time>
                        </>
                      ) : (
                        "Closing date not supplied"
                      )}
                      {card.postedDate && (
                        <>
                          {" "}
                          · Posted{" "}
                          <time dateTime={card.postedDate}>
                            {calendarLabel(card.postedDate)}
                          </time>
                        </>
                      )}
                    </p>
                    <details className="mt-3 rounded-lg bg-white p-3 text-xs leading-6 text-slate-600">
                      <summary className="cursor-pointer font-medium text-slate-700">
                        Why shown
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap break-words">
                        {card.explanation}
                      </p>
                    </details>
                    <details className="mt-3 text-xs leading-6 text-slate-600">
                      <summary className="cursor-pointer font-medium">
                        Advert summary
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap break-words">
                        {card.description}
                      </p>
                    </details>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="ph-no-capture inline-flex items-center gap-1.5 rounded-lg bg-cafy-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-cafy-700"
                      >
                        {card.url.startsWith(
                          "https://vertexaisearch.cloud.google.com/grounding-api-redirect/",
                        )
                          ? "Read advert via Google"
                          : "Read advert"}
                        <ExternalLink size={13} />
                      </a>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        Sources{" "}
                        {card.sourceIndexes.map((sourceIndex) => (
                          <a
                            key={sourceIndex}
                            href={data.sources[sourceIndex].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            aria-label={`Source ${sourceIndex + 1}: ${data.sources[sourceIndex].title}`}
                            className="ph-no-capture text-cafy-700 underline"
                          >
                            [{sourceIndex + 1}]
                          </a>
                        ))}
                      </span>
                    </div>
                  </section>
                ))}
              </div>
              {data.searchResearch && (
                <details className="mt-4 text-[11px] leading-6 text-slate-500">
                  <summary className="cursor-pointer font-medium">
                    Original Google Search research
                  </summary>
                  <div
                    data-grounded-research="true"
                    className="mt-2 whitespace-pre-wrap break-words"
                  >
                    {groundedTextFragments(data.searchResearch)}
                  </div>
                </details>
              )}
              <details className="mt-4 text-[11px] leading-6 text-slate-500">
                <summary className="cursor-pointer font-medium">
                  {data.searchResearch
                    ? "Original advert details"
                    : "Original Google response and citations"}
                </summary>
                <div
                  data-grounded-text="true"
                  className="mt-2 whitespace-pre-wrap break-words"
                >
                  {fragments}
                </div>
              </details>
            </>
          ) : (
            <div
              data-grounded-text="true"
              className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700"
            >
              {fragments}
            </div>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-[11px] font-medium text-slate-700">
              Search on Google
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.searchSuggestions.slice(0, 5).map((suggestion, index) => (
                <a
                  key={index}
                  href={suggestion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="ph-no-capture max-w-full break-words rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-cafy-700 hover:bg-cafy-50"
                >
                  {suggestion.label}
                </a>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {status === "searched" ? statuses.unavailable : statuses[status]}
        </p>
      )}
    </section>
  );
}
