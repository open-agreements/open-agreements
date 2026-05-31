# NVCA Model Stock Purchase Agreement

Recipe for the NVCA Model Stock Purchase Agreement (version 10-28-2025).

## Source

The source document is freely downloadable from [NVCA](https://nvca.org) but is
not redistributable. This recipe contains only transformation instructions.

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

Preview rendering for the SPA recipe runs the recipe pipeline with a fixture
payload and stores a stable rendered preview artifact. The preview must reflect
computed-field outputs and must not leave unrendered template tags or bracket
artifacts in the generated document.
