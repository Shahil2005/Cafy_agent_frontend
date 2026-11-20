import { Check } from "lucide-react";
import { CV_TEMPLATES, cvTemplate, type CvTemplate, type Rgb } from "./cvTemplates";

/** Template choice for the tailored CV. Thumbnails are drawn from each template's own settings. */

const rgb = (c: Rgb, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

function Lines({ count, template }: { count: number; template: CvTemplate }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="block h-[2px] rounded-full" style={{ width: `${[92, 80, 86][i % 3]}%`, background: rgb(template.muted, 0.35) }} />
      ))}
    </>
  );
}

function Heading({ template }: { template: CvTemplate }) {
  const accent = rgb(template.accent);
  const label = <span className="block h-[3px] w-[38%] rounded-full" style={{ background: accent }} />;
  switch (template.heading) {
    case "bar":
      return <span className="flex items-center gap-[3px]"><span className="block h-[5px] w-[2px]" style={{ background: accent }} />{label}</span>;
    case "band":
      return <span className="block rounded-[1px] px-[3px] py-[2px]" style={{ background: rgb(template.accent, 0.14) }}>{label}</span>;
    case "topRule":
      return <span className="block space-y-[2px] border-t pt-[2px]" style={{ borderColor: accent }}>{label}</span>;
    case "plain":
      return label;
    default:
      return <span className="block space-y-[2px] border-b pb-[2px]" style={{ borderColor: accent }}>{label}</span>;
  }
}

function Thumbnail({ template }: { template: CvTemplate }) {
  const centred = template.header === "centered";
  const align = centred ? "mx-auto" : "";
  const dense = template.roleLayout === "inline";
  const header = (
    <>
      <span className={`block h-[4px] w-[55%] rounded-full ${align}`} style={{ background: template.header === "banner" ? "#fff" : rgb(template.ink) }} />
      <span className={`mt-[2px] block h-[2px] w-[40%] rounded-full ${align}`}
        style={{ background: template.header === "banner" ? "rgba(255,255,255,0.75)" : template.headlineAccent ? rgb(template.accent) : rgb(template.muted, 0.6) }} />
      <span className={`mt-[2px] block h-[2px] w-[70%] rounded-full ${align}`} style={{ background: template.header === "banner" ? "rgba(255,255,255,0.55)" : rgb(template.muted, 0.35) }} />
    </>
  );
  return (
    <span className="block h-[92px] w-[68px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {template.header === "banner"
        ? <span className="block px-[6px] py-[5px]" style={{ background: rgb(template.accent) }}>{header}</span>
        : <span className="block px-[6px] pt-[6px]">{header}</span>}
      <span className={`block px-[6px] ${dense ? "space-y-[3px] pt-[3px]" : "space-y-[4px] pt-[5px]"}`}>
        {[3, 3, 2].map((count, i) => (
          <span key={i} className={`block ${dense ? "space-y-[2px]" : "space-y-[3px]"}`}>
            <Heading template={template} />
            <Lines count={count} template={template} />
          </span>
        ))}
      </span>
    </span>
  );
}

export default function CvTemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const current = cvTemplate(value);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold text-slate-800">Template</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Every template is one column of plain text, so applicant tracking systems can read it.</p>
      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1" role="radiogroup" aria-label="CV template">
        {CV_TEMPLATES.map((template) => {
          const active = template.id === current.id;
          return (
            <button key={template.id} type="button" role="radio" aria-checked={active} title={template.description} onClick={() => onChange(template.id)}
              className={`relative flex shrink-0 flex-col items-center gap-1.5 rounded-xl border p-1.5 transition ${active ? "border-cafy-500 bg-cafy-50" : "border-transparent hover:border-slate-200"}`}>
              <Thumbnail template={template} />
              <span className={`text-[11px] ${active ? "font-semibold text-cafy-800" : "text-slate-600"}`}>{template.name}</span>
              {active && <span className="absolute right-1 top-1 rounded-full bg-cafy-600 p-0.5 text-white"><Check size={10} aria-hidden /></span>}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-600">{current.description}</p>
    </div>
  );
}
