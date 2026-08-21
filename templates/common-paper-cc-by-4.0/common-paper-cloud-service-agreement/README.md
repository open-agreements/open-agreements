# Common Paper Cloud Service Agreement

A cloud service agreement based on [Common Paper's](https://commonpaper.com) standard terms, covering SaaS subscriptions.

## Source

- **URL**: https://github.com/CommonPaper/CSA
- **Standard Terms**: https://commonpaper.com/standards/cloud-service-agreement/2.1
- **Version**: 2.1
- **License**: CC BY 4.0

> **Correction, 2026-08-20.** This line previously read `**Version**: 2.0`. Unlike
> the sibling Mutual NDA correction, 2.0 was genuinely correct once and then went
> stale — Common Paper did publish a Cloud Service Agreement 2.0, and
> `commonpaper.com/standards/cloud-service-agreement/2.0` still resolves (HTTP 200,
> as does `/2.1`; `/2.2` returns 404), so neither URL 404s and nothing broke loudly.
> What settles it is the record disagreeing with itself: the vendored
> `template.docx` in this directory prints "Common Paper Cloud Service Standard
> Terms Version 2.1" and incorporates
> `https://commonpaper.com/standards/cloud-service-agreement/2.1/` by reference, and
> `metadata.yaml` has said `version: '2.1'` since 69ac93f1. Common Paper's own
> unversioned `/standards/cloud-service-agreement` page now serves Version 2.1. Only
> this hand-written README line still described a 2.0 form nobody here ships.

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_name` | string | yes | Full legal name of the cloud service provider |
| `provider_email` | string | yes | Notice email address for the provider |
| `customer_name` | string | yes | Full legal name of the customer |
| `customer_email` | string | yes | Notice email address for the customer |
| `effective_date` | date | yes | Date the agreement takes effect |
| `service_description` | string | yes | Description of the cloud service being provided |
| `subscription_term` | string | yes | Initial duration of the subscription |
| `renewal_term` | string | yes | Duration of each renewal period |
| `fees` | string | yes | Subscription fees and payment terms |
| `payment_period` | string | yes | Payment frequency |
| `governing_law` | string | yes | State whose laws govern the agreement |
| `jurisdiction` | string | yes | Courts with jurisdiction over disputes |
| `provider_liability_cap` | string | no | Maximum liability cap for the provider |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_signatory_type` | enum (`entity` / `individual`) | no | Whether the Provider signatory is an entity or individual (default: `entity`) |
| `provider_signatory_name` | string | no | Full legal name of the Provider's signatory |
| `provider_signatory_title` | string | no | Title/role of the Provider's signatory (entity only) |
| `provider_signatory_company` | string | no | Company name for the Provider signatory (entity only) |
| `provider_signatory_email` | string | no | Notice email address for the Provider |
| `customer_signatory_type` | enum (`entity` / `individual`) | no | Whether the Customer signatory is an entity or individual (default: `entity`) |
| `customer_signatory_name` | string | no | Full legal name of the Customer's signatory |
| `customer_signatory_title` | string | no | Title/role of the Customer's signatory (entity only) |
| `customer_signatory_company` | string | no | Company name for the Customer signatory (entity only) |
| `customer_signatory_email` | string | no | Notice email address for the Customer |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Cloud Service Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
