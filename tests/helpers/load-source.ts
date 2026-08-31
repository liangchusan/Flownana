import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Load actual server source while replacing only explicitly named boundaries. */
export function createSourceLoader(overrides: Record<string, unknown>) {
  const cache = new Map<string, { exports: unknown }>();
  function load<T>(relativePath: string): T {
    const path = resolve(root, relativePath);
    const cached = cache.get(path);
    if (cached) return cached.exports as T;
    const loaded = { exports: {} };
    cache.set(path, loaded);
    const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const require = createRequire(path);
    new Function("require", "module", "exports", compiled)((name: string) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        let dependency = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(path), name);
        if (!extname(dependency)) dependency += existsSync(`${dependency}.ts`) ? ".ts" : ".tsx";
        return load(dependency);
      }
      return require(name);
    }, loaded, loaded.exports);
    return loaded.exports as T;
  }
  return load;
}
