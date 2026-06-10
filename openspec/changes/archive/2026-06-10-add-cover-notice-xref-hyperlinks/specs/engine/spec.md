## ADDED Requirements

### Requirement: Cover-Notice Cross-Reference Resolution
The fill pipeline SHALL resolve the cover confirmation notice's cross-reference sentinels after it resolves `{IF}` conditionals and renumbers the standard-terms clause headings.
In the same DOM walk that assigns sequential numbers, the pass MUST map each clause heading's `oa_xref_*`
bookmark to that heading's resolved sequential number, then rewrite every `<<xref:bookmark>>`
sentinel in the document to the literal text `Section N` for the bookmark it names. The resolved
number MUST equal the current (post-renumber) number of the target heading, so an omitted earlier
clause shifts the cross-reference with it. Because a rendered bullet and its target heading share the
same `{IF}` gating, a present sentinel always has a present target bookmark. The catalog preview
(`humanizeDocx`, which never runs the fill pass) MUST render any residual sentinel as a neutral
`Section [#]` placeholder rather than leaking the raw token.

#### Scenario: [OA-TMP-074] Sentinel resolves to the target heading's post-renumber section number
- **WHEN** a filled document contains a `<<xref:bookmark>>` sentinel and a clause heading carrying
  that bookmark
- **THEN** the sentinel is rewritten to `Section N` where `N` is the heading's sequential number
  after renumbering
- **AND** when an earlier clause is omitted so the target heading renumbers, the resolved
  `Section N` changes to match (no stale or gapped number)
