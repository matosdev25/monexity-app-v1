// Hooks de resolución para ejecutar los tests TS con Node nativo (sin dependencias):
//   node --import ./tests/support/register.mjs --test tests/tilopay/*.test.ts
// Resuelve el alias "@/", añade la extensión .ts y sustituye "server-only".
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: pathToFileURL(path.join(root, "tests/support/server-only-stub.mjs")).href, shortCircuit: true };
  }

  let base = null;
  if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (base && !path.extname(base)) {
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }

  return next(base ? pathToFileURL(base).href : specifier, context);
}
