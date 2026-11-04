// 15. Los secretos de Tilopay nunca llegan al bundle cliente.
// Escaneo estático: módulos con credenciales son server-only, ningún componente
// "use client" los importa y no existe ninguna variable NEXT_PUBLIC_TILOPAY*.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "graphify-out", "tests"].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(root).map((file) => ({ file, rel: path.relative(root, file), src: readFileSync(file, "utf8") }));

test("15a. módulos Tilopay con credenciales o red son server-only", () => {
  for (const name of ["config.ts", "client.ts", "service.ts"]) {
    const src = readFileSync(path.join(root, "lib/billing/tilopay", name), "utf8");
    assert.match(src, /^import "server-only";/m, name);
  }
});

test("15b. ningún componente cliente importa módulos Tilopay ni lee sus variables", () => {
  const clientFiles = files.filter(({ src }) => /^\s*["']use client["'];?/m.test(src.slice(0, 200)));
  assert.ok(clientFiles.length > 0);
  for (const { rel, src } of clientFiles) {
    assert.doesNotMatch(src, /lib\/billing\/tilopay/, rel);
    assert.doesNotMatch(src, /TILOPAY_/, rel);
  }
});

test("15c. no existen variables públicas de Tilopay y las credenciales solo se leen en config.ts", () => {
  for (const { rel, src } of files) {
    assert.doesNotMatch(src, /NEXT_PUBLIC_TILOPAY/, rel);
    if (/TILOPAY_API_(USER|PASSWORD|KEY)/.test(src) && /process\.env/.test(src)) {
      assert.equal(rel, path.join("lib", "billing", "tilopay", "config.ts"), rel);
    }
  }
});

test("15d. core.ts y flow.ts no leen process.env (sin secretos en lógica pura)", () => {
  for (const name of ["core.ts", "flow.ts"]) {
    const src = readFileSync(path.join(root, "lib/billing/tilopay", name), "utf8");
    assert.doesNotMatch(src, /process\.env/, name);
  }
});
