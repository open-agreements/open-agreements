## ADDED Requirements

### Requirement: Opaque Download Links for Hosted Fill
The hosted OpenAgreements fill flow SHALL issue download URLs using opaque
download identifiers instead of embedding full fill payload values in the URL.

#### Scenario: fill_template url mode returns id-based download metadata
- **WHEN** a client calls `fill_template` with `return_mode: "url"`
- **THEN** the response includes a `download_id` and `download_url`
- **AND** `download_url` uses an opaque identifier parameter (`id`) rather than serialized fill values

#### Scenario: download endpoint resolves a valid opaque identifier
- **WHEN** a client requests `/api/download` with a valid non-expired `id`
- **THEN** the endpoint returns `200` and a DOCX attachment

### Requirement: Download Endpoint Supports HEAD Probing
The hosted download endpoint SHALL support `HEAD` requests so clients can probe
link viability without downloading the document body.

#### Scenario: head request for valid id-based link
- **WHEN** a client sends `HEAD /api/download?id=<valid_id>`
- **THEN** the endpoint returns `200`
- **AND** the response omits the document body

### Requirement: Download Errors Are Machine-Actionable
The hosted download endpoint SHALL return machine-readable error codes that
distinguish missing parameters, malformed links, invalid signatures, and expiry.

#### Scenario: malformed or tampered link returns explicit code
- **WHEN** a client sends a download request with a malformed or tampered identifier
- **THEN** the endpoint returns an error response with a specific error code describing the failure class
- **AND** the response does not collapse all failures into one generic message

#### Scenario: expired link returns explicit expiry code
- **WHEN** a client sends a request with an expired identifier
- **THEN** the endpoint returns an error response with an explicit expiry error code
