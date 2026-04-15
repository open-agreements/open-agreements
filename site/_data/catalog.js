import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCatalog,
  prepareCatalogDownloads,
} from "../../scripts/lib/catalog-data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

export default function () {
  const catalog = buildCatalog({ rootDir: root });
  prepareCatalogDownloads({
    rootDir: root,
    templates: catalog.templates,
    downloadsDir: resolve(__dirname, "..", "downloads"),
  });
  return catalog;
}
