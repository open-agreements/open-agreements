# NVCA SPA Allure + Computed Pipeline Model

This document models the current NVCA SPA test and runtime architecture after adding the computed interaction layer (`computed.json`) and computed artifact export (`--computed-out`).

## Flowchart: End-to-end confidence pipeline

```mermaid
flowchart TB
    START([Run NVCA SPA test suite<br/>integration-tests/nvca-spa-template.test.ts])

    subgraph INPUTS["1. Inputs and Profiles"]
      I1[metadata.yaml<br/>field definitions + required_fields]
      I2[replacements.json<br/>source placeholder -> template tag]
      I3[clean.json<br/>footnote and drafting-note normalization]
      I4[computed.json optional<br/>interaction rules set_fill + set_audit]
      I5[scenario values<br/>base inputs + overrides]
    end

    subgraph VALIDATE["2. Static Validation Gates"]
      V1[validateRecipeMetadata]
      V2[validateRecipe]
      V3[computed.json schema validation if present]
      V4[mapping integrity checks<br/>required fields vs replacement targets]
    end

    subgraph COMPUTE["3. Computed Interaction Engine"]
      C1[Initialize state from user inputs]
      C2[Evaluate ordered rules over bounded passes]
      C3{Rule matched?}
      C4[Apply set_fill assignments<br/>updates render context]
      C5[Apply set_audit assignments<br/>updates audit-only context]
      C6[Record pass trace<br/>rule_id matched assignments]
      C7{State changed this pass?}
      C8[Stop at fixpoint or max_passes]
      C9[Build computed artifact<br/>inputs final_fill_values<br/>derived_fill_values<br/>derived_audit_values passes]
    end

    subgraph RENDER["4. Render and Verify"]
      R1[clean -> patch -> fill pipeline]
      R2[Extract output text]
      R3[verifyOutput checks<br/>values present<br/>no unrendered tags<br/>no leftover placeholders<br/>cleaning checks]
      R4[field policy checks<br/>strict resilient skip]
    end

    subgraph EVIDENCE["5. Allure Evidence Surface"]
      A1[Counsel summary<br/>legal question risk expected outcome]
      A2[Clause evidence matrix<br/>field placeholder expected excerpt match]
      A3[Inline details blocks<br/>computed artifact + matched rules + output excerpt]
      A4[Risk severity labels<br/>High critical Medium normal Low minor]
    end

    subgraph VALUE["6. Value Delivered"]
      O1[Higher confidence in fill correctness]
      O2[Deterministic and auditable interaction logic]
      O3[Machine-readable computed contract state]
      O4[Foundation for downstream automation]
    end

    START --> INPUTS
    INPUTS --> VALIDATE
    VALIDATE --> COMPUTE
    COMPUTE --> RENDER
    RENDER --> EVIDENCE
    EVIDENCE --> VALUE

    C2 --> C3
    C3 -->|yes| C4
    C3 -->|yes| C5
    C3 -->|no| C6
    C4 --> C6
    C5 --> C6
    C6 --> C7
    C7 -->|yes| C2
    C7 -->|no| C8
    C8 --> C9
```

## Flowchart: Combinatorial strategy (without brute force explosion)

```mermaid
flowchart LR
    ALL[All combinations<br/>N x M x P ...] --> REDUCE[Reduction strategy]
    REDUCE --> MCDC[MC/DC rule tests<br/>each predicate flips outcome]
    REDUCE --> PAIRWISE[Pairwise/t-wise covering arrays<br/>high interaction coverage]
    REDUCE --> PROP[Property invariants<br/>many generated states]
    REDUCE --> META[Metamorphic tests<br/>single input toggle diff]
    REDUCE --> GOLDEN[Golden legal scenarios<br/>lawyer-readable end-to-end]
    MCDC --> CONF[High confidence with tractable suite]
    PAIRWISE --> CONF
    PROP --> CONF
    META --> CONF
    GOLDEN --> CONF
```

## Sequence: `recipe run --computed-out`

```mermaid
sequenceDiagram
    actor User
    participant CLI as open-agreements recipe run
    participant Runtime as runRecipe
    participant CP as Computed evaluator
    participant Pipeline as clean/patch/fill pipeline
    participant Verifier as verifyOutput
    participant FS as Filesystem
    participant Allure as NVCA tests + Allure

    User->>CLI: recipe run nvca-stock-purchase-agreement --data values.json --computed-out computed.json
    CLI->>Runtime: runRecipe(options)
    Runtime->>FS: load metadata.yaml, clean.json, replacements.json
    Runtime->>FS: load computed.json if present

    alt computed profile present
      Runtime->>CP: evaluateComputedProfile(profile, inputValues)
      CP-->>Runtime: fillValues + auditValues + pass trace
      Runtime->>CP: buildComputedArtifact(...)
      Runtime->>FS: write computed artifact JSON
    else no computed profile
      Runtime->>CP: buildPassthroughArtifact (only if requested)
      Runtime->>FS: write passthrough artifact JSON
    end

    Runtime->>Pipeline: runFillPipeline(effective fillValues)
    Pipeline-->>Runtime: output.docx + stage info
    Runtime->>Verifier: verifyOutput(output.docx, effective fillValues, replacements, cleanConfig)
    Verifier-->>Runtime: verify checks
    Runtime-->>CLI: output path + fields used + computed artifact metadata

    Allure->>FS: read output text + computed artifact JSON
    Allure->>Allure: render counsel summary + clause matrix + inline computed evidence
```

## Dependency chain: dispute resolution + governing law (OA-066)

```mermaid
flowchart LR
    A[dispute_resolution_mode] --> B{arbitration or courts}
    B -->|arbitration| C[dispute_resolution_track = arbitration]
    B -->|courts| D[dispute_resolution_track = courts]
    C --> E{arbitration_location provided?}
    E -->|no| F[set_fill arbitration_location = San Francisco, California]
    E -->|yes| G[keep user-provided arbitration_location]
    D --> H{state_lower + judicial_district?}
    H -->|district missing + california| I[set_fill judicial_district = Northern District of California]
    H -->|district missing + delaware| J[set_fill judicial_district = District of Delaware]
    H -->|district missing + new york| K[set_fill judicial_district = Southern District of New York]
    H -->|district provided| L[keep user-provided judicial_district]
    D --> M{state_lower == delaware?}
    M -->|yes| N[forum_governing_law_alignment = aligned]
    M -->|no| O[forum_governing_law_alignment = mismatch]
    C --> P[forum_governing_law_alignment = n/a-arbitration]
    A --> Q[governing_law_state = delaware]
```

## Why this materially increases confidence

- Interaction logic is no longer implicit; it is declarative, executable, and traced.
- Fill behavior is tested at both levels:
  - output-level document checks,
  - intermediate computed-state checks.
- Rule traces make failures explainable:
  - which rule matched,
  - in which pass,
  - what assignments changed.
- The computed artifact is structured data that can power future automation without re-parsing prose contracts.
