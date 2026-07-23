import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT_PACKAGE_PATH = path.resolve("package.json");
const SCOPED_PACKAGE_NAME = "@open-agreements/open-agreements";
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";

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

function getRootBundledPackages() {
  const npmCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-agreements-npm-pack-"));

  try {
    const packOutput = execFileSync(
      NPM_COMMAND,
      ["pack", "--dry-run", "--json", "--ignore-scripts", "--offline", "--cache", npmCacheDir],
      {
        cwd: path.dirname(ROOT_PACKAGE_PATH),
        encoding: "utf8",
        env: {
          ...process.env,
          NO_UPDATE_NOTIFIER: "1",
          npm_config_update_notifier: "false"
        },
        maxBuffer: 50 * 1024 * 1024
      }
    );
    const packMetadata = JSON.parse(packOutput);
    const bundledPackages = packMetadata[0]?.bundled;
    if (!Array.isArray(bundledPackages)) {
      throw new Error("Root npm pack metadata must contain a bundled array.");
    }
    return bundledPackages;
  } finally {
    fs.rmSync(npmCacheDir, { recursive: true, force: true });
  }
}

function copyBundledPackages(packageNames, outDir) {
  for (const packageName of packageNames) {
    const sourcePath = path.resolve("node_modules", packageName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing bundled package in root node_modules: ${packageName}`);
    }

    const destinationPath = path.join(outDir, "node_modules", packageName);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
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
copyBundledPackages(getRootBundledPackages(), outDir);
fs.writeFileSync(path.join(outDir, "package.json"), `${JSON.stringify(scopedPackageJson, null, 2)}\n`);
process.stdout.write(`${outDir}\n`);
