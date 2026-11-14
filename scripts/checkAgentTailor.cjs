// Checks the CV tailoring helpers: contact details read from the CV in the browser, PDF-safe text and the PDF itself.
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");

function load(file) {
  const out = buildSync({ entryPoints: [path.resolve(__dirname, file)], bundle: true, write: false, platform: "node", format: "cjs", logLevel: "error" });
  const mod = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}

const { extractContactDetails } = load("../src/components/cafy-agent/tailor/contactDetails.ts");
const { pdfSafe, buildTailoredCvPdf, tailoredCvFileName } = load("../src/components/cafy-agent/tailor/tailoredCvPdf.ts");

// Contact details
const cv = "Priya Shah\npriya.shah@example.com | +44 7700 900123 | Leeds, UK | linkedin.com/in/priyashah | github.com/priya\n\nPROFILE\nOperations analyst. Call 2019 - 2021.";
const c = extractContactDetails(cv);
assert.equal(c.name, "Priya Shah");
assert.equal(c.email, "priya.shah@example.com");
assert.equal(c.phone, "+44 7700 900123");
assert.equal(c.location, "Leeds, UK");
assert.equal(c.linkedin, "linkedin.com/in/priyashah");
assert.equal(c.website, "github.com/priya");

const headed = extractContactDetails("CURRICULUM VITAE\n\nJOHN O'NEILL\nManchester M1 2AB · 07700 900456 · john@mail.co.uk");
assert.equal(headed.name, "John O'Neill");
assert.equal(headed.phone, "07700 900456");
assert.equal(headed.email, "john@mail.co.uk");
assert.equal(headed.location, "Manchester M1 2AB");

const none = extractContactDetails("EXPERIENCE\nAnalyst at Acme 2019 - 2021");
assert.equal(none.name, "");
assert.equal(none.phone, "", "date ranges are not phone numbers");

// PDF-safe text: typographic punctuation becomes plain, Latin-1 stays, anything else is dropped.
assert.equal(pdfSafe("Lead – “Lean” work’s … £30k café →"), 'Lead - "Lean" work\'s ... £30k café');

// The PDF
const tailored = {
  headline: "Continuous Improvement Analyst | Lean Six Sigma Green Belt",
  summary: "Operations analyst who runs Lean and Kaizen work.",
  skills: [{ group: "Improvement", items: ["Lean", "Kaizen"] }],
  experience: Array.from({ length: 12 }, (_, i) => ({
    title: "Operations Analyst", employer: `Acme ${i}`, location: "Leeds", dates: "2021 – Present",
    bullets: ["Ran weekly Kaizen workshops for 12 warehouse staff, cutting waste across three sites and improving the pick rate.", "Built Excel dashboards that cut reporting time by 30%."],
  })),
  education: [{ qualification: "BSc Business Management", institution: "University of Leeds", dates: "2016 - 2019" }],
  projects: [], certifications: ["Lean Six Sigma Green Belt"], extras: [{ heading: "Languages", items: ["English", "Gujarati"] }],
};
const doc = buildTailoredCvPdf(tailored, c);
const raw = doc.output();
assert.ok(raw.startsWith("%PDF-"));
assert.ok(raw.includes("(Priya Shah)"), "name written as real text, so ATS can read it");
assert.ok(raw.includes("Continuous Improvement Analyst"));
assert.ok(raw.includes("2021 - Present"));
assert.ok(doc.getNumberOfPages() >= 2, "long CVs flow onto more pages");
assert.equal(tailoredCvFileName("Priya Shah", "CI Analyst / Lead"), "Priya Shah CV - CI Analyst Lead.pdf");
assert.equal(tailoredCvFileName("", ""), "Tailored CV.pdf");

console.log("agent CV tailoring helpers: all checks passed");
