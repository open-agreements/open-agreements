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

> **Nota de traducción:** `README.md` en inglés es la fuente canónica de verdad. Esta traducción puede tener un pequeño retraso. Los cambios importantes del README en inglés deben propagarse en un plazo de 72 horas.

<!-- TODO: Add OpenSSF Scorecard badge once repo is indexed at securityscorecards.dev -->
<!-- TODO: Add OpenSSF Best Practices badge after registration at bestpractices.dev -->
<!-- TODO: Re-evaluate Snyk badge — Advisor migrated to security.snyk.io (July 2024) -->

<p align="center">
  <img src="docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude completa un Mutual NDA de Common Paper en menos de 2 minutos. Acelerado para brevedad.*

Completa plantillas estándar de acuerdos legales y genera archivos DOCX listos para firma. Las plantillas cubren NDAs, términos cloud, documentos laborales, acuerdos con contratistas, SAFEs y documentos de financiamiento NVCA.

Creado por el equipo detrás de [UseJunior.com](https://usejunior.com) — en producción en firmas Am Law 100.

## Calidad y señales de confianza

- CI se ejecuta en pull requests y en pushes a `main`.
- La salud del servicio en vivo se publica a través de OpenStatus en `openagreements.openstatus.dev`.
- La cobertura se publica en Codecov con compuertas de patch/proyecto definidas en el repositorio en `codecov.yml`.
- El framework de pruebas JS activo es Vitest, con resultados JUnit subidos para análisis de pruebas en Codecov.
- La trazabilidad de escenarios de OpenSpec se aplica mediante `npm run check:spec-coverage`. Para exportar una matriz local, ejecuta `npm run check:spec-coverage -- --write-matrix integration-tests/OPENSPEC_TRACEABILITY.md`.
- El canario de deriva de fuentes de recetas (`npm run check:source-drift`) verifica el hash esperado de la fuente junto con anclas estructurales de reemplazo/normalización.
- Las regresiones a nivel de supuestos se rastrean en `docs/assumptions.md` y se validan con pruebas de regresión dirigidas + compuertas de CI.
- El renderizado visual DOCX con LibreOffice usa una configuración fijada en macOS (`config/libreoffice-headless.json`); ejecuta `npm run check:libreoffice` antes de pruebas visuales de evidencia de Allure.
- Maintainer: [Steven Obiajulu](https://www.linkedin.com/in/steven-obiajulu/) (ingeniero mecánico formado en MIT; abogado formado en Harvard Law).

## Cómo funciona

1. Paso 1: Elige una plantilla (36 acuerdos estándar)
2. Paso 2: Completa tus datos (prompts interactivos o MCP)
3. Paso 3: Obtén un DOCX con formato profesional

OpenAgreements admite dos modos de ejecución con límites de confianza diferentes:

- Conector MCP remoto alojado (`https://openagreements.ai/api/mcp`) para configuración rápida en Claude.
- Ejecución totalmente local del paquete (`npx`, instalación global o paquete MCP local por stdio) para flujos de trabajo locales en tu máquina.

No existe una recomendación de modo global por defecto. Elige según sensibilidad del documento, políticas internas y necesidades de velocidad del flujo de trabajo. Consulta `docs/trust-checklist.md` para un resumen de flujo de datos en 60 segundos.

### Decisión rápida

- Si tu documento es sensible, usa ejecución totalmente local del paquete.
- Si priorizas conveniencia, usa el conector MCP remoto alojado.

## Uso con Claude Code

OpenAgreements funciona como [plugin de Claude Code](https://docs.anthropic.com/en/docs/claude-code/plugins) y [Agent Skill](https://agentskills.io). No se requiere instalación previa: Claude descarga y ejecuta el CLI bajo demanda vía `npx`.

### Opción 1: Agent Skill (recomendado)

```bash
npx skills add open-agreements/open-agreements
```

Luego pide a Claude que redacte un acuerdo:

```
> Draft an NDA between Acme Corp and Beta Inc
```

Claude descubre las plantillas disponibles, te entrevista para obtener los valores de campos y genera un DOCX listo para firma.

### Opción 2: Extensión Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

Luego pide a Gemini que redacte un acuerdo. La extensión proporciona herramientas MCP, archivos de contexto y skills para descubrimiento y llenado de plantillas.

### Opción 3: Directo con Claude Code

Si tienes Node.js >= 20, solo pídeselo a Claude:

```
> Fill the Common Paper mutual NDA for my company
```

Claude ejecuta `npx -y open-agreements@latest list --json` para descubrir plantillas, y luego `npx -y open-agreements@latest fill <template>` para generar el resultado. Cero instalación.

### Opción 4: CLI

```bash
# Install globally
npm install -g open-agreements

# List available templates
open-agreements list

# Fill a template
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx
```

### Qué sucede

1. Claude ejecuta `list --json` para descubrir plantillas disponibles y sus campos
2. Claude te entrevista para obtener valores de campos (agrupados por sección, hasta 4 preguntas por ronda)
3. Claude ejecuta `fill <template>` para generar un DOCX preservando todo el formato original
4. Revisas y firmas el documento de salida

## Uso con Cursor

Este repositorio incluye un manifiesto de plugin de Cursor con integración MCP:

- Plugin manifest: `.cursor-plugin/plugin.json`
- MCP config: `mcp.json`
- Skill: `skills/open-agreements/SKILL.md`

La configuración MCP por defecto en `mcp.json` incluye:

- Conector MCP OpenAgreements alojado (`https://openagreements.ai/api/mcp`)
- Servidor MCP local de workspace (`npx -y @open-agreements/contracts-workspace-mcp`)
- Servidor MCP local para redacción de plantillas (`npx -y @open-agreements/contract-templates-mcp`)

Para publicar este plugin en Cursor Marketplace, envía este repositorio en:

- https://cursor.com/marketplace/publish

## Plantillas

28 plantillas en tres niveles. Ejecuta `open-agreements list` para el inventario completo.

| Nivel | Cantidad | Fuente | Cómo funciona |
|------|-------|--------|--------------|
| Plantillas internas | 17 | [Common Paper](https://commonpaper.com), [Bonterms](https://bonterms.com), OpenAgreements | Incluidas en el paquete, CC BY 4.0 |
| Plantillas externas | 4 | [Y Combinator](https://www.ycombinator.com/documents) | Vendorizadas sin cambios, CC BY-ND 4.0 |
| Recipes | 7 | [NVCA](https://nvca.org/model-legal-documents/) | Se descargan bajo demanda (no redistribuibles) |

**Plantillas internas** (NDAs, términos cloud, formularios laborales, acuerdos con contratistas, etc.) están bajo CC BY 4.0: enviamos el DOCX con placeholders `{tag}`.

**Plantillas externas** (YC SAFEs) están bajo CC BY-ND 4.0: vendorizamos el original sin cambios. El resultado completado es un derivado transitorio en tu máquina.

**Recipes** (documentos de financiamiento NVCA) se pueden descargar libremente pero no son redistribuibles: enviamos solo instrucciones de transformación y descargamos el DOCX fuente desde nvca.org en tiempo de ejecución.

### Extracción de guidance

Los documentos fuente contienen comentarios expertos (notas al pie, notas de redacción, bloques `[Comment: ...]`) escritos por especialistas del dominio (por ejemplo, abogados de valores). El limpiador de recipes elimina ese contenido para producir un documento rellenable, pero también puede extraerlo como JSON estructurado:

```bash
open-agreements recipe clean source.docx -o cleaned.docx \
  --recipe nvca-indemnification-agreement \
  --extract-guidance guidance.json
```

Esto produce un `guidance.json` con cada nota al pie, comentario y nota de redacción removidos, etiquetados por tipo de fuente y posición en el documento. El guidance es un artefacto solo local (no se commitea ni se distribuye) que agentes de IA o autores humanos pueden consultar al completar el formulario. Consulta [Adding Recipes — Guidance Extraction](docs/adding-recipes.md#guidance-extraction) para detalles de formato.

**¿Por qué extracción programática?** El documento fuente es la fuente única de verdad. Re-ejecutar la extracción tras una actualización del editor produce guidance fresco sin esfuerzo manual, preserva el lenguaje exacto de expertos de dominio y captura todo: una IA puede resumir sobre la marcha, pero no puede recuperar contenido descartado.

Cada plantilla es un directorio autocontenido:

```
content/templates/<name>/
├── template.docx     # DOCX with {tag} placeholders
├── metadata.yaml     # Fields, license, source, attribution
└── README.md         # Template-specific documentation
```

## Comandos CLI

### `fill <template>`

Genera un DOCX completado desde una plantilla.

```bash
# Using a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# Using inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Ejecuta el pipeline de validación sobre una o todas las plantillas.

```bash
open-agreements validate                          # All templates
open-agreements validate common-paper-mutual-nda  # One template
```

### `list`

Muestra las plantillas disponibles con información de licencia y conteo de campos.

```bash
open-agreements list

# Machine-readable JSON output (for agent skills and automation)
open-agreements list --json
```

## CLI de Contracts Workspace (paquete separado)

OpenAgreements ahora incluye un paquete hermano para operaciones de repositorio/workspace:

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Docs: `docs/contracts-workspace.md`

Este paquete está intencionalmente separado de `open-agreements` para que los equipos puedan adoptar:

- solo llenado de plantillas
- solo gestión de workspace
- o ambos juntos

Funciones principales de workspace:

- planificación `init` orientada por temas (estructura mínima sugerida con dominios de nivel superior)
- catálogo de formularios con validación de URL + SHA-256
- indexación y linting de estado YAML con estado `_executed` basado en nombre de archivo

El modelo v1 es solo de sistema de archivos y funciona en carpetas de nube sincronizadas localmente (por ejemplo, sincronización de Google Drive). No se requiere integración Drive API/OAuth.

## MCP local para demo de workspace

Para demos de conectores locales, hay un paquete MCP local por stdio:

- Package: `@open-agreements/contracts-workspace-mcp`
- Binary: `open-agreements-workspace-mcp`
- Docs: `docs/contracts-workspace.md`

Inicio rápido:

```bash
npm run build:workspace-mcp
node packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

## MCP local para redacción de plantillas

Para flujos locales Gemini/Cursor de redacción de plantillas, usa:

- Package: `@open-agreements/contract-templates-mcp`
- Binary: `open-agreements-contract-templates-mcp`

Inicio rápido:

```bash
npm run build:contract-templates-mcp
node packages/contract-templates-mcp/bin/open-agreements-contract-templates-mcp.js
```

## Sitio web (Vercel)

Un sitio de marketing estático se genera desde `site/` con Eleventy.

- Entry points: `site/index.njk`, `site/templates.njk`, `site/template-detail.njk`
- Styles: `site/styles.css`
- Demo media: `site/assets/demo-fill-nda.gif`
- Deployment config: `vercel.json`
- Discovery outputs (generated during `npm run build:site`): `_site/llms.txt`, `_site/llms-full.txt`, `_site/sitemap.xml`, `_site/robots.txt`

Vista previa local:

```bash
npm run build:site
python3 -m http.server 8080 --directory _site
```

Luego abre `http://localhost:8080`.

Notas de despliegue en Vercel:

- Importa este repositorio en Vercel
- Mantén la raíz del proyecto como la raíz del repositorio
- El `vercel.json` incluido despliega `_site/` como salida estática

## Raíces de contenido opcionales (preparado para futuro)

Para soportar desacoplamiento lógico a medida que crecen las bibliotecas de formularios, `open-agreements` puede cargar contenido desde raíces adicionales mediante:

- env var: `OPEN_AGREEMENTS_CONTENT_ROOTS`
- format: lista delimitada por separador de rutas de directorios absolutos/relativos (por ejemplo, `dirA:dirB` en macOS/Linux)
- estructura esperada bajo cada raíz: `templates/`, `external/`, y/o `recipes/` (o anidados bajo `content/`)

La precedencia de búsqueda es:

1. raíces en `OPEN_AGREEMENTS_CONTENT_ROOTS` (en el orden listado)
2. contenido del paquete incluido (fallback por defecto)

Esto mantiene simples las instalaciones por defecto y permite a usuarios avanzados mover bibliotecas de contenido grandes fuera del paquete principal.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para agregar plantillas, recipes y otras mejoras.

- [Adding templates](docs/adding-templates.md) (CC BY 4.0 / fuentes CC0)
- [Adding recipes](docs/adding-recipes.md) (fuentes no redistribuibles)
- [Employment source policy](docs/employment-source-policy.md) (clasificaciones de confianza y términos)
- [Code of Conduct](CODE_OF_CONDUCT.md) (expectativas de comunidad y cumplimiento)

## Lanzamientos

Los lanzamientos están automatizados mediante GitHub Actions usando publicación confiable de npm (OIDC) con provenance habilitado.

1. Actualiza versiones en el paquete raíz + paquetes MCP publicables.
2. Haz push del commit + etiqueta con `git push origin main --tags`
3. Ejecuta la compuerta local de extensión Gemini (copia/symlink en `~/.gemini/extensions/open-agreements` y verifica que ambos servidores MCP locales inicien/respondan).
4. El workflow `Release` publica desde la etiqueta después de ejecutar build, validación, pruebas, smoke de runtime aislado y chequeos de paquete.

Compuertas del workflow:

- la etiqueta debe coincidir con las versiones del paquete raíz + paquetes publicables
- el commit de release debe estar contenido en `origin/main`
- la publicación falla si alguna versión objetivo en npm ya existe

## Arquitectura

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

## Recursos

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Plugins Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [Agent Skills Specification](https://agentskills.io)

## Licencia

MIT

El contenido de plantillas está licenciado por sus respectivos autores: CC BY 4.0 (Common Paper, Bonterms), CC BY-ND 4.0 (Y Combinator) o propietario (NVCA, descargado en tiempo de ejecución). Consulta `metadata.yaml` de cada plantilla para más detalles.

## Descargo de responsabilidad

Esta herramienta genera documentos a partir de plantillas estándar. No proporciona asesoría legal. No se implica afiliación ni respaldo por parte de Common Paper, Bonterms, Y Combinator, NVCA ni ninguna fuente de plantillas. Consulta a un abogado para recibir orientación legal.
