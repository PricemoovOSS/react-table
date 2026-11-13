// Weight of the published ES modules (`yarn build` first): fails when the library outgrows its budget.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/**
 * Sum of the gzipped modules of dist/esm, in bytes: 43 340 for 5.0.0.
 * Raise it on purpose only, with what the added weight buys.
 */
const BUDGET = 44800;
const DIRECTORY = path.join(__dirname, "..", "dist", "esm");

const listModules = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? listModules(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
    )
    .filter((file) => file.endsWith(".js"));

if (!fs.existsSync(DIRECTORY)) {
  console.error("dist/esm is missing: run `yarn build` first.");
  process.exit(1);
}

const modules = listModules(DIRECTORY).map((file) => ({
  file: path.relative(DIRECTORY, file),
  size: zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length,
}));
const total = modules.reduce((sum, module) => sum + module.size, 0);

console.log(`ES modules: ${modules.length} files, ${total} bytes gzipped (budget ${BUDGET}).`);
if (total > BUDGET) {
  const heaviest = modules.sort((a, b) => b.size - a.size).slice(0, 8);
  console.error(`Over budget by ${total - BUDGET} bytes. Heaviest modules:`);
  heaviest.forEach((module) => console.error(`  ${String(module.size).padStart(6)}  ${module.file}`));
  process.exit(1);
}
