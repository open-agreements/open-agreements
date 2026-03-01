# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![npm downloads](https://img.shields.io/npm/dm/open-agreements.svg)](https://npmjs.org/package/open-agreements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Agent Skill](https://img.shields.io/badge/agent--skill-open--agreements-purple)](https://skills.sh)
[![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml)
[![MCP Server Status](https://img.shields.io/endpoint?url=https%3A%2F%2Fopenagreements.ai%2Fapi%2Fstatus%3Fformat%3Dshields)](https://openagreements.openstatus.dev/)
[![codecov](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements)
[![GitHub stargazers](https://img.shields.io/github/stars/open-agreements/open-agreements?style=social)](https://github.com/open-agreements/open-agreements/stargazers)
[![Tests: Vitest](https://img.shields.io/badge/tests-vitest-6E9F18)](https://vitest.dev/)
[![OpenSpec Traceability](https://img.shields.io/badge/openspec-traceability%20gate-brightgreen)](./scripts/validate_openspec_coverage.mjs)
[![Socket Badge](https://socket.dev/api/badge/npm/package/open-agreements)](https://socket.dev/npm/package/open-agreements)
[![install size](https://packagephobia.com/badge?p=open-agreements)](https://packagephobia.com/result?p=open-agreements)

[English](./README.md) | [Español](./README.es.md) | [简体中文](./README.zh.md) | [Português (Brasil)](./README.pt-br.md) | [Deutsch](./README.de.md)

> **Übersetzungshinweis:** Das englische `README.md` ist die kanonische Quelle. Diese Übersetzung kann kurzzeitig hinterherhinken. Wichtige Änderungen im englischen README sollten innerhalb von 72 Stunden übernommen werden.

<!-- TODO: Add OpenSSF Scorecard badge once repo is indexed at securityscorecards.dev -->
<!-- TODO: Add OpenSSF Best Practices badge after registration at bestpractices.dev -->
<!-- TODO: Re-evaluate Snyk badge — Advisor migrated to security.snyk.io (July 2024) -->

<p align="center">
  <img src="docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude füllt ein Common Paper Mutual NDA in unter 2 Minuten aus. Für Kürze beschleunigt.*

Fülle standardisierte juristische Vertragsvorlagen aus und erzeuge signierbare DOCX-Dateien. Die Vorlagen decken NDAs, Cloud-Bedingungen, Arbeitsdokumente, Contractor-Verträge, SAFEs und NVCA-Finanzierungsdokumente ab.

Entwickelt vom Team hinter [UseJunior.com](https://usejunior.com) — produktiv im Einsatz bei Am Law 100 Kanzleien.

## Qualitäts- und Vertrauenssignale

- CI läuft bei Pull Requests und Pushes auf `main`.
- Der Live-Service-Status wird über OpenStatus unter `openagreements.openstatus.dev` veröffentlicht.
- Die Coverage wird in Codecov veröffentlicht, mit repositorydefinierten Patch-/Projekt-Gates in `codecov.yml`.
- Das aktive JS-Testframework ist Vitest; JUnit-Testergebnisse werden für Codecov-Testanalysen hochgeladen.
- OpenSpec-Szenario-Traceability wird über `npm run check:spec-coverage` erzwungen. Für einen lokalen Matrix-Export führe `npm run check:spec-coverage -- --write-matrix integration-tests/OPENSPEC_TRACEABILITY.md` aus.
- Der Recipe-Source-Drift-Canary (`npm run check:source-drift`) prüft den erwarteten Source-Hash plus strukturelle Replacement-/Normalize-Anker.
- Annahmebasierte Regressionen werden in `docs/assumptions.md` verfolgt und mit gezielten Regressionstests plus CI-Gates validiert.
- Die LibreOffice-basierte DOCX-Visualisierung nutzt eine gepinnte Build-Konfiguration auf macOS (`config/libreoffice-headless.json`); führe vor visuellen Allure-Evidenztests `npm run check:libreoffice` aus.
- Maintainer: [Steven Obiajulu](https://www.linkedin.com/in/steven-obiajulu/) (am MIT ausgebildeter Maschinenbauingenieur; juristisch ausgebildet an Harvard Law).

## So funktioniert es

1. Schritt 1: Vorlage auswählen (36 Standardverträge)
2. Schritt 2: Deine Angaben ausfüllen (interaktive Prompts oder MCP)
3. Schritt 3: Professionell formatierte DOCX-Datei erhalten

OpenAgreements unterstützt zwei Ausführungsmodi mit unterschiedlichen Vertrauensgrenzen:

- Gehosteter Remote-MCP-Connector (`https://openagreements.ai/api/mcp`) für schnelles Setup in Claude.
- Vollständig lokale Paketausführung (`npx`, globale Installation oder lokales stdio-MCP-Paket) für machine-lokale Workflows.

Es gibt keine globale Empfehlung für einen Standardmodus. Wähle je nach Dokument-Sensibilität, interner Policy und gewünschter Workflow-Geschwindigkeit. Siehe `docs/trust-checklist.md` für eine 60-Sekunden-Datenflussübersicht.

### Schnelle Entscheidung

- Wenn dein Dokument sensibel ist, nutze vollständig lokale Paketausführung.
- Wenn du Bequemlichkeit priorisierst, nutze den gehosteten Remote-MCP-Connector.

## Nutzung mit Claude Code

OpenAgreements funktioniert als [Claude Code plugin](https://docs.anthropic.com/en/docs/claude-code/plugins) und [Agent Skill](https://agentskills.io). Keine Vorinstallation erforderlich — Claude lädt und startet die CLI bei Bedarf über `npx`.

### Option 1: Agent Skill (empfohlen)

```bash
npx skills add open-agreements/open-agreements
```

Bitte Claude anschließend, einen Vertrag zu entwerfen:

```
> Draft an NDA between Acme Corp and Beta Inc
```

Claude erkennt verfügbare Vorlagen, fragt Feldwerte interaktiv ab und rendert eine signierbereite DOCX-Datei.

### Option 2: Gemini CLI Extension

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

Bitte Gemini anschließend, einen Vertrag zu entwerfen. Die Extension stellt MCP-Tools, Kontextdateien und Skills für Template-Discovery und Befüllung bereit.

### Option 3: Direkt mit Claude Code

Wenn du Node.js >= 20 hast, frage Claude einfach:

```
> Fill the Common Paper mutual NDA for my company
```

Claude führt `npx -y open-agreements@latest list --json` zur Vorlagenerkennung aus und danach `npx -y open-agreements@latest fill <template>` für die Ausgabe. Keine Installation.

### Option 4: CLI

```bash
# Install globally
npm install -g open-agreements

# List available templates
open-agreements list

# Fill a template
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx
```

### Was passiert

1. Claude führt `list --json` aus, um verfügbare Vorlagen und Felder zu erkennen
2. Claude fragt Feldwerte ab (nach Abschnitten gruppiert, bis zu 4 Fragen pro Runde)
3. Claude führt `fill <template>` aus, um eine DOCX mit unverändertem Originalformat zu rendern
4. Du prüfst und unterschreibst das Ausgabedokument

## Nutzung mit Cursor

Dieses Repository enthält ein Cursor-Plugin-Manifest mit MCP-Verdrahtung:

- Plugin manifest: `.cursor-plugin/plugin.json`
- MCP config: `mcp.json`
- Skill: `skills/open-agreements/SKILL.md`

Das Standard-MCP-Setup in `mcp.json` enthält:

- Gehosteten OpenAgreements-MCP-Connector (`https://openagreements.ai/api/mcp`)
- Lokalen Workspace-MCP-Server (`npx -y @open-agreements/contracts-workspace-mcp`)
- Lokalen Template-Drafting-MCP-Server (`npx -y @open-agreements/contract-templates-mcp`)

Um dieses Plugin im Cursor Marketplace zu veröffentlichen, reiche dieses Repository ein unter:

- https://cursor.com/marketplace/publish

## Vorlagen

28 Vorlagen in drei Tiers. Führe `open-agreements list` aus, um das vollständige Inventar zu sehen.

| Tier | Anzahl | Quelle | Funktionsweise |
|------|-------|--------|--------------|
| Interne Vorlagen | 17 | [Common Paper](https://commonpaper.com), [Bonterms](https://bonterms.com), OpenAgreements | Im Paket enthalten, CC BY 4.0 |
| Externe Vorlagen | 4 | [Y Combinator](https://www.ycombinator.com/documents) | Unverändert vendored, CC BY-ND 4.0 |
| Recipes | 7 | [NVCA](https://nvca.org/model-legal-documents/) | Bei Bedarf heruntergeladen (nicht redistributable) |

**Interne Vorlagen** (NDAs, Cloud-Bedingungen, Beschäftigungsformulare, Contractor-Verträge usw.) sind CC BY 4.0 — wir liefern DOCX-Dateien mit `{tag}`-Platzhaltern.

**Externe Vorlagen** (YC SAFEs) sind CC BY-ND 4.0 — wir übernehmen das Original unverändert. Die ausgefüllte Ausgabe ist ein transient derivative auf deinem Rechner.

**Recipes** (NVCA-Finanzierungsdokumente) sind frei herunterladbar, aber nicht redistributable — wir liefern nur Transformationsanweisungen und laden die Source-DOCX zur Laufzeit von nvca.org.

### Guidance-Extraktion

Source-Dokumente enthalten Expertenkommentare — Fußnoten, Drafting-Hinweise, `[Comment: ...]`-Blöcke — von Domänenexpert:innen (z. B. Wertpapierrechtler:innen). Der Recipe-Cleaner entfernt diese Inhalte, um ein ausfüllbares Dokument zu erzeugen, kann sie aber auch als strukturiertes JSON extrahieren:

```bash
open-agreements recipe clean source.docx -o cleaned.docx \
  --recipe nvca-indemnification-agreement \
  --extract-guidance guidance.json
```

Das erzeugt eine `guidance.json` mit jeder entfernten Fußnote, jedem Kommentar und jedem Drafting-Hinweis, getaggt nach Quelltyp und Dokumentposition. Guidance ist ein lokales Artefakt (wird nicht committed oder ausgeliefert), das AI-Agenten oder menschliche Autor:innen beim Ausfüllen referenzieren können. Siehe [Adding Recipes — Guidance Extraction](docs/adding-recipes.md#guidance-extraction) für Formatdetails.

**Warum programmgesteuerte Extraktion?** Das Source-Dokument ist die Single Source of Truth. Nach einem Publisher-Update liefert erneute Extraktion ohne manuelle Arbeit aktuelle Guidance, bewahrt die exakte Sprache von Domänenexpert:innen und erfasst alles — eine KI kann ad hoc zusammenfassen, aber verworfene Inhalte nicht wiederherstellen.

Jede Vorlage ist ein eigenständiges Verzeichnis:

```
content/templates/<name>/
├── template.docx     # DOCX with {tag} placeholders
├── metadata.yaml     # Fields, license, source, attribution
└── README.md         # Template-specific documentation
```

## CLI-Befehle

### `fill <template>`

Rendert eine ausgefüllte DOCX aus einer Vorlage.

```bash
# Using a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# Using inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Führt die Validierungspipeline für eine oder alle Vorlagen aus.

```bash
open-agreements validate                          # All templates
open-agreements validate common-paper-mutual-nda  # One template
```

### `list`

Zeigt verfügbare Vorlagen mit Lizenzinformationen und Feldanzahl.

```bash
open-agreements list

# Machine-readable JSON output (for agent skills and automation)
open-agreements list --json
```

## Contracts Workspace CLI (separates Paket)

OpenAgreements enthält jetzt ein Schwesterpaket für Repository-/Workspace-Operationen:

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Docs: `docs/contracts-workspace.md`

Dieses Paket ist bewusst von `open-agreements` getrennt, sodass Teams nutzen können:

- nur Template-Befüllung
- nur Workspace-Management
- oder beides zusammen

Kernfunktionen des Workspace-Pakets:

- topic-first `init`-Planung (minimale empfohlene Struktur mit Top-Level-Domänen)
- Form-Katalog mit URL- und SHA-256-Validierung
- YAML-Status-Indexierung und Linting mit dateinamengetriebenem `_executed`-Status

Das v1-Modell ist rein dateisystembasiert und funktioniert in lokal synchronisierten Cloud-Drive-Ordnern (z. B. Google-Drive-Sync). Keine Drive-API-/OAuth-Integration erforderlich.

## Lokales MCP für Workspace-Demo

Für lokale Connector-Demos gibt es ein lokales stdio-MCP-Paket:

- Package: `@open-agreements/contracts-workspace-mcp`
- Binary: `open-agreements-workspace-mcp`
- Docs: `docs/contracts-workspace.md`

Schnellstart:

```bash
npm run build:workspace-mcp
node packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

## Lokales MCP für Template-Drafting

Für lokale Gemini-/Cursor-Template-Drafting-Workflows nutze:

- Package: `@open-agreements/contract-templates-mcp`
- Binary: `open-agreements-contract-templates-mcp`

Schnellstart:

```bash
npm run build:contract-templates-mcp
node packages/contract-templates-mcp/bin/open-agreements-contract-templates-mcp.js
```

## Website (Vercel)

Eine statische Marketing-Site wird aus `site/` mit Eleventy erzeugt.

- Entry points: `site/index.njk`, `site/templates.njk`, `site/template-detail.njk`
- Styles: `site/styles.css`
- Demo media: `site/assets/demo-fill-nda.gif`
- Deployment config: `vercel.json`
- Discovery outputs (generated during `npm run build:site`): `_site/llms.txt`, `_site/llms-full.txt`, `_site/sitemap.xml`, `_site/robots.txt`

Lokale Vorschau:

```bash
npm run build:site
python3 -m http.server 8080 --directory _site
```

Öffne dann `http://localhost:8080`.

Vercel-Deploy-Hinweise:

- Importiere dieses Repository in Vercel
- Belasse das Projekt-Root auf dem Repository-Root
- Das enthaltene `vercel.json` deployt `_site/` als statische Ausgabe

## Optionale Content-Roots (Future-Proofing)

Um logische Entkopplung bei wachsenden Form-Bibliotheken zu unterstützen, kann `open-agreements` Inhalte aus zusätzlichen Roots laden über:

- env var: `OPEN_AGREEMENTS_CONTENT_ROOTS`
- format: pfadgetrennte Liste absoluter/relativer Verzeichnisse (z. B. `dirA:dirB` auf macOS/Linux)
- erwartete Struktur unter jedem Root: `templates/`, `external/` und/oder `recipes/` (oder verschachtelt unter `content/`)

Lookup-Priorität:

1. Roots in `OPEN_AGREEMENTS_CONTENT_ROOTS` (in der angegebenen Reihenfolge)
2. gebündelter Package-Content (Standard-Fallback)

So bleiben Standardinstallationen einfach, während fortgeschrittene Nutzer große Content-Bibliotheken außerhalb des Kernpakets ablegen können.

## Mitwirken

Siehe [CONTRIBUTING.md](CONTRIBUTING.md), um Vorlagen, Recipes und andere Verbesserungen hinzuzufügen.

- [Adding templates](docs/adding-templates.md) (CC BY 4.0 / CC0-Quellen)
- [Adding recipes](docs/adding-recipes.md) (nicht redistributable Quellen)
- [Employment source policy](docs/employment-source-policy.md) (Trust- und Terms-Klassifikationen)
- [Code of Conduct](CODE_OF_CONDUCT.md) (Community-Erwartungen und Durchsetzung)

## Releasing

Releases laufen automatisiert über GitHub Actions mit npm Trusted Publishing (OIDC) und aktivierter Provenance.

1. Aktualisiere Versionen im Root-Package und in veröffentlichbaren MCP-Packages.
2. Push Commit + Tag mit `git push origin main --tags`
3. Führe den lokalen Gemini-Extension-Gate aus (nach `~/.gemini/extensions/open-agreements` kopieren/symlinken und prüfen, dass beide lokalen MCP-Server starten/antworten).
4. Der `Release`-Workflow veröffentlicht vom Tag, nachdem Build, Validierung, Tests, isolierter Runtime-Smoke und Package-Checks gelaufen sind.

Workflow-Geländer:

- Tag muss zu Root- und veröffentlichbaren Package-Versionen passen
- Release-Commit muss in `origin/main` enthalten sein
- Publish schlägt fehl, wenn eine Zielversion auf npm bereits existiert

## Architektur

- **Language**: TypeScript
- **DOCX Engine**: [docx-templates](https://www.npmjs.com/package/docx-templates) (MIT)
- **CLI**: [Commander.js](https://www.npmjs.com/package/commander)
- **Validation**: [Zod](https://www.npmjs.com/package/zod) schemas
- **Skill Pattern**: Agent-agnostic `ToolCommandAdapter` interface

```
content/                    # All content directories
├── templates/              # Internal templates (CC BY 4.0)
├── external/               # External templates (CC BY-ND 4.0)
└── recipes/                # Recipes (downloaded at runtime)

src/                        # TypeScript source + collocated unit tests
├── cli/                    # Commander.js CLI
├── commands/               # fill, validate, list, recipe, scan
├── core/
│   ├── engine.ts           # docx-templates wrapper
│   ├── metadata.ts         # Zod schemas + loader
│   ├── recipe/             # Recipe pipeline (clean → patch → fill → verify)
│   ├── external/           # External template support
│   ├── validation/         # template, license, output, recipe
│   └── command-generation/
│       ├── types.ts        # ToolCommandAdapter interface
│       └── adapters/       # Claude Code adapter
└── index.ts                # Public API

integration-tests/          # Integration and end-to-end tests
```

## Ressourcen

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Plugins Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [Agent Skills Specification](https://agentskills.io)

## Lizenz

MIT

Template-Inhalte sind von ihren jeweiligen Autor:innen lizenziert — CC BY 4.0 (Common Paper, Bonterms), CC BY-ND 4.0 (Y Combinator) oder proprietär (NVCA, Laufzeit-Download). Siehe `metadata.yaml` jeder Vorlage für Details.

## Haftungsausschluss

Dieses Tool erzeugt Dokumente aus Standardvorlagen. Es bietet keine Rechtsberatung. Eine Zugehörigkeit zu oder Billigung durch Common Paper, Bonterms, Y Combinator, NVCA oder andere Vorlagenquellen ist nicht impliziert. Konsultiere für Rechtsberatung eine Anwältin oder einen Anwalt.
