# Common Paper CSA Click-Through

A click-through cloud service agreement based on [Common Paper's](https://commonpaper.com) standard terms. Designed for self-serve SaaS products where the customer accepts terms online rather than negotiating a paper agreement.

## Source

- **URL**: https://commonpaper.com/standards/cloud-service-agreement/2.1
- **Version**: 2.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_name` | string | yes | Name of the cloud service provider |
| `cloud_service` | string | yes | Description of the cloud service |
| `custom_order_date` | string | no | Custom order date |
| `effective_date` | string | no | Effective date of the agreement |
| `subscription_period` | string | no | Length of access to the service |
| `payment_frequency` | string | no | Payment frequency |
| `payment_terms_days` | string | no | Days to pay after invoice |
| `non_renewal_notice_date` | string | no | Non-renewal notice date requirement |
| `order_date` | string | no | Order date description |
| `governing_law` | string | yes | Governing law jurisdiction |
| `jurisdiction` | string | yes | Courts with jurisdiction |
| `provider_email` | string | no | Provider's email for notices |
| `unlimited_claims` | string | no | Description of unlimited claims |
| `pricing_page` | string | no | Reference to pricing page |

## Attribution

Based on the Common Paper CSA Click-Through, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
