# Third-party declarative blockers audit

Audit date: 2026-09-16
Worktree revision: `fff96d1b4332711b75eab1c610f2f89324ddd706`
Comparison revision: `origin/main` at `518040de2b9dfce5a56c7f98e4f95209ef872501`

## Final execution status

> **Corrected 2026-09-16.** The revision lines above identify the baseline on which the defects were discovered; they are not the final runtime checkpoint. The final verifier execution used compiler runtime `a769df96`, and the runtime digest recorded in every receipt is `ada1fb16d9e61215e8891a62f79f3a62935313e0f0af48507d4721303ca0e2e6`.

Filesystem discovery found all 25 Common Paper and Bonterms directories. The final result was:

- 12 fillable templates independently verified across 107 passing generated cases;
- 1 zero-field, zero-command Software License DOCX validated as a static copy, not counted as fillable;
- 12 templates blocked at compilation;
- no licensing/rights-profile blocker.

The verified fillable set is: Bonterms Mutual NDA; Bonterms Professional Services Agreement; Common Paper Amendment; Business Associate Agreement; Cloud Service Agreement; CSA Click-Through; Independent Contractor Agreement; Letter of Intent; Mutual NDA; One-Way NDA; Order Form; and Term Sheet.

Blocked classifications are:

- **Ambiguous source mapping (6):** CSA with SLA, Data Processing Agreement, Design Partner Agreement, Order Form with SLA, Partnership Agreement, and Professional Services Agreement. Their literal replacement keys match multiple authored paragraphs.
- **Adapter/locator unimplemented (6):** AI Addendum, AI Addendum In-App, CSA with AI, CSA without SLA, Pilot Agreement, and Statement of Work. Compilation fails closed because a selection group or marker cannot be uniquely located.

Cloud Service Agreement's initially observed computed-field reporting and empty-cap-paragraph divergences were corrected generically; all 31 cases pass in the final run.

Per-template receipts, contract hashes, runtime hashes, and deterministic case inventories are under `.cache/common-paper-declarative/thirdparty/`.

This is a read-only source and adapter audit. It does not authorize changing third-party legal prose. A compiler may promote a form only after every legal/render-affecting artifact is fingerprinted and its transformations are independently verified.

## Findings

### Bonterms

> **Corrected 2026-09-16.** The compiler now fingerprints and accepts the Bonterms recipe artifact, implements the generic fallback/join/presence rules, and both Bonterms forms pass the final independent verifier. The following paragraphs preserve the original blockers and why the implemented treatment was required.

The two Bonterms directories are blocked first by the compiler's artifact allowlist because each contains `source.json`:

- `templates/bonterms-cc0-1.0/bonterms-mutual-nda/`
- `templates/bonterms-cc0-1.0/bonterms-professional-services-agreement/`

`source.json` is a legal/render-affecting generation recipe: it identifies an external source DOCX and records cleaning and literal-replacement operations. It must be strictly validated and included in the source fingerprint. It is not, however, proof that the shipped DOCX is reproducible: the referenced source DOCX files are absent, and `scripts/prepare-bonterms-templates.ts` still scans only `templates/<dir>/source.json`, not the current two-level source/rights tree. The shipped `template.docx` therefore remains the canonical operational byte source unless external source bytes are separately pinned and regeneration is verified.

After the artifact gate is corrected, the Professional Services Agreement should fit the generic selection path: its only selection is the licensed-versus-assigned deliverables radio group. The Mutual NDA has additional real work. Its DOCX binds generic computed fields for both parties:

- `party_{1,2}_signatory_company` with fallback to the corresponding party name;
- `party_{1,2}_signatory_name_and_title`;
- `party_{1,2}_notice_email_check` and `party_{1,2}_notice_postal_check`.

Those computations are currently explicitly rejected by `src/core/selection-contract.ts`. They require generic, schema-derived rules and polarity/cardinality tests; a template-ID switch is not sufficient.

### Common Paper Independent Contractor Agreement

> **Corrected 2026-09-16.** `clean.json` is now accepted, interpreted, and fingerprinted. The Independent Contractor Agreement passes four generated cases with meaningful ZIP-entry, ordered-text, unresolved-command, selection, and attribution checks. The discussion below records the former gap and the required invariant.

`templates/common-paper-cc-by-4.0/common-paper-independent-contractor-agreement/clean.json` is not ancillary. It removes the first-page interpreting/help-text range before fill. The current compiler invokes `loadCleanConfig()` when replacements exist, but rejects the directory because `clean.json` is missing from the allowed artifact set and omits `clean.json` from `sourceHashes`.

Safe treatment is:

- required and fingerprinted: `metadata.yaml`, `template.docx`;
- optional but interpreted and fingerprinted when present: `clean.json`, `replacements.json`, `selections.json`;
- optional provenance recipe, strictly validated and fingerprinted: `source.json`;
- ancillary only: `README.md`.

Unknown artifacts should continue to fail closed. Any source contract must change when any interpreted artifact changes.

Required ICA tests are: clean/replacement/template/metadata drift rejection; byte parity with legacy fill for complete and blank/default cases; both signer roles as entity and individual; present and blank `other_terms`; absence of the removed help-text range; no unresolved commands; and preservation of the existing CC-BY footer, `Common Paper Independent Contractor Agreement (Version 1.0) free to use under CC BY 4.0`.

### Order form replacement failures

> **Corrected 2026-09-16.** The generic compiler now accepts safe embedded field commands but requires every literal replacement key to identify exactly one authored paragraph. The ordinary Order Form passes 17 cases. Order Form with SLA remains correctly blocked because its mappings are ambiguous.

The replacement files for the order form, order form with SLA, and pilot agreement are byte-identical to `origin/main`, and every declared search string still occurs in the current DOCX. Their current `Unsupported or unmatched literal replacement` failure is therefore not replacement-file drift. The compiler incorrectly assumes every replacement value must be exactly `{field}`; these sources also use valid literal-plus-command replacements such as `up to {fee_increase_max_percent}% per renewal` and `{cap_multiplier}x the Fees`.

The ordinary order form and pilot agreement are adapter-shape blockers: their relevant replacement searches are unique in the source. The SLA form is different and must not be promoted merely by relaxing the validator. Its simple search key `[ # ]` occurs in nine source paragraphs, and `[__]` occurs in two. Because the legacy patcher replaces every simple-key occurrence, `payment_terms_days` and `target_uptime_percent` overwrite unrelated SLA percentages, response times, credit bands, and notice periods.

A legacy fill with all Boolean selections enabled and unique sentinel values produced thirteen visible `PAYMENT_DAYS_SENTINEL` occurrences and two `UPTIME_SENTINEL` occurrences. Examples of corrupted output included:

- `PAYMENT_DAYS_SENTINEL% to Target Uptime`;
- `under PAYMENT_DAYS_SENTINEL%`;
- `Target Response Time: PAYMENT_DAYS_SENTINEL ...`;
- `written notice ... at least PAYMENT_DAYS_SENTINEL ... before the period of unavailability`;
- `Response Time Credit will be UPTIME_SENTINEL%`.

The SLA source needs context-qualified replacement keys and, where legally intended, distinct metadata fields. Promotion requires a fixture that assigns a unique sentinel to every SLA input and proves exact occurrence and semantic location, not merely successful compilation or parity with the already-corrupted legacy path.

### Design Partner replacement failure

`templates/common-paper-cc-by-4.0/common-paper-design-partner-agreement/replacements.json` has the same defect and must also be blocked notwithstanding earlier parity results. Its simple mapping `"[ # ]": "{free_text}"` matches three legally distinct source paragraphs:

- number of feedback sessions;
- agreement term length;
- invoice payment days.

The replacement file SHA-256 is `4f7f2883d157fd040bd6c6b3d18d28371364a7221dd040c4ef5a660704686106`. A legacy fill setting `free_text=FREE_TEXT_SENTINEL` emitted that value as the feedback-session count, the term length, and the invoice deadline (with four visible sentinel occurrences due to the source layout). This is shared-source corruption: declarative/legacy ZIP parity will reproduce it and cannot prove semantic correctness. The form requires context-qualified mappings to distinct fields before promotion; relaxing the compiler or preserving historical parity is unsafe.

## Source hashes

| Artifact | SHA-256 |
|---|---|
| `bonterms-mutual-nda/metadata.yaml` | `a7e5b01e52f61c7c18ef800ff95541055d4561197316e2144f22820e21e16f87` |
| `bonterms-mutual-nda/source.json` | `89642f2760f52b30d33d50d221217a6c55acdf7c4bd338b12fe9c8771b5f3d60` |
| `bonterms-mutual-nda/template.docx` | `c481077adf9fe34ed254b017a82510f11158f1ebe723fccd1132baeab83785ae` |
| `bonterms-professional-services-agreement/metadata.yaml` | `6a39f6528c3778139fca758438fe8453862ba35be07b1fa6fc24e760e4e760d2` |
| `bonterms-professional-services-agreement/selections.json` | `c86b1130c411e036f482d9787ea3383c89244bbacdfc0847aa2b3e9a0ed6bcbe` |
| `bonterms-professional-services-agreement/source.json` | `df9cce759676f38b2509aad5176724b7a2eea8de52a8e6f3963f4d3f68b51b73` |
| `bonterms-professional-services-agreement/template.docx` | `3b9665a986893b4b01c84f573c9a2e162683ce4503f1af5c0b0b79ed026e5789` |
| `common-paper-independent-contractor-agreement/clean.json` | `2aaf668950ed8639e82115a8e487e88450a2f6138dbcd3ec58a0e7ea7b298b8e` |
| `common-paper-independent-contractor-agreement/metadata.yaml` | `075181ed2a4f4860652357c02715ef541713e7344a847ddb44f586c10ced5d82` |
| `common-paper-independent-contractor-agreement/replacements.json` | `c42a813da230a229b180b4594ae7d6fe30190394b59e1944ce49fcb2a80a4260` |
| `common-paper-independent-contractor-agreement/template.docx` | `b11ebb7c35f32fec64b6f5ba5283623114eda7041a2da26324f4386157a79fc7` |
| `common-paper-design-partner-agreement/replacements.json` | `4f7f2883d157fd040bd6c6b3d18d28371364a7221dd040c4ef5a660704686106` |
| `common-paper-order-form/replacements.json` | `f8a51caa1fa9466869b6ea90acf1a173497f6cb6a7af5168eab427b103a6cfa8` |
| `common-paper-order-form-with-sla/replacements.json` | `1006458dccadf5331f133fadc056f72cb7dbcf04f8bbcbe26e5ebee334177427` |
| `common-paper-pilot-agreement/replacements.json` | `5bb9632a0d80ff9c4d9496e6cefb808d14b6fb621302d2125fffaefbc114eae9` |

The three replacement hashes above exactly match `git show origin/main:<path>`.

## Reproduction

Show the current compiler blockers:

```bash
npx tsx -e "import {compileSelectionContract} from './src/core/selection-contract.ts'; void (async()=>{for(const d of process.argv.slice(1)){try{const c=await compileSelectionContract(d); console.log(d,'PASS',c.bindings.length)}catch(e){console.log(d,'BLOCK',e instanceof Error?e.message:String(e))}}})()" \
  templates/bonterms-cc0-1.0/bonterms-mutual-nda \
  templates/bonterms-cc0-1.0/bonterms-professional-services-agreement \
  templates/common-paper-cc-by-4.0/common-paper-independent-contractor-agreement \
  templates/common-paper-cc-by-4.0/common-paper-order-form \
  templates/common-paper-cc-by-4.0/common-paper-order-form-with-sla \
  templates/common-paper-cc-by-4.0/common-paper-pilot-agreement
```

Verify that replacement JSON did not drift:

```bash
git show origin/main:templates/common-paper-cc-by-4.0/common-paper-order-form-with-sla/replacements.json | shasum -a 256
shasum -a 256 templates/common-paper-cc-by-4.0/common-paper-order-form-with-sla/replacements.json
```

Count the ambiguous SLA source placeholders:

```bash
npx tsx -e "import AdmZip from 'adm-zip'; import {DOMParser} from '@xmldom/xmldom'; import {getParagraphText} from '@usejunior/docx-core'; const d='templates/common-paper-cc-by-4.0/common-paper-order-form-with-sla/template.docx'; const z=new AdmZip(d); const ps=z.getEntries().filter(e=>/^word\\/.*\\.xml$/.test(e.entryName)).flatMap(e=>{const x=new DOMParser().parseFromString(e.getData().toString(),'application/xml'); return Array.from(x.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','p')).map(p=>getParagraphText(p as any))}); for(const key of ['[ # ]','[__]']) console.log(key,ps.filter(p=>p.includes(key)).length)"
```

Expected result: `[ # ] 9` and `[__] 2`.

List the three Design Partner collisions:

```bash
npx tsx -e "import AdmZip from 'adm-zip'; import {DOMParser} from '@xmldom/xmldom'; import {getParagraphText} from '@usejunior/docx-core'; const d='templates/common-paper-cc-by-4.0/common-paper-design-partner-agreement/template.docx'; const z=new AdmZip(d); const ps=z.getEntries().filter(e=>/^word\\/.*\\.xml$/.test(e.entryName)).flatMap(e=>{const x=new DOMParser().parseFromString(e.getData().toString(),'application/xml'); return Array.from(x.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','p')).map(p=>getParagraphText(p as any))}); for(const p of ps.filter(p=>p.includes('[ # ]'))) console.log(p)"
```

## Licensing constraints

Bonterms metadata declares `CC0-1.0`, bundled distribution, and derivative permission. Preserve the incorporated Bonterms form/version/link in the cover page even though attribution is not a CC0 condition. Common Paper metadata declares `CC-BY-4.0`; its attribution text and existing DOCX attribution/footer are legally material. Hash both metadata and DOCX, and verify attribution survives every clean, selection, replacement, and fill path. README text alone is not an adequate output-license check.
