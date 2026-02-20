## ADDED Requirements

### Requirement: Run-Level Formatting Visibility
The Safe-Docx MCP server SHALL display inline formatting tags in `read_file` TOON output to expose run-level formatting boundaries, using the same tag vocabulary that `smart_edit` accepts.

#### Scenario: TOON output shows inline formatting tags at run boundaries by default
- **GIVEN** a document with mixed formatting (e.g., bold mid-sentence, italic terms)
- **WHEN** `read_file` is called with default parameters
- **THEN** the TOON `text` column SHALL contain inline tags (`<b>`, `<i>`, `<u>`, `<highlighting>`) at run boundaries where formatting deviates from the computed baseline
- **AND** hyperlinks SHALL be rendered as `<a href="...">text</a>`

#### Scenario: show_formatting=false suppresses inline tags
- **WHEN** `read_file` is called with `show_formatting=false`
- **THEN** the TOON `text` column SHALL contain plain text without any inline formatting tags
- **AND** output SHALL be identical to the current untagged behavior

#### Scenario: writable tag vocabulary matches smart_edit new_string vocabulary
- **WHEN** `read_file` emits inline formatting tags
- **THEN** the writable tag vocabulary SHALL be: `<b>`, `<i>`, `<u>`, `<highlighting>`
- **AND** these writable tags SHALL be accepted by `smart_edit` in the `new_string` parameter
- **AND** `<a href="...">` SHALL be emitted as a read-only tag (rendered in `read_file` output but NOT accepted in `smart_edit` `new_string`)
