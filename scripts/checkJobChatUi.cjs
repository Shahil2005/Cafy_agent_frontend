const assert = require("node:assert/strict");
const path = require("node:path");
const { existsSync, mkdirSync } = require("node:fs");
const workspaceRoot = path.resolve(__dirname, "../..");
const { chromium } = require(
  require.resolve("playwright", {
    paths: [__dirname, path.join(workspaceRoot, "CAFY-JOBS-hari")],
  }),
);
const screenshotDir =
  process.env.CAFY_CHAT_SCREENSHOT_DIR ||
  path.join(workspaceRoot, "artifacts/job-chat");
mkdirSync(screenshotDir, { recursive: true });
const systemChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chrome =
  process.env.CAFY_CHAT_CHROME_EXECUTABLE ||
  (existsSync(systemChrome) ? systemChrome : undefined);
(async () => {
  const browser = await chromium.launch({
    ...(chrome ? { executablePath: chrome } : {}),
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  const unexpectedRequests = [];
  const previewUrl = process.env.CAFY_CHAT_PREVIEW_URL ||
    "http://127.0.0.1:5175/job-chat-preview.html";
  const previewOrigin = new URL(previewUrl).origin;
  await page.route("**/*", (route) => {
    const request = route.request();
    if (
      new URL(request.url()).origin === previewOrigin &&
      ["GET", "HEAD"].includes(request.method())
    ) return route.continue();
    unexpectedRequests.push({ method: request.method(), scope: "outside static preview reads" });
    return route.abort();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const response = await page.goto(
      previewUrl,
      { waitUntil: "networkidle" },
    );
    assert.equal(response.status(), 200);
    await page
      .getByRole("heading", {
        name: "Less searching. More finding your place.",
      })
      .waitFor();
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_DESKTOP.png"),
      fullPage: true,
    });
    await page
      .getByLabel("Ask CAFY about jobs or your career")
      .fill("slow preview search");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page
      .getByText("Let's take a closer look.", { exact: true })
      .waitFor();
    assert.equal(await page.getByRole("article").count(), 0);
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_LOADING.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      await page.getByLabel("Ask CAFY about jobs or your career").inputValue(),
      "slow preview search",
    );
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Data analyst jobs in London", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Graduate Data Analyst", exact: true })
      .waitFor();
    assert.equal(await page.getByRole("article").count(), 2);
    await page
      .getByRole("button", { name: "Manchester instead", exact: true })
      .click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("article")]
        .slice(-2)
        .every((el) => el.textContent.includes("Manchester")),
    );
    await page
      .getByRole("button", { name: "Save Graduate Data Analyst", exact: true })
      .last()
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Saved to your tracker." })
      .waitFor();
    await page
      .getByRole("button", { name: "Tailor my CV", exact: true })
      .last()
      .click();
    await page.locator("#chat-cv-select").selectOption("example-cv");
    await page
      .getByRole("button", { name: "Continue in Resume Studio", exact: true })
      .first()
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Preview: this would open" })
      .waitFor();
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_RESULTS.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await page
      .getByLabel("Ask CAFY about jobs or your career")
      .fill(
        "Junior full-time hybrid data analyst jobs at NHS in London from £30,000",
      );
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.getByText("Employer: NHS", { exact: true }).waitFor();
    await page.getByText("Location: London", { exact: true }).waitFor();
    await page
      .getByText("Salary: from £30,000 / year", { exact: true })
      .waitFor();
    await page.getByText("Type: Full-time", { exact: true }).waitFor();
    await page.getByText("Level: Junior", { exact: true }).waitFor();
    await page.getByText("Work: hybrid", { exact: true }).waitFor();
    assert.equal(await page.getByRole("article").count(), 1);
    await page.getByText("Why this matches", { exact: true }).click();
    await page
      .getByText("Employer: Example NHS Trust (catalogue employer name)", {
        exact: true,
      })
      .waitFor({ state: "visible" });
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_FILTERS.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Remove salary filter", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("article").length === 3,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Remove salary filter", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByText("Employer: NHS", { exact: true }).count(),
      2,
    );
    await page
      .getByLabel("Ask CAFY about jobs or your career")
      .fill("show limited coverage");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page
      .getByText(
        "Matches found among 300 catalogue jobs checked. More jobs may meet your criteria; this is not a full catalogue count.",
        { exact: true },
      )
      .waitFor({ state: "attached" });
    assert.equal(
      await page
        .getByText(
          "Matches found among 300 catalogue jobs checked. More jobs may meet your criteria; this is not a full catalogue count.",
          { exact: true },
        )
        .isVisible(),
      false,
    );
    await page
      .getByText(/^Search details/)
      .last()
      .click();
    await page
      .getByLabel("Ask CAFY about jobs or your career")
      .fill("from £30,000 within 5 miles");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.getByText("Clarification needed", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Remove unsupported filters", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("article").length === 6,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Remove salary filter", exact: true })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    const webToggle = page.getByRole("checkbox", {
      name: "Include web results",
      exact: true,
    });
    assert.equal(await webToggle.isChecked(), false);
    await webToggle.check();
    const ask = async (message) => {
      await page.getByLabel("Ask CAFY about jobs or your career").fill(message);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Conversation"]')
            .getAttribute("aria-busy") === "false",
      );
    };
    await ask("Full-time data analyst jobs in London");
    assert.equal(await page.getByRole("article").count(), 3);
    assert.equal(
      await page
        .getByText("Employer website · Example employer careers", {
          exact: true,
        })
        .count(),
      1,
    );
    assert.equal(
      await page.getByText("CAFY catalogue", { exact: true }).count(),
      2,
    );
    let webArticle = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Junior Data Analyst – Web example",
          exact: true,
        }),
      })
      .last();
    assert.equal(await webArticle.locator("time").count(), 3);
    await webArticle
      .getByText(
        "Employer licence not confirmed · sponsorship is not verified",
        { exact: true },
      )
      .waitFor();
    await webArticle.getByText("Why this matches", { exact: true }).click();
    await webArticle
      .getByText("Job type: Full-time (employer-site advert)", {
        exact: true,
      })
      .waitFor({ state: "visible" });
    await page
      .getByText(
        "Employer websites: 2 adverts checked; 1 additional job shown after matching and duplicate removal.",
        { exact: true },
      )
      .waitFor({ state: "attached" });
    assert.equal(
      await page
        .getByText(
          "Employer websites: 2 adverts checked; 1 additional job shown after matching and duplicate removal.",
          { exact: true },
        )
        .isVisible(),
      false,
    );
    await page
      .getByText(/^Search details/)
      .last()
      .click();
    await webArticle
      .getByText("Published on employer site", { exact: true })
      .waitFor();
    const googlePanel = page.getByRole("region", {
      name: "Google Search results",
      exact: true,
    });
    await googlePanel.waitFor();
    assert.equal(await googlePanel.getByRole("article").count(), 0);
    assert.equal(await googlePanel.getByRole("button").count(), 0);
    const citation = googlePanel.getByRole("link", {
      name: "Source 1: Example Web Employer advert",
      exact: true,
    });
    assert.equal(
      await citation.getAttribute("href"),
      "https://example.com/careers/graduate-analyst",
    );
    assert.equal(
      await googlePanel
        .getByRole("link", { name: "graduate jobs UK", exact: true })
        .getAttribute("href"),
      "https://www.google.com/search?q=graduate+jobs+UK",
    );
    assert.equal(
      await googlePanel
        .getByRole("link", { name: "graduate jobs London", exact: true })
        .getAttribute("href"),
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/fictional-preview-link",
    );
    assert.equal(await googlePanel.getAttribute("data-ph-no-capture"), "true");
    assert.ok(
      (await googlePanel.getAttribute("class")).includes("sentry-block"),
    );
    const originalGoogleText = await googlePanel
      .locator("[data-grounded-text]")
      .evaluate((node) => {
        const copy = node.cloneNode(true);
        copy.querySelectorAll("sup").forEach((item) => item.remove());
        return copy.textContent;
      });
    assert.equal(
      JSON.parse(originalGoogleText).cards[0].title,
      "Graduate Data Analyst – Web discovery",
    );
    const originalCards = JSON.parse(originalGoogleText).cards;
    assert.deepEqual(originalCards.map((card) => card.sourceId), [0, 1]);
    assert.ok(originalCards.every((card) => card.url === undefined && card.sourceIndexes === undefined));
    assert.equal(
      await googlePanel.locator("[data-grounded-text]").isVisible(),
      false,
    );
    await googlePanel
      .getByRole("heading", { name: "Web discoveries", exact: true })
      .waitFor();
    assert.deepEqual(
      await googlePanel
        .getByRole("link", { name: "Read advert", exact: true })
        .evaluateAll((links) => links.map((link) => link.href)),
      ["https://example.com/careers/graduate-analyst"],
    );
    assert.equal(
      await googlePanel.getByRole("link", { name: "Read advert via Google", exact: true }).getAttribute("href"),
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/fictional-preview-advert",
    );
    await googlePanel.getByText(/Advert details retrieved by Google\. Confirm current availability\./).waitFor();
    assert.equal(await googlePanel.locator("[data-grounded-text] sup").count(), 0);
    const originalResearch = googlePanel.locator("[data-grounded-research]");
    assert.equal(await originalResearch.isVisible(), false);
    await googlePanel.getByText("Original Google Search research", { exact: true }).click();
    assert.equal(await originalResearch.isVisible(), true);
    assert.equal(await originalResearch.locator("sup").count(), 2);
    assert.ok((await originalResearch.textContent()).startsWith("Google-only preview finding:"));
    assert.equal(
      await originalResearch.getByRole("link", { name: "Source 2: Example Research Team original search source", exact: true }).getAttribute("href"),
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/fictional-preview-advert",
    );
    assert.equal(await googlePanel.locator("[data-grounded-text]").isVisible(), false);
    await googlePanel.getByText("Original advert details", { exact: true }).click();
    assert.equal(await googlePanel.locator("[data-grounded-text]").isVisible(), true);
    assert.equal(await googlePanel.locator("[data-grounded-text] sup").count(), 0);
    await googlePanel.getByText("Original advert details", { exact: true }).click();
    await googlePanel.getByText("Original Google Search research", { exact: true }).click();
    await googlePanel
      .getByText("Closing date not supplied", { exact: true })
      .waitFor();
    await googlePanel.getByText("Salary not stated", { exact: true }).waitFor();
    await page
      .getByText(/^Search details/)
      .last()
      .click();
    const positionDiscoveries = async () =>
      page
        .getByRole("log", { name: "Conversation", exact: true })
        .evaluate((container) => {
          const panel = container.querySelector("[data-google-grounded]");
          container.scrollTop +=
            panel.getBoundingClientRect().top -
            container.getBoundingClientRect().top -
            12;
        });
    await positionDiscoveries();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_GOOGLE.png"),
      fullPage: true,
    });
    await webArticle.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_WEB.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await positionDiscoveries();
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_DISCOVERIES_MOBILE.png"),
      fullPage: true,
    });
    await webArticle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_WEB_MOBILE.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ask("Manchester instead");
    assert.equal(await webToggle.isChecked(), true);
    assert.equal(await page.getByRole("article").count(), 6);
    const statuses = [
      [
        "web unavailable",
        "Web search is temporarily unavailable. The CAFY catalogue search is unaffected.",
      ],
      [
        "web disabled",
        "Direct employer-site search is unavailable for this request. The CAFY catalogue search is unaffected.",
      ],
      [
        "web premium",
        "Website job results require a paid job-search plan. The CAFY catalogue search is unaffected.",
      ],
      [
        "web skipped",
        "Web search was not run for this request. Review the search guidance above before trying again.",
      ],
    ];
    let expectedCards = 6;
    for (const [request, message] of statuses) {
      await ask(request);
      await page
        .getByText(/^Search details/)
        .last()
        .click();
      await page.getByText(message, { exact: true }).waitFor();
      expectedCards += 2;
      assert.equal(await page.getByRole("article").count(), expectedCards);
    }
    await ask("web no matches");
    await page
      .getByText(/^Search details/)
      .last()
      .click();
    await page
      .getByText("No additional web jobs were returned for these criteria.", {
        exact: true,
      })
      .waitFor();
    await ask("web missing date");
    webArticle = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Junior Data Analyst – Web example",
          exact: true,
        }),
      })
      .last();
    assert.equal(await webArticle.locator("time").count(), 2);
    await webArticle
      .getByText("Posting date not supplied", { exact: true })
      .waitFor();
    await ask("web cached");
    await page
      .getByText(/^Search details/)
      .last()
      .click();
    await page.getByText(/^Previously retrieved source results/).waitFor();
    await ask("catalogue only");
    assert.equal(await webToggle.isChecked(), false);
    assert.equal(await googlePanel.count(), 0);
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await webToggle.check();
    await ask("catalogue unavailable");
    assert.equal(await page.getByRole("article").count(), 1);
    await page
      .getByText(
        "The CAFY catalogue could not be checked; these results come from the sources available.",
        { exact: true },
      )
      .waitFor();
    await page
      .getByText(/^Search details/)
      .last()
      .click();
    await page
      .getByText(
        "The CAFY catalogue could not be checked for this request. Results shown come from the other sources available.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page.getByText(/^Checked \d+ catalogue adverts/).count(),
      0,
    );
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await webToggle.check();
    await ask("Find Civil Service data analyst jobs in London");
    await page.getByText("UK Civil Service", { exact: true }).waitFor();
    await page
      .getByText("Government jobs service · GOV.UK Work Hub", { exact: true })
      .waitFor();
    await page
      .getByText("Listed on government jobs service", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Remove Civil Service filter", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("article").length === 6,
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Remove Civil Service filter",
          exact: true,
        })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await ask("Find software engineer jobs in London");
    assert.equal(await page.getByRole("article").count(), 2);
    await ask("How should I structure my CV?");
    const guidancePanel = page.getByRole("region", {
      name: "Source-reviewed career guidance",
      exact: true,
    });
    await guidancePanel.waitFor();
    const adviceReply = guidancePanel.locator("..");
    assert.equal(
      await adviceReply.getByLabel("Search criteria", { exact: true }).count(),
      0,
    );
    assert.equal(await adviceReply.getByRole("article").count(), 0);
    assert.equal(
      await adviceReply
        .getByRole("link", { name: "See plans", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await guidancePanel
        .getByRole("link", {
          name: "National Careers Service: CV guidance",
          exact: true,
        })
        .getAttribute("href"),
      "https://nationalcareers.service.gov.uk/careers-advice/cv-sections",
    );
    assert.equal(await guidancePanel.locator("time").count(), 2);
    await guidancePanel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_CAREER_GUIDANCE.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await ask("Manchester instead");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("article")]
        .slice(-2)
        .every(
          (article) =>
            article.textContent.includes("Software Engineer") &&
            article.textContent.includes("Manchester"),
        ),
    );
    assert.equal(await page.getByRole("article").count(), 4);
    await ask("Write a cake recipe");
    await page.getByText("Career support only", { exact: true }).waitFor();
    assert.equal(await page.getByRole("article").count(), 4);
    await ask("Birmingham instead");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("article")]
        .slice(-2)
        .every(
          (article) =>
            article.textContent.includes("Software Engineer") &&
            article.textContent.includes("Birmingham"),
        ),
    );
    assert.equal(await page.getByRole("article").count(), 6);
    await ask("clarification demo");
    await page.getByText("Clarification needed", { exact: true }).waitFor();
    await ask("advice without sources demo");
    await page
      .getByText(
        "Source-reviewed guidance is unavailable for this answer. Ask a more specific career question.",
        { exact: true },
      )
      .waitFor();
    await ask("expired guidance demo");
    await page
      .getByText(
        "This saved career guidance needs an updated source review. Ask again for current guidance.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page
        .getByText("Expired preview guidance should not be shown.", {
          exact: true,
        })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "How should I structure my CV?",
        exact: true,
      })
      .click();
    await guidancePanel.waitFor();
    assert.equal(await page.getByRole("article").count(), 0);
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    await ask("Find data analyst jobs from the web");
    assert.equal(await webToggle.isChecked(), true);
    await page
      .getByRole("button", { name: "New conversation", exact: true })
      .click();
    assert.equal(await webToggle.isChecked(), false);
    assert.equal(await googlePanel.count(), 0);
    await page
      .getByLabel("Ask CAFY about jobs or your career")
      .fill("error demo");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Example search failure" })
      .waitFor();
    assert.equal(
      await page.getByLabel("Ask CAFY about jobs or your career").inputValue(),
      "error demo",
    );
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("heading", { name: "Graduate Data Analyst", exact: true })
      .waitFor();
    assert.equal(await page.getByRole("alert").count(), 0);
    await page
      .getByLabel("Ask CAFY about jobs or your career")
      .fill("show no results");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page
      .getByText(
        "No example results for this search. Try another role or location.",
        { exact: true },
      )
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page
      .getByRole("button", { name: "Data analyst jobs in London", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Graduate Data Analyst", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Tailor my CV", exact: true })
      .first()
      .click();
    await page.getByRole("dialog", { name: "Prepare your CV" }).waitFor();
    await page.locator("#chat-cv-select-mobile").selectOption("example-cv");
    await page
      .getByRole("dialog")
      .getByText("Review advert text", { exact: false })
      .click();
    const description = page
      .getByRole("dialog")
      .getByLabel("Job description for Resume Studio");
    const originalDescription = await description.inputValue();
    await description.fill("x".repeat(8001));
    assert.equal(
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Continue in Resume Studio", exact: true })
        .isDisabled(),
      true,
    );
    await description.fill(originalDescription);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Continue in Resume Studio", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("status").waitFor();
    await page.screenshot({
      path: path.join(screenshotDir, "CAFY_CHAT_UI_MOBILE.png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedRequests, []);
    console.log(
      JSON.stringify({
        status: "passed",
        checks: [
          "desktop initial screen",
          "honest animated request checks with cancellation and restored draft",
          "catalogue cards",
          "conversational location refinement",
          "separate employer and location criteria",
          "salary, level, type and working arrangement criteria",
          "catalogue matching evidence",
          "remove one criterion and preserve the others",
          "partial catalogue coverage disclosure",
          "technical source diagnostics collapsed by default",
          "unverified requirement clarification and removal",
          "pending salary preserved when unsupported commute is removed",
          "optional web toggle and conversational preference",
          "mixed catalogue and employer-site sources with deduplication",
          "actual posted/checked dates and source-listed availability",
          "employer advert evidence and unknown sponsorship",
          "ephemeral original Google discoveries with actual advert links",
          "native URL Context proof without fabricated JSON citation spans",
          "short source IDs preserve exact advert links without model-generated URL copies",
          "original Google Search research with independently rendered source citations",
          "original wrapped Google advert links labelled without canonical URL guesses",
          "no raw JSON by default and explicit unknown closing dates",
          "original Google suggestion labels and links without tracking",
          "Google content excluded from subsequent request history",
          "career guidance without job cards or search claims",
          "checked official sources with review dates",
          "search context preserved through advice",
          "search context preserved through career-only refusal",
          "Civil Service scope chip and independent removal",
          "government-source adverts labelled without claiming an employer website",
          "career-only refusal and clarification states",
          "unreviewed and expired guidance cannot claim checked sources",
          "career guidance starter and mobile layout",
          "web failures, disabled service and plan restrictions retain catalogue cards",
          "catalogue failure retains independent source cards without claiming zero checked jobs",
          "empty web matches and missing posting date",
          "cached provider source disclosure",
          "mobile web cards without horizontal overflow",
          "tracker save",
          "CV selection and handoff intent",
          "recoverable search error",
          "explicit retry after a failed request",
          "empty results",
          "mobile CV dialog",
          "escape and overflow",
          "no browser exceptions",
        ],
        screenshots: [
          "CAFY_CHAT_UI_DESKTOP.png",
          "CAFY_CHAT_UI_LOADING.png",
          "CAFY_CHAT_UI_RESULTS.png",
          "CAFY_CHAT_UI_FILTERS.png",
          "CAFY_CHAT_UI_GOOGLE.png",
          "CAFY_CHAT_UI_DISCOVERIES_MOBILE.png",
          "CAFY_CHAT_UI_CAREER_GUIDANCE.png",
          "CAFY_CHAT_UI_WEB.png",
          "CAFY_CHAT_UI_WEB_MOBILE.png",
          "CAFY_CHAT_UI_MOBILE.png",
        ],
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
