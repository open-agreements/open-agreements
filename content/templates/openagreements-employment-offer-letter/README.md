# OpenAgreements Employment Offer Letter

Startup-oriented employment offer letter for hiring workflows where teams want
clear, editable terms and source transparency.

## Source

- **URL**: https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-employment-offer-letter
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employer_name` | string | yes | Legal name of the employer |
| `employee_name` | string | yes | Full legal name of the employee |
| `position_title` | string | yes | Offered role title |
| `employment_type` | enum | yes | `full-time` or `part-time` |
| `start_date` | date | yes | Employment start date |
| `reporting_manager` | string | no | Manager or role this position reports to |
| `base_salary` | string | yes | Base salary or hourly amount |
| `bonus_terms` | string | no | Bonus eligibility summary |
| `equity_terms` | string | no | Equity grant summary, if any |
| `work_location` | string | yes | Primary work location and/or remote status |
| `governing_law` | string | yes | Governing law state for the offer letter |
| `offer_expiration_date` | date | yes | Date by which the offer must be accepted |

## Attribution

Authored by OpenAgreements contributors. Drafting structure informed by publicly
available permissive sources including the DocuSign template library (MIT) and
Papertrail legal-docs (CC0). Licensed under CC BY 4.0.
