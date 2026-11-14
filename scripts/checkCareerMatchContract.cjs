const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, `../src/services/${name}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.require = (specifier) => {
    if (specifier === "./jobChatContract") return load("jobChatContract");
    if (specifier === "./careerMatchContract") return load("careerMatchContract");
    if (specifier === "./careerResumeSafety") return load("careerResumeSafety");
    if (specifier === "../data/jobPortalConstants") return load("../data/jobPortalConstants");
    if (specifier === "./firebase") return { auth: { currentUser: null } };
    if (specifier === "./apiConfig") return { getBackendUrl: () => { throw new Error("Network configuration must not be read in pure tests"); } };
    if (specifier === "./storage") return { getResumeSignedUrl: () => { throw new Error("Storage must not be called in pure tests"); } };
    throw new Error(`Unexpected import in pure contract test: ${specifier}`);
  };
  loaded._compile(compiled, filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}
const { normalizeCareerMatchResponse, normalizeCareerPreferredLevels } = load("careerMatchContract");
const { isOwnedCareerResume, careerMatchErrorMessage } = load("careerMatchService");
const { validateCareerDocxArchive } = load("careerResumeSafety");
const base = () => ({
  state: "results",
  contextCursor: `c1.fictional-${"x".repeat(48)}`,
  profile: { skills: [{ name: "Python", evidence: "Built projects in Python" }], roles: [] },
  search: { role: "software", where: "", kind: "career" },
  jobs: [{
    job: { id: "example-1", title: "Software Developer", location: "London", url: "https://example.org/jobs/1", description: "Build applications in Python. Write tests and collaborate with the engineering team." },
    reasons: ["Python appears in your CV and the advert."], matchedSkills: ["Python"],
    evidence: [{ skill: "Python", resumeEvidence: "Built projects in Python", jobEvidence: "Build applications in Python." }],
    requirementsToCheck: ["Check experience requirements in the full advert."],
  }],
  pageId: "page-example-1", batchSize: 5, hasMore: false,
  coverage: { catalogueScanned: 100, candidates: 12, limitReached: true, sourceFailures: 0 },
  message: "One supported match found. No extra jobs have been added to fill five places.",
});
test("accepts fewer than five with evidence and does not invent role titles for a first CV", () => {
  const result = normalizeCareerMatchResponse(base());
  assert.equal(result.jobs.length, 1); assert.deepEqual(result.profile.roles, []);
  assert.equal(result.search.employerScope, "any");
});
test("accepts a completed empty batch with honest coverage", () => {
  assert.equal(normalizeCareerMatchResponse({ ...base(), state: "no-matches", jobs: [] }).jobs.length, 0);
});
test("rejects more than five rather than silently slicing a malformed page", () => {
  assert.equal(normalizeCareerMatchResponse({ ...base(), jobs: Array(6).fill(base().jobs[0]) }), null);
});
test("rejects duplicate identities and duplicate advert URLs", () => {
  const first = base().jobs[0];
  for (const job of [{ ...first.job, url: "https://example.org/jobs/2" }, { ...first.job, id: "example-2" }]) {
    assert.equal(normalizeCareerMatchResponse({ ...base(), jobs: [first, { ...first, job }] }), null);
  }
});
test("requires a cursor exactly when another batch is available", () => {
  assert.ok(normalizeCareerMatchResponse({ ...base(), hasMore: true, nextCursor: "encrypted.cursor" }));
  for (const patch of [{ hasMore: true }, { nextCursor: "cursor" }, { hasMore: true, nextCursor: "bad cursor" }, { hasMore: true, nextCursor: "x".repeat(120001) }]) {
    assert.equal(normalizeCareerMatchResponse({ ...base(), ...patch }), null);
  }
});
test("rejects unsafe links and incomplete native source metadata", () => {
  for (const patch of [{ url: "javascript:alert(1)" }, { url: "https://user:pass@example.org/job" }, { listingSource: { kind: "web" } }]) {
    const result = base(); result.jobs[0].job = { ...result.jobs[0].job, ...patch };
    assert.equal(normalizeCareerMatchResponse(result), null);
  }
});
test("native employer-site adverts retain their source evidence while Google discoveries stay separate", () => {
  const result = base();
  result.jobs[0].job.listingSource = { kind: "web", provider: "employer-sites", publisher: "Example employer", retrievedAt: new Date(Date.now() - 1000).toISOString(), availability: "source-listed", employerLicence: "unknown" };
  result.coverage.web = { examined: 10, candidates: 1, sourcesChecked: 1, sourcesFailed: 0, sourcesAvailable: 2, limitReached: true };
  assert.equal(normalizeCareerMatchResponse(result).jobs[0].job.listingSource.publisher, "Example employer");
  result.jobs[0].job.listingSource.provider = "jsearch";
  assert.equal(normalizeCareerMatchResponse(result), null);
});
test("the full CV review has bounded literal facts and clearly separate supported search directions", () => {
  const profile = { ...base().profile, summary: "Your CV lists a Python project and a computer science degree.", experiences: [{ label: "Support Assistant", evidence: "Support Assistant: answered customer questions." }], projects: [{ label: "Budget Dashboard", evidence: "Budget Dashboard: built projects in Python." }], education: [{ label: "BSc Computer Science", evidence: "BSc Computer Science, Example University." }], certifications: [], searchDirections: [{ title: "Data Analyst", evidence: ["Budget Dashboard: built projects in Python."], skills: ["Python"] }] };
  assert.equal(normalizeCareerMatchResponse({ ...base(), profile }).profile.summary, profile.summary);
  for (const patch of [{ summary: "x".repeat(1401) }, { education: Array(3).fill(profile.education[0]) }, { experiences: [{ label: "Invented manager role", evidence: "Support Assistant: answered customer questions." }] }, { searchDirections: [{ title: "Data Analyst", evidence: [], skills: ["Python"] }] }, { searchDirections: [{ title: "Data Analyst", evidence: ["A quote"], skills: ["Invented tool"] }] }]) assert.equal(normalizeCareerMatchResponse({ ...base(), profile: { ...profile, ...patch } }), null);
});
test("rejects untyped evidence, unsupported criteria and malformed coverage", () => {
  for (const patch of [{ coverage: { ...base().coverage, candidates: -1 } }, { search: { ...base().search, sponsorship: "guaranteed" } }, { profile: { skills: [{ name: "Python", evidence: false }], roles: [] } }]) {
    assert.equal(normalizeCareerMatchResponse({ ...base(), ...patch }), null);
  }
  const result = base(); result.jobs[0].evidence[0].jobEvidence = false;
  assert.equal(normalizeCareerMatchResponse(result), null);
});
test("listed skills and evidence must be supported and literal; a same-occupation advert may list none", () => {
  const titleOnly = base(); titleOnly.jobs[0] = { ...titleOnly.jobs[0], matchedSkills: [], evidence: [] };
  assert.equal(normalizeCareerMatchResponse(titleOnly).jobs[0].matchedSkills.length, 0);
  for (const patch of [{ matchedSkills: [] }, { matchedSkills: ["Unmentioned tool"] }, { evidence: [{ skill: "Python", resumeEvidence: "Invented CV evidence", jobEvidence: "Build applications in Python." }] }, { evidence: [{ skill: "Python", resumeEvidence: "Built projects in Python", jobEvidence: "Invented advert Python requirement" }] }]) {
    const result = base(); result.jobs[0] = { ...result.jobs[0], ...patch };
    assert.equal(normalizeCareerMatchResponse(result), null);
  }
});
test("profile labels must appear in their own bounded evidence excerpts", () => {
  assert.equal(normalizeCareerMatchResponse({ ...base(), profile: { skills: [{ name: "Python", evidence: "Only SQL is mentioned" }], roles: [] } }), null);
  assert.equal(normalizeCareerMatchResponse({ ...base(), profile: { ...base().profile, roles: [{ title: "Software Developer", evidence: "Some university project" }] } }), null);
});
const owned = (content) => ({ id: "example-cv", name: "CV", uploadedAt: new Date(0), content });
test("only reads a PDF or DOCX in the authenticated owner's storage folder", () => {
  assert.equal(isOwnedCareerResume(owned("supabase:ProductResumes/owner/cv.pdf"), "owner"), true);
  assert.equal(isOwnedCareerResume(owned("supabase:ProductResumes/owner/cv.docx"), "owner"), true);
  for (const ref of ["https://example.org/cv.pdf", "supabase:ProductResumes/someone-else/cv.pdf", "supabase:ProductResumes/owner/../cv.pdf", "supabase:ProductResumes/owner/%2e%2e/cv.pdf", "supabase:ProductResumes/owner/folder/cv.pdf", "supabase:ProductResumes/owner/cv.pdf?x=1", "supabase:ProductResumes/owner/cv.doc", "supabase:ProductResumes/owner/cv\\.pdf"]) {
    assert.equal(isOwnedCareerResume(owned(ref), "owner"), false);
  }
});
test("rejects invalid or oversized stored CV metadata before requesting its signed URL", () => {
  for (const size of [0, -1, 2 * 1024 * 1024 + 1, NaN, Infinity]) {
    assert.equal(isOwnedCareerResume({ ...owned("supabase:ProductResumes/owner/cv.pdf"), size }, "owner"), false);
  }
});
function docxMetadata(entries) {
  const parts = entries.map(({ name, bytes, flags = 0 }) => {
    const encoded = Buffer.from(name); const part = Buffer.alloc(46 + encoded.length);
    part.writeUInt32LE(0x02014b50, 0); part.writeUInt16LE(flags, 8); part.writeUInt16LE(8, 10);
    part.writeUInt32LE(bytes, 24); part.writeUInt16LE(encoded.length, 28); encoded.copy(part, 46); return part;
  });
  const directory = Buffer.concat(parts), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12);
  const joined = Buffer.concat([directory, end]);
  return joined.buffer.slice(joined.byteOffset, joined.byteOffset + joined.byteLength);
}
test("DOCX declared expansion and entry limits are checked before decompression", () => {
  const normal = [{ name: "[Content_Types].xml", bytes: 100 }, { name: "word/document.xml", bytes: 1000 }];
  assert.doesNotThrow(() => validateCareerDocxArchive(docxMetadata(normal)));
  for (const entries of [normal.slice(0, 1), [...normal, { name: "../payload.xml", bytes: 2 }], [normal[0], { name: "word/document.xml", bytes: 5 * 1024 * 1024 }], [normal[0], { ...normal[1], flags: 1 }], [...normal, ...Array.from({ length: 199 }, (_, index) => ({ name: `x${index}.xml`, bytes: 10 }))], [...normal, { name: "a.xml", bytes: 8 * 1024 * 1024 }, { name: "b.xml", bytes: 8 * 1024 * 1024 }]]) {
    assert.throws(() => validateCareerDocxArchive(docxMetadata(entries)), /could not be read safely/);
  }
});
test("typed failure categories distinguish catalogue, CV analysis and expired session failures", () => {
  assert.match(careerMatchErrorMessage(503, { error: "CATALOGUE_UNAVAILABLE" }), /job catalogue/);
  assert.match(careerMatchErrorMessage(503, { error: "PROFILE_UNAVAILABLE" }), /analyse your CV/);
  assert.match(careerMatchErrorMessage(409, { error: "SHORTLIST_EXPIRED" }), /expired or changed/);
  assert.match(careerMatchErrorMessage(400, { error: "COUNTRY_CONFLICT" }), /catalogue selected for your profile/);
  assert.match(careerMatchErrorMessage(503, { error: "NOT_CONFIGURED" }), /not available in this CAFY environment/);
});
test("unknown errors and arbitrary server messages never expose private provider details", () => {
  const secret = "private-token https://private.internal/provider";
  for (const body of [{ error: secret, message: secret }, { error: "PROFILE_UNAVAILABLE", message: secret }, { error: "toString", message: secret }, { error: { message: secret } }, null, secret]) {
    const displayed = careerMatchErrorMessage(503, body);
    assert.equal(displayed.includes("private-token"), false);
    assert.equal(displayed.includes("private.internal"), false);
    assert.equal(typeof displayed, "string");
  }
});
test("saved target levels use the canonical allowlist without inferring junior or senior status", () => {
  assert.deepEqual(normalizeCareerPreferredLevels(["Junior", "Entry Level", "Junior", " Senior ", "Student", "CEO"]), ["Entry Level", "Junior", "Senior"]);
  for (const unset of [undefined, null, [], "Junior", ["student"], ["unknown", false, 4]]) assert.deepEqual(normalizeCareerPreferredLevels(unset), []);
});
test("an explicit experience-level constraint survives the matching response contract", () => {
  const response = base(); response.jobs[0].job.level = "Junior";
  const result = normalizeCareerMatchResponse({ ...response, search: { ...base().search, levels: ["Entry Level", "Junior"] } });
  assert.deepEqual(result.search.levels, ["Entry Level", "Junior"]);
  assert.deepEqual(normalizeCareerMatchResponse(base()).search.levels, []);
  for (const level of ["Senior", undefined, "unknown"]) {
    response.jobs[0].job.level = level;
    assert.equal(normalizeCareerMatchResponse({ ...response, search: { ...base().search, levels: ["Entry Level", "Junior"] } }), null);
  }
});
test("a verified skills-only CV asks for a role without pretending to search or exhaust results", () => {
  const clarification = { ...base(), state: "needs-role", search: { ...base().search, role: "" }, jobs: [], coverage: { catalogueScanned: 0, candidates: 0, limitReached: false, sourceFailures: 0 }, message: "What role would you like me to look for?" };
  assert.ok(normalizeCareerMatchResponse(clarification));
  for (const patch of [{ contextCursor: undefined }, { contextCursor: "short" }, { coverage: base().coverage }, { search: base().search }, { hasMore: true, nextCursor: "next" }]) assert.equal(normalizeCareerMatchResponse({ ...clarification, ...patch }), null);
});
test("empty conversational states preserve authenticated context and distinguish outage from real no matches", () => {
  const unavailable = { ...base(), state: "unavailable", jobs: [], coverage: { catalogueScanned: 0, candidates: 0, limitReached: true, sourceFailures: 1 } };
  assert.ok(normalizeCareerMatchResponse(unavailable));
  assert.equal(normalizeCareerMatchResponse({ ...unavailable, coverage: { ...unavailable.coverage, sourceFailures: 0 } }), null);
  assert.equal(normalizeCareerMatchResponse({ ...base(), jobs: [] }), null);
  assert.ok(normalizeCareerMatchResponse({ ...base(), state: "needs-clarification", jobs: [] }));
});
test("only an empty clarification can dispatch an explicit server-owned advice action", () => {
  assert.ok(normalizeCareerMatchResponse({ ...base(), state: "needs-clarification", jobs: [], conversationAction: "advice" }));
  assert.equal(normalizeCareerMatchResponse({ ...base(), conversationAction: "advice" }), null);
  assert.equal(normalizeCareerMatchResponse({ ...base(), state: "needs-clarification", jobs: [], conversationAction: "anything" }), null);
});
const googleBase = () => {
  const card = {
    title: "Software Developer", employer: "Fictional web employer", location: "London", salary: null,
    employmentType: null, workingArrangement: null, description: "Builds Python services for an internal team.",
    closingDate: null, postedDate: null, url: "https://example.com/web/fictional-role",
    explanation: "The advert names the requested role and location. Confirm availability.", sourceIndexes: [0],
  };
  return {
    format: "job-cards", cards: [card], text: JSON.stringify({ cards: [{ sourceId: 0 }] }),
    sources: [{ url: card.url, title: "Fictional web advert" }], citations: [],
    retrievedUrls: [card.url], cardSourceUrls: [card.url],
    searchResearch: { text: "A fictional employer lists this role.", sources: [{ url: card.url, title: "Fictional search source" }],
      citations: [{ startIndex: 0, endIndex: 37, sourceIndexes: [0] }] },
    searchQueries: ["software developer jobs London"],
    searchSuggestions: [{ label: "software developer jobs London", url: "https://www.google.com/search?q=software+developer+jobs+London" }],
    retrievedAt: new Date(Date.now() - 60_000).toISOString(),
  };
};
test("validated Google adverts travel beside CV matches without entering them", () => {
  const result = normalizeCareerMatchResponse({ ...base(), groundedWeb: googleBase(), groundedWebStatus: "searched" });
  assert.equal(result.groundedWebStatus, "searched"); assert.equal(result.groundedWeb.cards.length, 1);
  assert.equal(result.jobs.length, 1);
  assert.ok(result.jobs.every(({ job }) => job.url !== googleBase().cards[0].url));
  assert.equal(normalizeCareerMatchResponse({ ...base(), state: "no-matches", jobs: [], groundedWeb: googleBase(), groundedWebStatus: "searched" }).groundedWeb.cards.length, 1);
  for (const status of ["skipped", "unavailable"]) {
    const empty = normalizeCareerMatchResponse({ ...base(), groundedWebStatus: status });
    assert.equal(empty.groundedWebStatus, status); assert.equal(empty.groundedWeb, undefined);
  }
});
test("a malformed or mislabelled Google panel is dropped while the CV matches stay", () => {
  const unsafe = googleBase(); unsafe.cards[0].url = "javascript:alert(1)";
  const research = googleBase(); delete research.format; delete research.cards;
  for (const extra of [
    { groundedWeb: unsafe, groundedWebStatus: "searched" },
    { groundedWeb: research, groundedWebStatus: "searched" },
    { groundedWeb: googleBase(), groundedWebStatus: "skipped" },
    { groundedWeb: googleBase() },
    { groundedWebStatus: "searched" },
    { groundedWebStatus: "premium_required" },
  ]) {
    const result = normalizeCareerMatchResponse({ ...base(), ...extra });
    assert.equal(result.jobs.length, 1); assert.equal(result.groundedWebStatus, "unavailable");
    assert.equal(result.groundedWeb, undefined);
  }
  assert.equal("groundedWebStatus" in normalizeCareerMatchResponse(base()), false);
});
const fitBase = () => ({ score: 67, band: "good", highlight: "Your Python projects suit the development work here." });
const withFit = (fit, extra = {}) => { const value = base(); value.jobs[0].fit = fit; return { ...value, fitStatus: "scored", ...extra }; };
test("a fit score is accepted only when its score and band agree", () => {
  const result = normalizeCareerMatchResponse(withFit(fitBase()));
  assert.equal(result.fitStatus, "scored"); assert.deepEqual(result.jobs[0].fit, fitBase());
  assert.equal(normalizeCareerMatchResponse(withFit({ score: 47, band: "fair" })).jobs[0].fit.band, "fair");
  for (const fit of [{ ...fitBase(), score: 95 }, { ...fitBase(), band: "strong" }, { ...fitBase(), score: 67.5 },
    { ...fitBase(), score: 101, band: "strong" }, { ...fitBase(), band: "stretch" }, "82"]) {
    const dropped = normalizeCareerMatchResponse(withFit(fit));
    // An unverifiable score is removed; the evidence-backed job itself stays.
    assert.equal(dropped.jobs.length, 1); assert.equal(dropped.jobs[0].fit, undefined);
  }
});
test("a highlight is shown only when it is short, positive and names something in the CV", () => {
  for (const highlight of [
    "Your Python projects suit the role, but you have no SQL.",
    "You do not have the Java this team needs.",
    "Your teamwork suits the development work here.",
    "Your Python <b>projects</b> suit this.",
    "Your Python projects: see https://example.org",
    "Python.",
    `Your Python projects ${"suit this role well ".repeat(10)}`,
  ]) {
    const fit = normalizeCareerMatchResponse(withFit({ ...fitBase(), highlight })).jobs[0].fit;
    assert.deepEqual(fit, { score: 67, band: "good" }, highlight);
  }
});
test("fit status is optional, enumerated and only reported beside jobs", () => {
  assert.equal("fitStatus" in normalizeCareerMatchResponse(base()), false);
  assert.equal(normalizeCareerMatchResponse({ ...base(), fitStatus: "unavailable" }).fitStatus, "unavailable");
  assert.equal("fitStatus" in normalizeCareerMatchResponse({ ...base(), fitStatus: "excellent" }), false);
  assert.equal("fitStatus" in normalizeCareerMatchResponse({ ...base(), state: "no-matches", jobs: [], fitStatus: "scored" }), false);
});
