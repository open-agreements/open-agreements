# Common Paper Business Associate Agreement

A HIPAA business associate agreement based on [Common Paper's](https://commonpaper.com) standard terms. Covers the use and protection of protected health information (PHI) between a covered entity and a business associate.

## Source

- **URL**: https://commonpaper.com/standards/business-associate-agreement/1.0
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `party_role` | string | yes | Role in the agreement (Business Associate or Covered Entity) |
| `principal_agreement` | string | yes | Reference to the principal agreement |
| `subcontractor_role` | string | no | Role of subcontractors |
| `free_text` | string | no | Free text entry |
| `aggregation_restrictions` | string | no | Specific aggregation restrictions |
| `offshoring_restrictions` | string | no | Specific offshoring rights or restrictions |
| `breach_notification_unit` | string | no | Unit for breach notification period |
| `fill_in_value` | string | no | General fill-in value |
| `custom_effective_date` | string | no | Custom effective date |

## Attribution

Based on the Common Paper Business Associate Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
