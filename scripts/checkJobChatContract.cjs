const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

// This pure module has type-only imports. No Firebase, environment or network access.
const filename = path.resolve(__dirname, "../src/services/jobChatContract.ts");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const {
  normalizeJobChatSearch,
  normalizeJobChatResponse,
  normalizeGroundedWeb,
  catalogueChatResponse,
  normalizeCareerGuidance,
} = loaded.exports;
const base = () => ({
  message: "Found a catalogue job.",
  search: { role: "data analyst", where: "London", kind: "career" },
  jobs: [
    {
      id: "1",
      title: "Data Analyst",
      url: "https://example.com/job",
      location: "London",
    },
  ],
  totalCount: 1,
  suggestions: ["Any location"],
  interpretation: "rules",
});

test("older persisted search results receive safe richer-criteria defaults", () => {
  const result = normalizeJobChatResponse(base());
  assert.equal(result.search.employer, "");
  assert.deepEqual(result.search.jobTypes, []);
  assert.equal(result.search.workingArrangement, "any");
  assert.equal(result.search.sponsorship, "any");
  assert.equal(result.catalogueStatus, "searched");
});

test("catalogue failures are retained independently from valid source cards and malformed status is rejected", () => {
  for (const catalogueStatus of ["searched", "unavailable", "skipped"]) {
    const response = normalizeJobChatResponse({ ...base(), catalogueStatus });
    assert.equal(response.catalogueStatus, catalogueStatus);
    assert.equal(
      catalogueChatResponse(response).catalogueStatus,
      catalogueStatus,
    );
  }
  for (const catalogueStatus of [null, false, "healthy", ["searched"]])
    assert.equal(
      normalizeJobChatResponse({ ...base(), catalogueStatus }),
      null,
    );
});

test("richer intent preserves employer AND location, structured salary and independent criteria", () => {
  const search = normalizeJobChatSearch({
    ...base().search,
    employer: "NHS",
    jobTypes: ["Full-time"],
    levels: ["Junior"],
    workingArrangement: "hybrid",
    sponsorship: "licensed-employer",
    salary: { min: 30000, max: 40000, currency: "GBP", period: "year" },
    unsupported: [],
  });
  assert.equal(search.where, "London");
  assert.equal(search.employer, "NHS");
  assert.equal(search.salary.min, 30000);
  assert.deepEqual(search.levels, ["Junior"]);
});

test("malformed and contradictory salary cannot survive response or session validation", () => {
  for (const salary of [
    { min: "30000", currency: "GBP", period: "year" },
    { min: 40000, max: 30000, currency: "GBP", period: "year" },
    { min: NaN, currency: "GBP", period: "year" },
    { min: 0, currency: "GBP", period: "year" },
    { min: 10_000_001, currency: "GBP", period: "year" },
    { min: 30000, currency: "GBP", period: "week" },
    { min: 30000, currency: ["GBP"], period: "year" },
    { min: 30000, currency: "GBP", period: ["year"] },
    { currency: "GBP", period: "year" },
  ])
    assert.equal(
      normalizeJobChatResponse({
        ...base(),
        search: { ...base().search, salary },
      }),
      null,
    );
});

test("unknown criteria values are rejected instead of silently dropping a user constraint", () => {
  for (const criteria of [
    { employer: [] },
    { jobTypes: ["made-up"] },
    { levels: ["guaranteed"] },
    { workingArrangement: "fully-remote" },
    { workingArrangement: ["remote"] },
    { sponsorship: "guaranteed" },
    { sponsorship: ["licensed-employer"] },
    { unsupported: [42] },
    { unsupported: ["x".repeat(151)] },
  ]) {
    assert.equal(
      normalizeJobChatSearch({ ...base().search, ...criteria }),
      null,
    );
  }
});

test("matching evidence and partial-coverage metadata remain typed and bounded", () => {
  const result = {
    ...base(),
    evidence: { 1: ["Location: London (catalogue)"] },
    coverage: { scanned: 300, limitReached: true },
  };
  assert.deepEqual(normalizeJobChatResponse(result).evidence, result.evidence);
  for (const invalid of [
    { coverage: { scanned: -1, limitReached: true } },
    { coverage: { scanned: 300, limitReached: "false" } },
    { evidence: { 1: [false] } },
  ]) {
    assert.equal(normalizeJobChatResponse({ ...result, ...invalid }), null);
  }
});

test("invalid cards, suggestions and plan metadata cannot render from persisted storage", () => {
  for (const invalid of [
    { jobs: [{ ...base().jobs[0], title: null }] },
    { suggestions: [null] },
    { access: { isPremium: false, mode: "search", hasMoreResults: "false" } },
    {
      jobs: [
        {
          ...base().jobs[0],
          company: { trading_name: "Example", licensed_sponsor: "false" },
        },
      ],
    },
    { totalCount: -1 },
  ]) {
    assert.equal(normalizeJobChatResponse({ ...base(), ...invalid }), null);
  }
});

const webBase = () => ({
  ...base(),
  jobs: [
    {
      ...base().jobs[0],
      listingSource: {
        kind: "web",
        provider: "jsearch",
        publisher: "Example publisher",
        retrievedAt: new Date(Date.now() - 60_000).toISOString(),
        postedAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
        availability: "unverified",
        employerLicence: "unknown",
      },
    },
  ],
  web: {
    requested: true,
    provider: "jsearch",
    status: "searched",
    examined: 2,
    matched: 1,
    returned: 1,
    excluded: 1,
    exhaustive: false,
  },
});

test("web provenance retains actual dates, index identity and unverified availability", () => {
  const result = normalizeJobChatResponse(webBase());
  assert.equal(result.jobs[0].listingSource.publisher, "Example publisher");
  assert.equal(result.jobs[0].listingSource.availability, "unverified");
  assert.equal(result.web.exhaustive, false);
  assert.equal(result.web.returned, 1);
});

test("malformed, impossible and future retrieval/posting dates cannot be shown as source facts", () => {
  for (const source of [
    { retrievedAt: "not a date" },
    { postedAt: "2026-02-30T10:00:00.000Z" },
    { postedAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString() },
    { retrievedAt: new Date(Date.now() + 6 * 60_000).toISOString() },
    { retrievedAt: "x".repeat(41) },
    { expiresAt: "invalid" },
    { publisher: "x".repeat(151) },
    { employerLicence: ["catalogue-match"] },
    { availability: "verified-open" },
    { provider: "unknown-provider" },
  ]) {
    const input = webBase();
    input.jobs[0].listingSource = { ...input.jobs[0].listingSource, ...source };
    assert.equal(normalizeJobChatResponse(input), null);
  }
});

test("web posting date is optional and an actual future closing date remains valid", () => {
  const input = webBase();
  delete input.jobs[0].listingSource.postedAt;
  assert.ok(normalizeJobChatResponse(input));
  assert.ok(Date.parse(input.jobs[0].listingSource.expiresAt) > Date.now());
});

test("web licence evidence must agree with the actual catalogue employer flag", () => {
  const input = webBase();
  input.jobs[0].company = {
    trading_name: "Example verified employer",
    licensed_sponsor: true,
  };
  assert.equal(normalizeJobChatResponse(input), null);
  input.jobs[0].listingSource.employerLicence = "catalogue-match";
  assert.ok(normalizeJobChatResponse(input));
  input.jobs[0].company.licensed_sponsor = false;
  assert.equal(normalizeJobChatResponse(input), null);
});

test("web status and counts cannot fabricate complete coverage or additional returned cards", () => {
  for (const web of [
    { exhaustive: true },
    { examined: -1 },
    { matched: 3 },
    { returned: 0 },
    { excluded: 2 },
    { cacheHit: "true" },
    { status: "live" },
    { requested: false },
    { retrievedAt: new Date(Date.now() + 6 * 60_000).toISOString() },
  ])
    assert.equal(
      normalizeJobChatResponse({
        ...webBase(),
        web: { ...webBase().web, ...web },
      }),
      null,
    );
});

test("web provider failures retain a valid catalogue-only response", () => {
  for (const status of [
    "disabled",
    "unavailable",
    "premium_required",
    "skipped",
    "not_requested",
  ]) {
    const input = {
      ...base(),
      web: {
        ...webBase().web,
        requested: status !== "not_requested",
        status,
        examined: 0,
        matched: 0,
        returned: 0,
        excluded: 0,
      },
    };
    assert.equal(normalizeJobChatResponse(input).jobs.length, 1);
  }
});

test("employer-site cards accept source-listed provenance without inventing a posting date", () => {
  const input = webBase();
  input.jobs[0].listingSource.provider = "employer-sites";
  input.jobs[0].listingSource.availability = "source-listed";
  delete input.jobs[0].listingSource.postedAt;
  input.web = {
    ...input.web,
    provider: "employer-sites",
    boardsChecked: 2,
    boardsFailed: 1,
    boardsAvailable: 4,
    limitReached: true,
  };
  assert.ok(normalizeJobChatResponse(input));
  assert.equal(
    normalizeJobChatResponse(input).jobs[0].listingSource.postedAt,
    undefined,
  );
  assert.equal(
    normalizeJobChatResponse({
      ...input,
      web: { ...input.web, boardsChecked: -1 },
    }),
    null,
  );
});

const groundedBase = () => {
  const text =
    "🎓 Example roles appear on employer pages.\nCheck the original advert.";
  return {
    text,
    sources: [
      { url: "https://example.com/careers", title: "Example employer source" },
    ],
    citations: [
      { startIndex: 0, endIndex: text.indexOf("\n"), sourceIndexes: [0] },
    ],
    searchQueries: ["graduate jobs UK"],
    searchSuggestions: [
      {
        label: "graduate jobs UK",
        url: "https://www.google.com/search?q=graduate+jobs+UK",
      },
    ],
    retrievedAt: new Date(Date.now() - 60_000).toISOString(),
  };
};

test("Google output keeps exact text and overlapping UTF-16 citation ranges", () => {
  const data = groundedBase();
  data.citations.push({
    startIndex: 3,
    endIndex: data.text.length,
    sourceIndexes: [0],
  });
  const result = normalizeGroundedWeb(data);
  assert.equal(result.text, data.text);
  assert.deepEqual(result.citations, data.citations);
  assert.equal(
    result.searchSuggestions[0].label,
    data.searchSuggestions[0].label,
  );
});

test("Google citations reject broken UTF-16 boundaries, invalid offsets and source references", () => {
  for (const citations of [
    [{ startIndex: 1, endIndex: 10, sourceIndexes: [0] }],
    [{ startIndex: 0, endIndex: 1, sourceIndexes: [0] }],
    [{ startIndex: -1, endIndex: 10, sourceIndexes: [0] }],
    [{ startIndex: 0, endIndex: 20000, sourceIndexes: [0] }],
    [{ startIndex: 0, endIndex: 10, sourceIndexes: [1] }],
    [{ startIndex: 0, endIndex: 10, sourceIndexes: [0, 0] }],
  ])
    assert.equal(normalizeGroundedWeb({ ...groundedBase(), citations }), null);
});

test("Google source links must use public HTTPS and original suggestions must link to Google search", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://localhost/job",
    "https://localhost./job",
    "https://127.0.0.1/job",
    "https://2130706433/job",
    "https://user:password@example.com/job",
  ]) {
    assert.equal(
      normalizeGroundedWeb({
        ...groundedBase(),
        sources: [{ url, title: "Example" }],
      }),
      null,
    );
  }
  assert.equal(
    normalizeGroundedWeb({
      ...groundedBase(),
      searchSuggestions: [
        { label: "Original label", url: "https://example.com/search?q=jobs" },
      ],
    }),
    null,
  );
  assert.equal(
    normalizeGroundedWeb({
      ...groundedBase(),
      searchSuggestions: [
        {
          label: "Original label",
          url: "https://news.google.com/search?q=jobs",
        },
      ],
    }),
    null,
  );
  assert.ok(
    normalizeGroundedWeb({
      ...groundedBase(),
      searchSuggestions: [
        { label: "Original label", url: "https://www.google.ie/search?q=jobs" },
      ],
    }),
  );
  assert.ok(
    normalizeGroundedWeb({
      ...groundedBase(),
      searchSuggestions: [
        {
          label: "Original redirect label",
          url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/fictional-preview-link",
        },
      ],
    }),
  );
  assert.equal(
    normalizeGroundedWeb({
      ...groundedBase(),
      searchSuggestions: [
        {
          label: "Wrong host",
          url: "https://example.com/grounding-api-redirect/token",
        },
      ],
    }),
    null,
  );
  assert.equal(
    normalizeGroundedWeb({ ...groundedBase(), text: "x".repeat(20001) }),
    null,
  );
});

test("Google data is excluded from every reusable catalogue response and session serialization", () => {
  const input = {
    ...base(),
    groundedWeb: groundedBase(),
    groundedWebStatus: "searched",
    debugGroundingPayload: groundedBase(),
  };
  const response = normalizeJobChatResponse(input);
  assert.equal(response.groundedWeb.text, input.groundedWeb.text);
  const reusable = catalogueChatResponse(response);
  const serialized = JSON.stringify([
    { role: "assistant", content: reusable.message, result: reusable },
  ]);
  for (const forbidden of [
    "groundedWeb",
    "debugGroundingPayload",
    input.groundedWeb.text,
    input.groundedWeb.sources[0].url,
    input.groundedWeb.searchQueries[0],
  ])
    assert.equal(serialized.includes(forbidden), false);
  assert.equal(reusable.jobs.length, 1);
});

test("malformed optional Google output fails closed while catalogue cards remain usable", () => {
  const response = normalizeJobChatResponse({
    ...base(),
    groundedWebStatus: "searched",
    groundedWeb: { ...groundedBase(), citations: [] },
  });
  assert.equal(response.jobs.length, 1);
  assert.equal(response.groundedWeb, undefined);
  assert.equal(response.groundedWebStatus, "unavailable");
});

const guidanceBase = () => ({
  version: "reviewed-v1",
  reviewedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10),
  sections: [
    {
      id: "cv",
      title: "Plan your CV",
      body: "Choose accurate examples relevant to the role.",
      source: {
        title: "National Careers Service",
        url: "https://nationalcareers.service.gov.uk/careers-advice/cv-sections",
      },
    },
  ],
});
const adviceBase = () => ({
  ...base(),
  mode: "advice",
  message: "Here is guidance from checked sources.",
  jobs: [],
  totalCount: 0,
  guidance: guidanceBase(),
  evidence: {},
});

test("legacy responses normalize to search mode and reviewed guidance persists without Google data", () => {
  assert.equal(normalizeJobChatResponse(base()).mode, "search");
  const response = normalizeJobChatResponse(adviceBase());
  assert.equal(response.mode, "advice");
  assert.equal(response.jobs.length, 0);
  const stored = JSON.stringify(catalogueChatResponse(response));
  assert.ok(stored.includes(response.guidance.sections[0].body));
  assert.ok(stored.includes(response.guidance.reviewedAt));
  assert.equal(stored.includes("groundedWeb"), false);
});

test("advice, clarification and refusal cannot imply job matches or include paid search controls", () => {
  for (const mode of ["advice", "clarification", "refusal"]) {
    const input = { ...base(), mode, jobs: [], totalCount: 0, evidence: {} };
    assert.ok(normalizeJobChatResponse(input));
    for (const invalid of [
      { jobs: base().jobs },
      { totalCount: 1 },
      { access: { isPremium: true, mode: "search" } },
      { coverage: { scanned: 10, limitReached: false } },
      { evidence: { 1: ["A job match"] } },
    ]) {
      assert.equal(normalizeJobChatResponse({ ...input, ...invalid }), null);
    }
    assert.ok(
      normalizeJobChatResponse({
        ...input,
        web: {
          requested: true,
          provider: "employer-sites",
          status: "skipped",
          examined: 0,
          matched: 0,
          returned: 0,
          excluded: 0,
          exhaustive: false,
        },
      }),
    );
  }
  assert.equal(normalizeJobChatResponse({ ...base(), mode: "anything" }), null);
  assert.equal(normalizeJobChatResponse({ ...base(), mode: ["search"] }), null);
});

test("guidance appears only in advice mode and accepts exact reviewed official source hosts", () => {
  for (const mode of ["search", "clarification", "refusal"])
    assert.equal(normalizeJobChatResponse({ ...adviceBase(), mode }), null);
  for (const host of [
    "nationalcareers.service.gov.uk",
    "gov.uk",
    "www.gov.uk",
    "www.civil-service-careers.gov.uk",
    "www.healthcareers.nhs.uk",
    "www.jobs.nhs.uk",
    "www.covwarkpt.nhs.uk",
  ]) {
    const guidance = guidanceBase();
    guidance.sections[0].source.url = `https://${host}/application-guidance-`;
    assert.ok(normalizeCareerGuidance(guidance));
  }
  for (const url of [
    "http://www.gov.uk/advice",
    "https://gov.uk.evil.com/advice",
    "https://other.nhs.uk/advice",
    "https://user:password@www.gov.uk/advice",
    "https://127.0.0.1/advice",
    "javascript:alert(1)",
  ]) {
    const guidance = guidanceBase();
    guidance.sections[0].source.url = url;
    assert.equal(normalizeCareerGuidance(guidance), null);
  }
});

test("guidance has bounded unique sections, real review dates and a valid review window", () => {
  for (const invalid of [
    { version: "" },
    { version: "x".repeat(81) },
    { sections: [] },
    { sections: Array(4).fill(guidanceBase().sections[0]) },
    { sections: [guidanceBase().sections[0], guidanceBase().sections[0]] },
    { reviewedAt: "2026-02-30" },
    {
      reviewedAt: new Date(Date.now() + 24 * 60 * 60_000)
        .toISOString()
        .slice(0, 10),
    },
    { expiresAt: "2000-01-01" },
    { sections: [{ ...guidanceBase().sections[0], body: "x".repeat(5001) }] },
  ])
    assert.equal(
      normalizeCareerGuidance({ ...guidanceBase(), ...invalid }),
      null,
    );
});

test("expired stored guidance becomes neutral clarification and its old content is omitted", () => {
  const input = adviceBase();
  input.guidance.reviewedAt = "2000-01-01";
  input.guidance.expiresAt = "2000-01-02";
  const restored = normalizeJobChatResponse(catalogueChatResponse(input));
  assert.equal(restored.mode, "clarification");
  assert.equal(restored.guidance, undefined);
  assert.match(restored.message, /updated source review/);
  assert.equal(
    JSON.stringify(restored).includes(input.guidance.sections[0].body),
    false,
  );
});

const discoveryBase = () => {
  const card = {
    title: "Original discovery title",
    employer: "Example employer",
    location: "London",
    salary: "£30,000",
    employmentType: "Full-time",
    workingArrangement: "hybrid",
    description: "Original advert summary from the provider.",
    closingDate: new Date(Date.now() + 7 * 24 * 60 * 60_000)
      .toISOString()
      .slice(0, 10),
    postedDate: new Date(Date.now() - 24 * 60 * 60_000)
      .toISOString()
      .slice(0, 10),
    url: "https://example.com/web/discovery-role",
    explanation: "Original criteria explanation.",
    sourceIndexes: [0],
  };
  const text = JSON.stringify({ jobs: [card] });
  return {
    ...groundedBase(),
    format: "job-cards",
    cards: [card],
    text,
    citations: [{ startIndex: 0, endIndex: text.length, sourceIndexes: [0] }],
  };
};

test("original Google discovery cards preserve values/order with their original source metadata", () => {
  const data = discoveryBase();
  const result = normalizeGroundedWeb(data);
  assert.equal(result.format, "job-cards");
  assert.deepEqual(result.cards, data.cards);
  assert.equal(result.text, data.text);
  assert.deepEqual(result.citations, data.citations);
});

test("expired, future or conflicting discovery dates fail closed instead of showing old adverts", () => {
  for (const change of [
    { closingDate: "2000-01-01" },
    {
      postedDate: new Date(Date.now() + 24 * 60 * 60_000)
        .toISOString()
        .slice(0, 10),
    },
    { closingDate: "2026-02-30" },
    { postedDate: "yesterday" },
  ]) {
    const data = discoveryBase();
    data.cards[0] = { ...data.cards[0], ...change };
    assert.equal(normalizeGroundedWeb(data), null);
    const response = normalizeJobChatResponse({
      ...base(),
      groundedWeb: data,
      groundedWebStatus: "searched",
    });
    assert.equal(response.groundedWeb, undefined);
    assert.equal(response.jobs.length, 1);
  }
});

test("Google discovery links, field bounds and per-card sources are validated", () => {
  for (const change of [
    { url: "javascript:alert(1)" },
    { url: "https://localhost/job" },
    { sourceIndexes: [] },
    { sourceIndexes: [1] },
    { sourceIndexes: [0, 0] },
    { title: "x".repeat(301) },
    { description: "x".repeat(1201) },
    { explanation: "" },
    { workingArrangement: ["hybrid"] },
    { salary: undefined },
  ]) {
    const data = discoveryBase();
    data.cards[0] = { ...data.cards[0], ...change };
    assert.equal(normalizeGroundedWeb(data), null);
  }
  assert.notEqual(normalizeGroundedWeb({ ...discoveryBase(), cards: [] }), null);
  assert.equal(
    normalizeGroundedWeb({
      ...discoveryBase(),
      cards: Array(6).fill(discoveryBase().cards[0]),
    }),
    null,
  );
  assert.equal(
    normalizeGroundedWeb({ ...discoveryBase(), format: undefined }),
    null,
  );
});

test("unknown salary and dates remain null and discovery cards never enter reusable data", () => {
  const data = discoveryBase();
  data.cards[0].salary = null;
  data.cards[0].closingDate = null;
  data.cards[0].postedDate = null;
  const response = normalizeJobChatResponse({
    ...base(),
    groundedWeb: data,
    groundedWebStatus: "searched",
  });
  assert.equal(response.groundedWeb.cards[0].closingDate, null);
  const serialized = JSON.stringify(catalogueChatResponse(response));
  assert.equal(serialized.includes(data.cards[0].title), false);
  assert.equal(serialized.includes(data.cards[0].url), false);
  assert.equal(serialized.includes("groundedWeb"), false);
});

test("Civil Service scope defaults safely and is preserved independently from employer/location", () => {
  assert.equal(normalizeJobChatSearch(base().search).employerScope, "any");
  const search = normalizeJobChatSearch({
    ...base().search,
    employer: "Cabinet Office",
    employerScope: "civil-service",
  });
  assert.equal(search.employerScope, "civil-service");
  assert.equal(search.employer, "Cabinet Office");
  assert.equal(search.where, "London");
  assert.equal(
    normalizeJobChatSearch({
      ...base().search,
      employerScope: "all-government",
    }),
    null,
  );
});

const contextDiscoveryBase = () => {
  const data = discoveryBase();
  const first = groundedBase();
  const text = `🎓 ${"Original first-phase search evidence. ".repeat(60)}`;
  return {
    ...data,
    sources: [{ url: data.cards[0].url, title: "example.com" }],
    citations: [],
    retrievedUrls: [data.cards[0].url],
    searchResearch: {
      text,
      sources: first.sources,
      citations: [{ startIndex: 0, endIndex: text.length, sourceIndexes: [0] }],
    },
  };
};

test("native URL Context cards need no fabricated Search citation spans on their JSON", () => {
  const data = contextDiscoveryBase();
  const result = normalizeGroundedWeb(data);
  assert.ok(result);
  assert.deepEqual(result.citations, []);
  assert.deepEqual(result.retrievedUrls, [data.cards[0].url]);
  assert.equal(result.sources[result.cards[0].sourceIndexes[0]].url, result.cards[0].url);
  assert.equal(result.text, data.text);
  assert.equal(result.searchResearch.text, data.searchResearch.text);
  assert.deepEqual(result.searchResearch.citations, data.searchResearch.citations);
});

test("missing URL retrieval proof or original research cannot make uncited card details valid", () => {
  const valid = contextDiscoveryBase();
  for (const change of [
    { retrievedUrls: undefined },
    { retrievedUrls: [] },
    { retrievedUrls: ["https://example.com/web/different-role"] },
    { searchResearch: undefined },
    { searchResearch: { ...valid.searchResearch, citations: [] } },
    { sources: [{ url: "https://example.com/careers", title: "Different source" }] },
    { sources: [
      { url: "https://example.com/careers", title: "Different source" },
      valid.sources[0],
    ] },
  ])
    assert.equal(normalizeGroundedWeb({ ...valid, ...change }), null);
});

test("first-phase citation offsets are checked against their own text, never the final JSON", () => {
  const data = contextDiscoveryBase();
  assert.ok(data.searchResearch.text.length > data.text.length);
  assert.ok(normalizeGroundedWeb(data));
  assert.equal(
    normalizeGroundedWeb({ ...data, citations: data.searchResearch.citations }),
    null,
  );
  for (const citation of [
    { startIndex: 1, endIndex: 10, sourceIndexes: [0] },
    { startIndex: 0, endIndex: data.searchResearch.text.length + 1, sourceIndexes: [0] },
    { startIndex: 0, endIndex: 10, sourceIndexes: [1] },
  ])
    assert.equal(
      normalizeGroundedWeb({
        ...data,
        searchResearch: { ...data.searchResearch, citations: [citation] },
      }),
      null,
    );
});

test("retrieval URLs and original research are bounded, public and cannot nest more panels", () => {
  const data = contextDiscoveryBase();
  for (const retrievedUrls of [
    [data.cards[0].url, data.cards[0].url],
    ["http://example.com/web/role"],
    ["https://localhost/job"],
    Array.from({ length: 21 }, (_, index) => `https://example.com/web/role-${index}`),
  ])
    assert.equal(normalizeGroundedWeb({ ...data, retrievedUrls }), null);
  for (const searchResearch of [
    { ...data.searchResearch, text: "x".repeat(20001) },
    { ...data.searchResearch, searchResearch: data.searchResearch },
    { ...data.searchResearch, sources: [{ url: "javascript:alert(1)", title: "Unsafe" }] },
    { ...data.searchResearch, citations: Array(101).fill(data.searchResearch.citations[0]) },
  ])
    assert.equal(normalizeGroundedWeb({ ...data, searchResearch }), null);
});

test("a supported empty extraction preserves original research without creating a failed search", () => {
  const data = {
    ...contextDiscoveryBase(),
    cards: [],
    text: '{"cards":[]}',
    sources: [],
    citations: [],
    retrievedUrls: [],
  };
  const response = normalizeJobChatResponse({
    ...base(),
    groundedWebStatus: "searched",
    groundedWeb: data,
  });
  assert.equal(response.groundedWebStatus, "searched");
  assert.deepEqual(response.groundedWeb.cards, []);
  assert.equal(response.groundedWeb.searchResearch.text, data.searchResearch.text);
});

test("all URL Context details and first-phase research remain excluded from reusable conversations", () => {
  const data = contextDiscoveryBase();
  const response = normalizeJobChatResponse({
    ...base(),
    groundedWebStatus: "searched",
    groundedWeb: data,
  });
  assert.ok(response.groundedWeb);
  const serialized = JSON.stringify(catalogueChatResponse(response));
  for (const forbidden of [
    "groundedWeb", "retrievedUrls", "searchResearch",
    data.text, data.cards[0].url, data.searchResearch.text,
    data.searchResearch.sources[0].url,
  ])
    assert.equal(serialized.includes(forbidden), false);
});

test("an original Google source link is retained when URL Context retrieves that exact wrapped advert URL", () => {
  const data = contextDiscoveryBase();
  const originalUrl = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/native-advert-fixture";
  data.cards[0].url = originalUrl;
  data.text = JSON.stringify({ cards: data.cards });
  data.retrievedUrls = [originalUrl];
  data.sources = [{ url: originalUrl, title: "Original Google source" }];
  data.searchResearch.sources = [{ url: originalUrl, title: "Original native search source" }];
  const result = normalizeGroundedWeb(data);
  assert.ok(result);
  assert.equal(result.cards[0].url, originalUrl);
  assert.equal(result.sources[result.cards[0].sourceIndexes[0]].url, originalUrl);
  assert.deepEqual(result.citations, []);
  assert.equal(result.searchResearch.sources[0].url, originalUrl);
  assert.equal(
    normalizeGroundedWeb({ ...data, retrievedUrls: [originalUrl + "-different"] }),
    null,
  );
});

const indexedDiscoveryBase = () => {
  const data = contextDiscoveryBase();
  const originalUrl = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/original-opaque-source-fixture";
  data.cards[0] = { ...data.cards[0], sourceId: 0, url: originalUrl };
  const originalCard = { ...data.cards[0] };
  delete originalCard.url;
  delete originalCard.sourceIndexes;
  data.text = JSON.stringify({ cards: [originalCard] });
  data.cardSourceUrls = [originalUrl];
  data.retrievedUrls = [originalUrl];
  data.sources = [{ url: originalUrl, title: "Original Google advert source" }];
  data.searchResearch.sources = [{ url: originalUrl, title: "Original Google search source" }];
  return data;
};

test("short source IDs retain the exact server-bound advert link without rewriting original model JSON", () => {
  const data = indexedDiscoveryBase();
  const result = normalizeGroundedWeb(data);
  assert.ok(result);
  assert.equal(result.text, data.text);
  assert.equal(JSON.parse(result.text).cards[0].sourceId, 0);
  assert.equal(JSON.parse(result.text).cards[0].url, undefined);
  assert.equal(result.text.includes(data.cards[0].url), false);
  assert.equal(result.cards[0].url, result.cardSourceUrls[0]);
  assert.equal(result.sources[result.cards[0].sourceIndexes[0]].url, result.cards[0].url);
  assert.deepEqual(result.citations, []);
  assert.equal(result.searchResearch.text, data.searchResearch.text);
});

test("card source mappings accept at most two unique public HTTPS links", () => {
  const data = indexedDiscoveryBase();
  for (const cardSourceUrls of [
    null, data.cards[0].url, [],
    [data.cards[0].url, data.cards[0].url],
    [data.cards[0].url, "https://example.com/jobs/second", "https://example.com/jobs/third"],
    ["http://example.com/job"],
    ["https://localhost/job"],
    ["https://user:secret@example.com/job"],
    ["https://example.com/" + "x".repeat(2048)],
  ])
    assert.equal(normalizeGroundedWeb({ ...data, cardSourceUrls }), null);
  assert.ok(normalizeGroundedWeb({
    ...data,
    cardSourceUrls: [...data.cardSourceUrls, "https://example.com/jobs/another-candidate"],
  }));
});

test("source IDs require an in-range integer and their server-owned source mapping", () => {
  for (const sourceId of [-1, 1, 2, 0.5, "0", null, NaN]) {
    const data = indexedDiscoveryBase();
    data.cards[0].sourceId = sourceId;
    assert.equal(normalizeGroundedWeb(data), null);
  }
  const data = indexedDiscoveryBase();
  delete data.cardSourceUrls;
  assert.equal(normalizeGroundedWeb(data), null);
});

test("a mutated advert URL cannot pass source-ID binding even with independent retrieval proof", () => {
  const data = indexedDiscoveryBase();
  const changed = data.cards[0].url + "-model-mutated";
  data.cards[0].url = changed;
  data.cards[0].sourceIndexes = [1];
  data.sources.push({ url: changed, title: "A different retrieved source" });
  data.retrievedUrls.push(changed);
  assert.equal(normalizeGroundedWeb(data), null);
});

test("source-ID cards always require exact native retrieval and matching source indexes", () => {
  const data = indexedDiscoveryBase();
  data.citations = [{ startIndex: 0, endIndex: data.text.length, sourceIndexes: [0] }];
  for (const change of [
    { retrievedUrls: undefined },
    { retrievedUrls: [] },
    { retrievedUrls: [data.cards[0].url + "-different"] },
    { searchResearch: undefined },
    { sources: [{ url: "https://example.com/jobs/different", title: "Different source" }] },
  ])
    assert.equal(normalizeGroundedWeb({ ...data, ...change }), null);
});

test("legacy exact-link cards can share a source mapping with indexed cards when every advert has native proof", () => {
  const data = indexedDiscoveryBase();
  const legacyUrl = "https://example.com/jobs/legacy-exact-native-link";
  const legacy = { ...data.cards[0], title: "Second original discovery", url: legacyUrl, sourceIndexes: [1] };
  delete legacy.sourceId;
  data.cards.push(legacy);
  data.sources.push({ url: legacyUrl, title: "Original second advert" });
  data.retrievedUrls.push(legacyUrl);
  data.cardSourceUrls.push(legacyUrl);
  assert.ok(normalizeGroundedWeb(data));
  const indexedInvalid = {
    ...data,
    cards: [{ ...data.cards[0], sourceId: 1 }, legacy],
  };
  const response = normalizeJobChatResponse({ ...base(), groundedWebStatus: "searched", groundedWeb: indexedInvalid });
  assert.equal(response.groundedWebStatus, "unavailable");
  assert.equal(response.groundedWeb, undefined);
  assert.equal(response.jobs.length, 1);
  const missingLegacyProof = { ...data, retrievedUrls: [data.cards[0].url] };
  assert.equal(normalizeGroundedWeb(missingLegacyProof), null);
});

test("legacy cards with a candidate map cannot use citation spans to bypass native retrieval", () => {
  const data = indexedDiscoveryBase();
  delete data.cards[0].sourceId;
  data.citations = [{ startIndex: 0, endIndex: data.text.length, sourceIndexes: [0] }];
  assert.ok(normalizeGroundedWeb(data));
  delete data.retrievedUrls;
  assert.equal(normalizeGroundedWeb(data), null);
});

test("short IDs, candidate mappings and original extraction JSON never enter reusable catalogue conversations", () => {
  const data = indexedDiscoveryBase();
  const response = normalizeJobChatResponse({ ...base(), groundedWebStatus: "searched", groundedWeb: data });
  assert.ok(response.groundedWeb);
  const serialized = JSON.stringify(catalogueChatResponse(response));
  for (const forbidden of [
    "groundedWeb", "cardSourceUrls", "sourceId", "retrievedUrls", "searchResearch",
    data.text, data.cards[0].url, data.cards[0].title, data.searchResearch.text,
  ])
    assert.equal(serialized.includes(forbidden), false);
});
