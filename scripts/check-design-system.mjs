import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoots = ["app", "components"];
const sourceExtensions = new Set([".ts", ".tsx", ".css"]);
const requiredFiles = [
  "AGENTS.md",
  "MEMORY.md",
  "DESIGN.md",
  "components.json",
  "app/globals.css",
  "tailwind.config.ts",
  "components/ui/button.tsx",
  "components/ui/card.tsx",
  "components/ui/input.tsx",
  "components/ui/textarea.tsx",
];

const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }

  return files;
}

for (const requiredFile of requiredFiles) {
  try {
    await readFile(join(root, requiredFile), "utf8");
  } catch {
    violations.push(`${requiredFile}: required design-system file is missing`);
  }
}

for (const sourceRoot of sourceRoots) {
  const files = await collectFiles(join(root, sourceRoot));

  for (const file of files) {
    const projectPath = relative(root, file);
    const content = await readFile(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      if (/(?:bg|text|border|ring|from|via|to)-(?:slate|gray)-/.test(line)) {
        violations.push(
          `${projectPath}:${lineNumber}: use warm semantic tokens or Stone/Zinc instead of Slate/Gray`
        );
      }

      if (/style=\{\{/.test(line)) {
        violations.push(
          `${projectPath}:${lineNumber}: inline styles are prohibited; use Tailwind classes`
        );
      }

      if (/(?<!max-)w-\[(?:[5-9]\d{2}|\d{4,})px\]/.test(line)) {
        violations.push(
          `${projectPath}:${lineNumber}: large fixed pixel widths are prohibited; use w-full with max-w-*`
        );
      }

      if (
        projectPath !== "components/ui/logo.tsx" &&
        /(?:bg|text|border|ring|from|via|to)-\[#[0-9a-fA-F]{3,8}\]/.test(line)
      ) {
        violations.push(
          `${projectPath}:${lineNumber}: arbitrary JSX colors are prohibited; add or reuse a semantic token`
        );
      }
    });
  }
}

if (violations.length > 0) {
  console.error("Design-system check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Design-system check passed.");
