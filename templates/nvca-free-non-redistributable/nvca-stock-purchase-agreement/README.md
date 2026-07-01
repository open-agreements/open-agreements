# NVCA Model Stock Purchase Agreement

Field-selector for the NVCA Model Stock Purchase Agreement (version 10-28-2025).

## Source

The source document is freely downloadable from [NVCA](https://nvca.org) but is
not redistributable. This field-selector contains only transformation instructions.

## Interaction Audit Coverage

The NVCA SPA test suite includes interaction-focused coverage that asserts
multi-condition derived outputs and traceability, including Dispute Resolution
and Governing Law dependencies.

When computed inputs select courts rather than arbitration and include a forum
state, computed outputs indicate the selected dispute-resolution track, include
forum versus governing-law alignment status, derive judicial district defaults
when courts are selected and judicial district is omitted, and expose the
dependency chain in the exported trace.

## Preview Rendering

The system supports rendering NVCA SPA template output as PNG evidence pages for
human review. When NVCA template prerequisites are available, rendered pages are
attached as PNG evidence for human review.

## Behavioral Scenarios

### [OA-FIL-002] Dispute resolution interaction produces required computed outputs
- **WHEN** NVCA SPA computed inputs select courts vs arbitration and include a forum state
- **THEN** computed outputs indicate the selected dispute-resolution track
- **AND** computed outputs include forum vs governing-law alignment status
- **AND** when courts are selected and judicial district is omitted, computed outputs derive judicial district defaults
- **AND** the exported trace shows the dependency chain

### [OA-FIL-022] NVCA rendered preview evidence
- **WHEN** NVCA template prerequisites are available
- **THEN** rendered pages are attached as PNG evidence for human review
