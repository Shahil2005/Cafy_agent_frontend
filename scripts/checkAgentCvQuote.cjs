// Checks that a CV quote is found in the CV text even when PDF line breaks differ.
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");
const out = buildSync({ entryPoints: [path.resolve(__dirname, "../src/components/cafy-agent/cvQuote.ts")], bundle: true, write: false, platform: "node", format: "cjs" });
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { findQuote } = mod.exports;
const cv = "EXPERIENCE\nSoftware Intern, Example Ltd\n• Built weekly sales dash-\nboards in Power BI and\nautomated reporting with Python.";
const exact = findQuote(cv, "Software Intern, Example Ltd");
assert.equal(cv.slice(exact[0], exact[1]), "Software Intern, Example Ltd");
const fuzzy = findQuote(cv, "Built weekly sales dashboards in Power BI and automated reporting");
assert.ok(fuzzy && cv.slice(fuzzy[0], fuzzy[1]).includes("Built weekly"), "found across line breaks");
assert.equal(findQuote(cv, "Managed a team of forty engineers"), null);
console.log("agent CV quote finder: all checks passed");
