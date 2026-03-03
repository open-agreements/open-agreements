# Privacy Criteria — P 1.1 through P 8.1

Per-criterion audit guidance for the Privacy trust category. Include when the service processes personally identifiable information (PII).

## P 1.1 — Privacy notice at collection

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that individuals are informed about the organization's privacy practices at or before the point of data collection. The privacy notice must be accessible, understandable, and presented before (not after) personal data is collected.

**What auditors test**:
- Privacy notice is presented at or before collection (not buried in a Terms of Service footer)
- Notice is accessible: prominent link on sign-up forms, data collection pages, and mobile apps
- Notice is understandable: written in plain language, not dense legalese
- Notice timing: presented before the user submits personal data, with opt-in where required
- Multi-channel: if data is collected via web, mobile, API, and phone — each channel has appropriate notice

**Evidence to prepare**:
- Privacy notice URL and screenshots showing placement at collection points
- Privacy notice text (current version with effective date)
- Screenshots of collection forms showing privacy notice link/checkbox before submit button
- Mobile app privacy notice presentation (screenshot or screen recording)
- Privacy notice version history showing updates during audit period

**Startup pitfalls**:
- Privacy notice exists but is only linked in the website footer — not at the actual collection point
- Notice says "we may collect" but doesn't specify what is actually collected
- Mobile app collects data without presenting the notice until after account creation

---

## P 1.2 — Cover all required disclosures

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that the privacy notice covers all required disclosure topics — what data is collected, how it's used, who it's shared with, how long it's retained, and how individuals can exercise their rights. An incomplete notice is a finding even if a notice exists.

**What auditors test**:
- Notice identifies specific types of personal data collected (not just "we collect your information")
- Purpose of collection stated for each data type
- Categories of third parties with whom data is shared
- Retention periods disclosed (or criteria for determining retention)
- Individual rights described: access, correction, deletion, opt-out
- Contact information for privacy inquiries
- Cross-border transfer disclosures (if applicable)

**Evidence to prepare**:
- Privacy notice completeness checklist (mapping each required disclosure to notice section)
- Data inventory mapping data types to collection purposes
- Third-party sharing inventory (categories, not individual vendor names)
- Comparison of privacy notice against applicable regulatory requirements (GDPR Article 13/14, CCPA, etc.)

---

## P 2.1 — Consent and choice

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that individuals have meaningful choice about how their personal data is used. Consent must be informed, specific, and freely given — pre-checked boxes and forced consent bundled with service access are red flags.

**What auditors test**:
- Consent mechanisms: opt-in for sensitive data, opt-out for marketing communications
- Consent is granular: individuals can consent to some uses while declining others
- Consent records: the organization can demonstrate when and how consent was obtained
- Withdrawal mechanism: individuals can revoke consent as easily as they gave it
- No "dark patterns": consent is not obtained through deceptive design

**Evidence to prepare**:
- Consent management platform configuration or consent collection screenshots
- Consent records sample showing timestamp, user, and specific consents granted
- Opt-out mechanism documentation (unsubscribe links, preference centers, account settings)
- Cookie consent banner configuration (if applicable)
- Consent withdrawal process documentation and sample withdrawal records

**Startup pitfalls**:
- Single "I agree to everything" checkbox — no granularity for different uses
- No consent records — impossible to prove what the user agreed to
- Opt-out requires emailing support instead of a self-service mechanism

---

## P 3.1 — Collection limited to purpose

**Priority**: Medium | **NIST**: — | **ISO**: A.5.34

Auditors verify that the organization collects only the personal data necessary for the stated purposes — no more. Data minimization is the principle; collecting "just in case" data is a finding.

**What auditors test**:
- Data collection is limited to what's described in the privacy notice
- Each data field collected has a documented business purpose
- Optional vs. required fields are clearly distinguished in collection forms
- Data minimization reviews: periodic assessment of whether all collected data is still necessary
- New data collection requires privacy review before implementation

**Evidence to prepare**:
- Data inventory mapping each data element to its collection purpose
- Collection form screenshots showing required vs. optional fields
- Privacy impact assessment records for new features or data collection changes
- Data minimization review records (if conducted during audit period)

---

## P 3.2 — Implicit and explicit consent

**Priority**: Medium | **NIST**: — | **ISO**: A.5.34

Auditors verify that the type of consent obtained matches the sensitivity of the data and the applicable regulatory requirements. Explicit consent (affirmative action) is required for sensitive data; implicit consent (reasonable inference from context) may suffice for basic processing.

**What auditors test**:
- Sensitive data categories identified (health, financial, biometric, children's data)
- Explicit consent obtained for sensitive data processing (not implied from continued use)
- Consent type appropriate for jurisdiction: GDPR requires explicit consent for certain processing; CCPA focuses on opt-out rights
- Consent renewal: long-running processing doesn't rely on stale consent from years ago
- Records distinguish between explicit and implicit consent

**Evidence to prepare**:
- Sensitive data inventory with consent type required for each
- Explicit consent collection mechanism (screenshots, UI flows)
- Consent validity tracking (when consent was obtained, when it expires or should be renewed)
- Jurisdiction-specific consent requirements matrix

---

## P 4.1 — Purpose-limited use and retention

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that personal data is used only for the purposes disclosed at collection and retained only as long as necessary. Purpose creep — using data for new purposes without notice or consent — is a significant finding.

**What auditors test**:
- Data use matches the purposes stated in the privacy notice
- New uses of existing data trigger privacy review and updated notice/consent
- Access to personal data is restricted to personnel who need it for the stated purpose
- Purpose limitation enforced technically (access controls, data segregation) not just by policy
- Retention limits enforced: data is actually deleted when the retention period expires

**Evidence to prepare**:
- Purpose-to-use mapping (each purpose in privacy notice → actual processing activities)
- Privacy impact assessments for any new uses of personal data during the audit period
- Access control configuration for personal data stores
- Data retention schedule with evidence of enforcement (deletion logs, purge records)
- Sample of automated retention enforcement (database TTL, object lifecycle rules)

**Startup pitfalls**:
- Analytics tracking collects data for purposes not disclosed in the privacy notice
- Retention period defined in policy but no automated enforcement — data accumulates indefinitely
- Personal data accessible to all engineers via shared database access

---

## P 4.2 — Retention and disposal schedule

**Priority**: Medium | **NIST**: — | **ISO**: A.5.34

Auditors verify that the organization has defined retention periods for personal data categories and disposes of data when those periods expire. The retention schedule should be based on legal requirements, business need, and individual expectations.

**What auditors test**:
- Retention schedule exists covering all personal data categories
- Retention periods are justified (legal requirement, contractual obligation, or documented business need)
- Disposal method is specified per data type (deletion, anonymization, physical destruction)
- Automated enforcement: scheduled jobs that purge expired data
- Disposal verification: evidence that data was actually disposed of per schedule

**Evidence to prepare**:
- Data retention schedule (data type, retention period, justification, disposal method)
- Automated retention enforcement configuration (database TTL, object lifecycle policies)
- Disposal execution logs from the audit period
- Exceptions log: data retained beyond schedule with documented justification
- Anonymization procedures (if used instead of deletion)

---

## P 5.1 — Right of access

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that individuals can request and receive a copy of their personal data. The access process must be documented, accessible, and responsive within regulatory timeframes (30 days for GDPR, 45 days for CCPA).

**What auditors test**:
- Data subject access request (DSAR) process documented and accessible to individuals
- Request channel: easy to find (privacy page, account settings, email address)
- Identity verification: process to confirm the requester is the data subject
- Response completeness: all personal data across all systems is included in the response
- Response timeliness: fulfilled within applicable regulatory timeframes
- Request tracking: log of requests, dates, and response status

**Evidence to prepare**:
- DSAR procedure document
- Request intake form or mechanism (web form, email address, account setting)
- Identity verification process documentation
- DSAR tracking log from the audit period (if requests were received)
- Sample DSAR response format (redacted)
- Data discovery process: how all personal data across systems is located for a request

**Startup pitfalls**:
- No defined DSAR process — requests handled ad-hoc by whoever receives the email
- Data scattered across systems — unable to locate all personal data for a complete response
- No identity verification — anyone can request another person's data

---

## P 5.2 — Correction, amendment, and deletion

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that individuals can request correction of inaccurate data and deletion of their data. The right to deletion is subject to exceptions (legal holds, regulatory requirements), but the process must exist and be documented.

**What auditors test**:
- Correction and deletion request processes documented alongside access requests
- Deletion scope: all systems, backups, and third-party copies addressed
- Exceptions documented: when deletion cannot be fulfilled (legal hold, regulatory retention)
- Confirmation provided to the individual when action is completed
- Third-party notification: vendors who received the data are notified of corrections/deletions

**Evidence to prepare**:
- Correction and deletion procedure documentation
- Deletion scope checklist (all systems where personal data resides)
- Exceptions matrix (when deletion cannot be fulfilled, with legal basis)
- Sample correction/deletion confirmation to individual
- Third-party notification procedure and evidence (if deletions require downstream action)

---

## P 6.1 — Disclosure to third parties

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that personal data is shared with third parties only for disclosed purposes, with appropriate safeguards, and with the individual's knowledge. Every third party receiving personal data should be covered by a data processing agreement or equivalent contract.

**What auditors test**:
- Third-party data sharing inventory: all vendors and partners receiving personal data
- Sharing matches privacy notice disclosures (no undisclosed sharing)
- Data processing agreements (DPAs) in place with all processors of personal data
- Contractual security requirements: DPAs include data protection obligations
- Due diligence: third-party security posture assessed before sharing

**Evidence to prepare**:
- Third-party data sharing inventory (vendor name, data shared, purpose, DPA status)
- Executed DPAs with all data processors
- DPA template showing required security and privacy clauses
- Third-party security assessment records for vendors receiving personal data
- Privacy notice section disclosing third-party sharing categories

---

## P 6.2 — Authorized third-party disclosures

**Priority**: Medium | **NIST**: — | **ISO**: A.5.34

Auditors verify that disclosures to third parties are authorized — either by the individual's consent, contractual necessity, or legal obligation. Unauthorized sharing is a breach of privacy commitments.

**What auditors test**:
- Authorization basis documented for each third-party sharing arrangement
- Consent-based sharing: consent records link to specific third-party disclosures
- Contract-based sharing: agreements specify permitted data uses
- Legal disclosures: process for responding to law enforcement and legal requests
- Audit trail: records of what data was shared with whom and when

**Evidence to prepare**:
- Authorization basis matrix (each sharing arrangement → consent/contract/legal basis)
- Consent records linked to third-party sharing (if consent-based)
- Law enforcement request response procedure
- Data sharing logs or audit trail for the audit period
- Sample of authorized sharing records

---

## P 6.3 — Unauthorized disclosure notification

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that the organization has a process to detect and notify affected individuals and regulators when unauthorized disclosure of personal data occurs. This connects to incident response (CC 7.3) but with privacy-specific notification requirements.

**What auditors test**:
- Breach notification procedure specific to personal data incidents
- Notification timelines defined per jurisdiction (72 hours for GDPR, varies by US state)
- Notification content: what information is included in breach notifications
- Notification channels: how individuals are reached (email, letter, public notice)
- Regulatory notification requirements mapped by jurisdiction and data type
- Breach assessment process: how to determine if notification is required

**Evidence to prepare**:
- Privacy breach notification procedure (standalone or section of IR plan)
- Notification timeline matrix by jurisdiction
- Breach notification template (for individuals and regulators)
- Breach assessment criteria (when notification is triggered vs. when it isn't)
- Sample breach notification (if an incident occurred during the audit period)

---

## P 6.7 — Sub-processor oversight

**Priority**: High | **NIST**: — | **ISO**: A.5.34

Auditors verify that the organization maintains oversight of sub-processors — third parties engaged by your processors to further process personal data. The chain of custody for personal data must be tracked and controlled.

**What auditors test**:
- Sub-processor inventory: processors have disclosed their sub-processors
- Sub-processor changes: notification process when processors add or change sub-processors
- Contractual flow-down: DPAs require processors to impose equivalent obligations on sub-processors
- Individual notification: individuals informed of sub-processor use (typically via privacy notice or DPA)
- Sub-processor security: assessment or reliance on processor's assessment of sub-processor security

**Evidence to prepare**:
- Sub-processor lists from key data processors (usually published on processor's website)
- DPA clauses requiring sub-processor notification and equivalent protections
- Sub-processor change notification records from the audit period
- Process for reviewing and approving sub-processor changes
- Privacy notice or DPA section disclosing sub-processor use

---

## P 7.1 — Data quality assurance

**Priority**: Medium | **NIST**: — | **ISO**: A.5.34

Auditors verify that the organization maintains the accuracy and completeness of personal data throughout its lifecycle. Inaccurate personal data that leads to adverse decisions about individuals is a privacy failure.

**What auditors test**:
- Data quality procedures: input validation, duplicate detection, data cleansing
- Individuals can update their own data: self-service profile management or update request process
- Data accuracy verification: periodic review of data accuracy for critical personal data sets
- Third-party data quality: if personal data is received from third parties, accuracy is verified
- Correction propagation: when data is corrected, all copies and downstream systems are updated

**Evidence to prepare**:
- Input validation rules for personal data fields
- Self-service data management features (account settings screenshots)
- Data quality monitoring metrics (duplicate rates, validation failure rates)
- Correction propagation procedure for multi-system environments
- Data quality review records from the audit period

---

## P 8.1 — Monitoring and enforcement

**Priority**: Medium | **NIST**: — | **ISO**: A.5.34

Auditors verify that the organization monitors compliance with its privacy commitments and has mechanisms to enforce policies. Privacy isn't self-executing — someone must be watching, measuring, and acting on deviations.

**What auditors test**:
- Privacy program governance: named privacy owner or DPO with defined responsibilities
- Privacy compliance monitoring: regular assessments of privacy practice alignment with commitments
- Privacy incident tracking: mechanism to detect and respond to privacy violations
- Employee training: privacy-specific awareness training beyond general security training
- Enforcement: consequences for privacy policy violations (connects to CC 1.5 accountability)

**Evidence to prepare**:
- Privacy program charter or DPO appointment documentation
- Privacy compliance assessment records from the audit period
- Privacy incident log (including near-misses and minor violations)
- Privacy-specific training records with completion rates
- Privacy policy violation response procedures
- Privacy metrics reported to management (DSAR volumes, incidents, training completion)

**Startup pitfalls**:
- No named privacy owner — responsibility diffused across the organization
- Privacy treated as a legal-only concern — no operational monitoring or enforcement
- Privacy training bundled into security training with no privacy-specific content
