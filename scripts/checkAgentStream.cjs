// Checks the chat agent's SSE parser: events split across network chunks, CRLF endings,
// malformed and unknown events. Bundles the TS module with esbuild, then runs it in Node.
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildSync } = require("esbuild");

const out = buildSync({
  entryPoints: [path.resolve(__dirname, "../src/services/agentStream.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const mod = { exports: {} };
new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
const { createSseParser } = mod.exports;

function collect(chunks) {
  const events = [];
  const parser = createSseParser((event) => events.push(event));
  chunks.forEach((chunk) => parser.feed(chunk));
  parser.end();
  return events;
}

const stream =
  'data: {"type":"status","id":"think","label":"Understanding your question","state":"running"}\n\n' +
  'data: {"type":"text","delta":"Hello "}\n\n' +
  'data: {"type":"text","delta":"there."}\n\n' +
  'data: {"type":"done","steps":1}\n\n';

const whole = collect([stream]);
assert.deepEqual(whole.map((e) => e.type), ["status", "text", "text", "done"]);

// Every possible split point must give the same events.
for (let i = 1; i < stream.length; i++) {
  assert.deepEqual(collect([stream.slice(0, i), stream.slice(i)]), whole, `split at ${i}`);
}
// One character at a time.
assert.deepEqual(collect(stream.split("")), whole);

// CRLF line endings.
assert.deepEqual(collect([stream.replace(/\n/g, "\r\n")]).map((e) => e.type), ["status", "text", "text", "done"]);

// Malformed JSON and unknown event types are skipped; the rest still arrive.
const noisy = 'data: {not json}\n\ndata: {"type":"hack"}\n\ndata: {"type":"done","steps":2}\n\n';
assert.deepEqual(collect([noisy]), [{ type: "done", steps: 2 }]);

// A final event without a trailing blank line is flushed on end().
assert.deepEqual(collect(['data: {"type":"done","steps":3}']), [{ type: "done", steps: 3 }]);

console.log("agent stream parser: all checks passed");
