# Agreement Delivery and Signing Adapter Direction

Status: product direction; hosted delivery implementation is not authorized by
this document.

Decision owner: Steven Obiajulu

Decision date: 2026-08-31

## Summary

OpenAgreements owns the local agreement lifecycle and the safety boundary for
any delivery it initiates. It does not plan to host an electronic-signature
ceremony in this phase. Electronic signing is an external, provider-neutral
adapter contract or an explicit handoff to an instrument publisher's official
workflow.

The local persistent agreement commands shipped in #693 are the foundation:
create, list, show, update, review, and render operate on local records without
contacting recipients. Work should continue to harden that local contract before
hosted authentication, delivery, or signing adapters are considered.

## Product boundaries

### OpenAgreements-owned workflow

The first instrument eligible for a future OpenAgreements-owned send path is a
standard bilateral mutual NDA under a verified permissive license. Its source,
license, attribution, version, and checksum must be recorded and reviewed before
delivery is enabled.

An OpenAgreements-owned workflow may eventually:

- persist and revise an agreement locally;
- validate template-defined fields and participant roles;
- render and inspect a deterministic document;
- construct an immutable snapshot candidate;
- submit the frozen document through an approved delivery/signing adapter; and
- reconcile external events and retain the final executed artifact.

### Publisher handoff

If an instrument is controlled by its publisher and OpenAgreements is not
authorized to send it, the product must direct the user to the publisher's
official workflow. OpenAgreements must not reproduce or compete with that
workflow.

The handoff must clearly state that the user is leaving OpenAgreements. It must
not create an OpenAgreements sent snapshot, signing transaction, pending status,
or completion claim. Importing externally completed evidence would require a
separate design and explicit provenance checks.

### Signing ceremony

Consent screens, signer-detail collection, document presentation, accessibility,
identity checks, and signature capture remain the external provider's
responsibility. OpenAgreements specifies the adapter inputs, normalized outcomes,
and evidence it must reconcile; it does not prescribe or host the provider's
ceremony UI.

## Existing local foundation

The local agreement store uses opaque agreement IDs, monotonically increasing
revisions, pinned template version and source checksum, declared template terms,
review state, render metadata, and UTC timestamps. Mutating operations use atomic file
replacement and agreement-scoped locking. Optional expected-revision checks
prevent stale writers from silently overwriting newer state.

Local operations must remain delivery-free: create, update, review, render,
list, and show cannot invoke email or signing providers. Further local work
should prioritize stable machine output, deterministic document digests,
explicit snapshot construction, migration/version policy, recovery behavior,
and cross-process tests.

## Safe-send contract

Any future OpenAgreements-owned send path must preserve all of these invariants,
independent of provider choice.

### Server-authoritative validation

The service—not the CLI—must revalidate authorization, template rights,
required fields, participant roles, recipients, revision, and document digest
before invoking an adapter. Client-side validation is advisory only.

### Revision-bound confirmation

Interactive send must display the exact template, parties and recipients,
field summary, revision, and document digest, then require affirmative
confirmation.

A non-interactive JSON send without confirmation must deliver nothing. It must
return `confirmation_required` plus the exact reviewed values, a confirmation
token, and an expiry. The token binds:

- agreement ID;
- agreement revision;
- document digest; and
- the complete recipient set.

Any bound-value change or expiry makes the token stale.

### Idempotency and freeze point

The confirmation token is also the send idempotency key. Before any provider
call, the service must durably record the send decision and immutable sent
snapshot, then transition the agreement to pending.

A failure before that freeze point leaves the draft unchanged and permits retry
with the same unexpired token. A timeout or failure after the freeze point must
be reconciled using the same idempotency key and canonical agreement state;
retry must not duplicate delivery.

### Immutable sent snapshot

The sent snapshot includes the exact agreement revision, canonical fields,
participant roles, recipients, template source/license/version/checksum, and
document digest. Later changes to local defaults, source templates, or setup
must not alter it. Changing terms or recipients after send requires a new
transaction rather than mutation or resend.

## CLI output contract

Human output should use labeled fields and actionable status. Machine mode must
write exactly one versioned JSON value to stdout; progress and diagnostics go to
stderr. Timestamps are ISO-8601 UTC. Schema evolution is additive within a
version; removals, renames, or type changes require a new version.

Machine errors use a stable shape:

```json
{
  "code": "confirmation_stale",
  "message": "The agreement changed after confirmation.",
  "field": null,
  "retryable": false
}
```

The shipped agreement commands do not yet emit `schema_version` or structured
errors. This contract governs the local hardening work in step 1 of Sequencing.

Local error codes should cover uninitialized/corrupt stores, missing agreements,
validation, revision conflict, unavailable templates, and rendering. Hosted
delivery later adds confirmation, authorization, sendability, and delivery
errors. Signing credentials, raw provider payloads, signature representations,
and participant access URLs never appear in ordinary CLI resources.

## Provider-neutral adapter contract

An adapter accepts only a server-authorized immutable sent snapshot and an
idempotency key. It is responsible for:

- creating or reconciling one provider transaction for that key;
- mapping OpenAgreements participant roles to provider participants;
- keeping provider names and identifiers out of the public agreement contract;
- normalizing delivery, view, signature, decline, expiry, failure, finalizing,
  and completion outcomes;
- authenticating callbacks and deduplicating provider event identities;
- handling delayed, duplicate, and out-of-order events without state regression;
- resending only to an eligible frozen recipient without changing content;
- retrieving the final executed artifact;
- verifying and storing exact artifact bytes and their digest; and
- preserving an auditable link from sent snapshot through provider transaction
  to completed artifact.

Participant completion order is not significant. Finalization begins only after
all required provider outcomes exist. The agreement becomes complete only after
the final artifact is durably stored and its digest recorded. Retrieval,
verification, or storage failure leaves the transaction finalizing and eligible
for bounded automatic and authorized operator retry.

## Security, privacy, and retention

- Hosted operations authorize every agreement and artifact object.
- Local state and exports must use user-only permissions by default. The shipped
  commands do not yet enforce this; it remains local-hardening work.
- Tokens, private fields, provider payloads, and artifacts stay out of ordinary
  logs and JSON diagnostics.
- Raw provider evidence is stored separately with least-privilege access.
- Executed artifacts and evidence follow a documented retention, export,
  backup, and deletion policy; this direction sets no arbitrary retention term.
- Public documentation excludes private competitive research, screenshots,
  recordings, emails, and named observations of third-party workflows.

## Sequencing and authorization

1. Continue the local persistent command layer and machine-output contract.
2. Add deterministic digest and immutable snapshot foundations locally.
3. Consider hosted authentication and server-authoritative send only under a
   separately approved implementation plan.
4. Add a delivery/signing adapter only after the safe-send boundary exists.

This document authorizes no hosted authentication, send, provider integration,
or signing work. Founder signoff remains required before publishing any skill
text derived from this direction. Do not create implementation issues without
explicit approval.
