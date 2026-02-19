# Common Paper Cloud Service Agreement

A cloud service agreement based on [Common Paper's](https://commonpaper.com) standard terms, covering SaaS subscriptions.

## Source

- **URL**: https://github.com/CommonPaper/CSA
- **Version**: 2.0
- **License**: CC BY 4.0

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

## Attribution

Based on the Common Paper Cloud Service Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
