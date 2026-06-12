# Incident Response Rules

Per-control audit guidance for incident management lifecycle.

## A.5.24 — Incident Management Planning and Preparation

**Tier**: Critical | **NIST**: IR-1, IR-2, IR-3, IR-6, IR-8

Define and maintain an incident response plan that covers roles, communication procedures, escalation paths, and post-incident review processes. The plan should be tested regularly.

**Auditor hints**:
- Auditors check three things: (1) plan exists, (2) plan has been tested, (3) people know the plan
- A plan that hasn't been tested in > 12 months is a finding
- "Tested" means tabletop exercise at minimum — a full simulation is ideal but not required for startups
- The plan must include notification requirements (regulatory deadlines: GDPR 72 hours, etc.)
- Contact lists must be current — auditors will spot-check phone numbers

**Evidence collection**:
- Incident response plan document (with version date)
- Tabletop exercise records (date, participants, scenario, findings)
- Communication tree / contact list (with last-verified date)
- Training records showing IR training for relevant personnel

---

## A.5.25 — Assessment and Decision on Information Security Events

**Tier**: Critical | **NIST**: IR-4, IR-5, IR-8

Establish criteria for assessing whether security events are incidents, and define severity classification. Events should be triaged consistently using documented criteria.

**Auditor hints**:
- Auditors want to see a CLASSIFICATION SCHEME — not just "high/medium/low" but criteria for each level
- They'll ask: "Show me an event that was NOT classified as an incident" to verify triage works both ways
- The gap between "event" and "incident" is where findings hide — if everything is an incident, triage isn't working; if nothing is, detection isn't working

**Evidence collection**:
- Event classification criteria document
- Sample of security events with triage decisions
- Ticketing system export showing event-to-incident workflow

```bash
# GitHub security alerts (sample of events)
gh api repos/{owner}/{repo}/security-advisories --paginate | jq '.[0:5]'

# If using PagerDuty:
# curl -H "Authorization: Token token={api_key}" https://api.pagerduty.com/incidents?limit=10
```

---

## A.5.26 — Response to Information Security Incidents

**Tier**: Critical | **NIST**: IR-4, IR-6, IR-8, IR-9

Respond to incidents according to the documented plan. Contain the impact, preserve evidence, and communicate with stakeholders. Document all response actions.

**Auditor hints**:
- Auditors will review actual incident records, not just the plan
- They look for: timeline of response actions, evidence of containment, stakeholder notifications
- If there have been zero incidents in the audit period, they'll ask about NEAR-MISSES to verify the detection and response capability exists
- Post-incident review (lessons learned) is required — just closing the ticket isn't enough

**Evidence collection**:
- Incident tickets with full timeline
- Communication records (internal alerts, external notifications)
- Containment actions documented
- Post-incident review records

---

## A.5.27 — Learning from Information Security Incidents

**Tier**: Checkbox | **NIST**: IR-9

Use incident knowledge to strengthen controls, update procedures, and prevent recurrence. Feed lessons learned back into risk assessment and control improvements.

**Auditor hints**:
- This is about demonstrating a feedback loop — incident → root cause → corrective action → control update
- Auditors check: "After your last incident, what changed?" If nothing changed, it's a finding
- Maintain an incident register that tracks both the incident AND the resulting improvements

---

## A.5.28 — Collection of Evidence

**Tier**: Checkbox | **NIST**: IR-4

Establish procedures for collecting, preserving, and handling evidence related to security incidents, ensuring admissibility and chain of custody where legal proceedings may follow.

**Auditor hints**:
- Startups rarely need forensic-grade evidence preservation, but auditors check that logs aren't tampered with
- Key question: "If you had a breach, could you reconstruct what happened?" If logs rotate too fast or aren't centralized, the answer is no
- Immutable log storage (write-once) is best practice for audit trails

---

## A.5.29 — Information Security During Disruption

**Tier**: Checkbox | **NIST**: IR-4

Maintain information security controls during business disruptions. Security shouldn't be bypassed during incidents, outages, or DR scenarios.

**Auditor hints**:
- Classic failure: disabling MFA or firewall rules during an outage "to speed up recovery"
- DR plans should explicitly state which security controls remain active during failover
- If you have a "break glass" procedure (emergency admin access), it must be logged and reviewed

---

## A.6.8 — Information Security Event Reporting

**Tier**: Relevant | **NIST**: IR-4, IR-6

All personnel should know how to report security events. There should be a clear, accessible reporting channel and no negative consequences for good-faith reporting.

**Auditor hints**:
- Auditors ask random employees: "If you noticed suspicious activity, who would you report it to?"
- The reporting channel must be EASY — a Slack channel, email alias, or phone number
- Training records should show that employees have been told how to report events
- No-retaliation policy should be documented

**Evidence collection**:
- Security event reporting procedure
- Training records showing reporting awareness
- Sample of reported events (even false positives demonstrate the system works)
- Communication channel configuration (Slack channel, email alias)
