## ADDED Requirements

### Requirement: Cover-Notice Cross-Reference Anchors and Hyperlinks
When the renderer emits the cover confirmation notice, each listed confirm clause's heading SHALL be
wrapped in a bookmark named `oa_xref_HASH` (a hash of the clause id, so the name satisfies Word's
bookmark-name constraints), and each notice bullet SHALL read `• SECTION-NUMBER — HEADING — for more
details see URL`. The section number MUST be a `<<xref:bookmark>>` sentinel wrapped in an internal
hyperlink anchored to that heading bookmark (resolved to the live `Section N` by the fill pipeline).
The URL MUST be a real external hyperlink (a `word/_rels/document.xml.rels` relationship with
`TargetMode="External"`), not plain text. Anchors SHALL be emitted only for clauses the notice links
to. The bullet text MUST NOT contain the literal `[CONFIRM before signing:` token, and the in-body
`[CONFIRM …; see URL]` bracket MUST remain plain text so the statutory-compliance representation
validator is unaffected.

#### Scenario: [OA-TMP-075] Rendered template emits the anchor, sentinel, and external hyperlink
- **WHEN** a template with a `confirm=` clause is rendered
- **THEN** the confirm clause heading carries an `oa_xref_*` bookmark and the cover bullet carries
  the matching `<<xref:bookmark>>` sentinel inside an internal hyperlink to that bookmark
- **AND** the "for more details" URL is an external hyperlink relationship, and the unresolved
  sentinel is not reported as an unknown placeholder by template validation
