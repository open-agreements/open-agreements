import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT_PACKAGE_PATH = path.resolve("package.json");
const SCOPED_PACKAGE_NAME = "@open-agreements/open-agreements";

function parseOutDir(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out-dir") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--out-dir requires a value");
      }
      return path.resolve(next);
    }
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), "open-agreements-scoped-"));
}

function copyPublishFiles(files, outDir) {
  for (const relativePath of files) {
    const sourcePath = path.resolve(relativePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing publish file path: ${relativePath}`);
    }

    const destinationPath = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    const sourceStat = fs.statSync(sourcePath);
    if (sourceStat.isDirectory()) {
      fs.cpSync(sourcePath, destinationPath, { recursive: true });
      continue;
    }
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

const outDir = parseOutDir(process.argv.slice(2));
const packageJsonRaw = fs.readFileSync(ROOT_PACKAGE_PATH, "utf8");
const rootPackageJson = JSON.parse(packageJsonRaw);

if (!Array.isArray(rootPackageJson.files) || rootPackageJson.files.length === 0) {
  throw new Error("Root package.json must define a non-empty files array.");
}

const scopedPackageJson = {
  ...rootPackageJson,
  name: SCOPED_PACKAGE_NAME,
  publishConfig: {
    ...(rootPackageJson.publishConfig ?? {}),
    access: "public"
  }
};

if (scopedPackageJson.scripts && typeof scopedPackageJson.scripts === "object") {
  delete scopedPackageJson.scripts.prepare;
}

fs.mkdirSync(outDir, { recursive: true });
copyPublishFiles(rootPackageJson.files, outDir);
fs.writeFileSync(path.join(outDir, "package.json"), `${JSON.stringify(scopedPackageJson, null, 2)}\n`);
process.stdout.write(`${outDir}\n`);
