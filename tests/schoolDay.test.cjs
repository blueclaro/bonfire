const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const ts = require("typescript");
const { runInNewContext } = require("node:vm");
const source = readFileSync(resolve(__dirname, "../src/lib/schoolDay.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exportsObject = {};
runInNewContext(compiled, { exports: exportsObject, Intl, Date });
const { schoolDayRange } = exportsObject;

for (const [name, instant, start, end] of [
  ["antes da meia-noite local", "2026-09-22T02:59:59.999Z", "2026-09-21T03:00:00.000Z", "2026-09-22T03:00:00.000Z"],
  ["na meia-noite local", "2026-09-22T03:00:00.000Z", "2026-09-22T03:00:00.000Z", "2026-09-23T03:00:00.000Z"],
  ["virada do ano", "2027-01-01T02:00:00Z", "2026-12-31T03:00:00.000Z", "2027-01-01T03:00:00.000Z"],
  ["dia bissexto", "2028-02-29T12:00:00Z", "2028-02-29T03:00:00.000Z", "2028-03-01T03:00:00.000Z"],
  ["início histórico do horário de verão", "2018-11-04T12:00:00Z", "2018-11-04T03:00:00.000Z", "2018-11-05T02:00:00.000Z"],
]) {
  test(name, () => {
    const result = schoolDayRange(new Date(instant));
    assert.equal(result.start, start);
    assert.equal(result.end, end);
  });
}
test("rejeita data inválida", () => {
  assert.throws(() => schoolDayRange(new Date("invalid")), /Data inválida/);
});
