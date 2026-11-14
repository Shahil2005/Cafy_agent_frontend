// Checks the chat agent's safe text formatter: bold/lists render, HTML stays text, links are allow-listed.
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");

const out = buildSync({
  stdin: {
    contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import RichText from "./src/components/cafy-agent/blocks/RichText";
      export const render = (text) => renderToStaticMarkup(createElement(RichText, { text }));
    `,
    resolveDir: path.resolve(__dirname, ".."),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react-dom"],
});
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { render } = mod.exports;

const bold = render("SOC **2134 Programmers** fits best.");
assert.match(bold, /<strong[^>]*>2134 Programmers<\/strong>/);
assert.doesNotMatch(bold, /\*\*/);

const list = render("Steps:\n- Check the sponsor list\n- Confirm the SOC code\n1. First\n2. Second");
assert.match(list, /<ul[^>]*><li>Check the sponsor list<\/li><li>Confirm the SOC code<\/li><\/ul>/);
assert.match(list, /<ol[^>]*><li>First<\/li><li>Second<\/li><\/ol>/);

const evil = render('<script>alert(1)</script> <img src=x onerror=alert(1)> **ok**');
assert.doesNotMatch(evil, /<script>|<img/);
assert.match(evil, /&lt;script&gt;/);

const links = render("[GOV.UK](https://www.gov.uk/skilled-worker-visa) and [phish](https://evil.example.com/login)");
assert.match(links, /<a href="https:\/\/www.gov.uk\/skilled-worker-visa" target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(links, /evil\.example\.com/);
assert.match(links, /phish/);

console.log("agent rich text: all checks passed");
