# Runtime compatibility for recipe distribution

`runtime-capabilities.json` is a versioned distribution contract. The public
`RUNTIME_CAPABILITIES` export describes the same capabilities in the built
runtime. Build checks require exact parity; packages must carry both.

A forward sync must infer requirements from the actual recipe files and
operations, then check the destination contract **before replacing or deleting
any destination content**. Missing, unknown-version, or insufficient contracts
must fail. Do not infer support from a package version alone, and do not rely on
an unknown requirement key that an old parser can silently strip.

The v1 capability names cover the current legacy replacements, cleaner,
selector manifests, selections, computed rules, normalization, repeatable tables,
anchored paragraph bindings and reference-field actions. Story paragraph removal,
bounded selection removal, and grouped reference literalization have additional
explicit capabilities because older runtimes lacked those operations. These names
describe supported operation contracts, not a minimum npm release inferred from
its version number. New incompatible operations require a new capability.

Selections parsing is strict at the config, group, option and trigger levels.
Unknown keys fail instead of being discarded. Existing option `label` values
remain accepted. A schema-versioned distribution contract and a strict loader
serve different purposes: the former stops an incompatible sync; the latter
prevents future malformed operations from silently becoming no-ops.

This cannot retroactively protect callers who manually copy new recipes into an
old npm installation while bypassing the guarded distribution path. Historical
OA 0.7.6 accepted removal-bearing selections while stripping the removal objects;
the contract therefore must be checked by the distributing process.
