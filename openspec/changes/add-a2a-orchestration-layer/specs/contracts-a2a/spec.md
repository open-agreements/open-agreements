## ADDED Requirements

### Requirement: Canonical Task Envelope
The system SHALL define a canonical A2A task envelope for delegated contract
workflow actions. The envelope MUST include actor identity, action type,
resource context, matter context, idempotency key, and request metadata.

#### Scenario: Valid envelope accepted
- **WHEN** a caller submits a task envelope with all required fields
- **THEN** the orchestrator accepts the request
- **AND** returns a stable task identifier

#### Scenario: Missing required envelope field rejected
- **WHEN** a caller submits a task envelope without required actor or action fields
- **THEN** the orchestrator rejects the request with validation errors
- **AND** no task is queued

### Requirement: Deterministic Task Lifecycle
The orchestrator SHALL enforce deterministic task state transitions.

#### Scenario: Standard successful lifecycle
- **WHEN** a valid task is processed successfully
- **THEN** the task transitions through `requested`, `validated`, `queued`, `in_progress`, and `succeeded`
- **AND** each transition is recorded in execution history

#### Scenario: Invalid transition blocked
- **WHEN** a client attempts to transition a task from `requested` directly to `succeeded`
- **THEN** the orchestrator rejects the transition
- **AND** records an invalid-transition error

### Requirement: Idempotency and Retry Safety
The orchestrator SHALL support idempotent task submission and bounded retries
for transient failures.

#### Scenario: Duplicate submission deduplicated
- **WHEN** a caller re-submits the same task envelope with the same idempotency key
- **THEN** the orchestrator returns the existing task identifier
- **AND** does not execute side effects twice

#### Scenario: Retry exhausted transitions to dead-letter
- **WHEN** task execution fails repeatedly beyond configured retry limits
- **THEN** task status transitions to `dead_letter`
- **AND** retry attempt history is preserved

### Requirement: Capability-Scoped Delegation
The system SHALL route delegated actions to workers based on a capability
registry and explicit action allowlists.

#### Scenario: Action routed to matching worker capability
- **WHEN** a task requests a supported signature action
- **THEN** the orchestrator routes it to the configured signature worker adapter
- **AND** records the worker assignment in execution history

#### Scenario: Unsupported capability rejected
- **WHEN** a task requests an action with no registered worker capability
- **THEN** the task is rejected with a capability-not-found error

### Requirement: Governance Context Binding
For sensitive actions, task envelopes SHALL include governance context
references and execution MUST validate policy/approval requirements.

#### Scenario: Sensitive task blocked without governance references
- **WHEN** a sensitive action task is submitted without required policy or approval context
- **THEN** the orchestrator blocks execution
- **AND** returns a governance-context-required error

#### Scenario: Sensitive task executes with valid approvals
- **WHEN** a sensitive action task includes valid policy context and completed approval references
- **THEN** execution proceeds
- **AND** governance references are stored with task results

### Requirement: Delegation Audit Provenance
The orchestrator SHALL emit audit events for submission, delegation, retry,
cancellation, failure, and completion.

#### Scenario: Delegation event includes actor and worker
- **WHEN** a task is delegated from coordinator to worker
- **THEN** an audit event records submitting actor, receiving worker capability, and action

#### Scenario: Failure event includes reason
- **WHEN** task execution fails
- **THEN** an audit event records failure code and reason
- **AND** links the event to the task identifier

### Requirement: Shared Orchestration Core Across A2A and MCP
The system SHALL execute delegated-task semantics through one canonical
orchestration core used by both A2A and MCP transports.

#### Scenario: A2A and MCP submissions resolve to same canonical task identity
- **WHEN** equivalent task requests are submitted through A2A and MCP with the same idempotency key scope
- **THEN** both transports resolve to the same canonical task identifier
- **AND** side effects are executed at most once

#### Scenario: MCP bridge does not bypass orchestration guards
- **WHEN** an MCP caller submits a sensitive action task
- **THEN** the same policy/approval validation path as A2A is enforced
- **AND** the task is rejected if governance requirements are not satisfied

### Requirement: Agent Discovery and Contracts Capability Profile
The system SHALL publish an agent discovery profile containing a versioned
contracts capability profile with supported actions, governance modes, evidence
semantics, and orchestration endpoints.

#### Scenario: Client discovers supported contract actions
- **WHEN** an agent client fetches the discovery profile
- **THEN** the response includes supported contract actions and profile version
- **AND** identifies which actions are required vs optional extensions

#### Scenario: Unsupported profile version is rejected
- **WHEN** a client requests an unsupported contracts profile version
- **THEN** the system rejects the request with a version-compatibility error
- **AND** returns supported profile versions

### Requirement: A2A and MCP Parity Conformance
The system SHALL define and run parity tests to verify that A2A and MCP produce
equivalent orchestration semantics for submit, status, retry, and cancel
operations.

#### Scenario: Parity suite validates equivalent terminal outcomes
- **WHEN** the parity suite runs against golden task traces
- **THEN** equivalent A2A and MCP requests reach the same terminal state
- **AND** differences are limited to transport metadata fields

### Requirement: A2A, CLI, and MCP Orchestration Operations
The system SHALL expose A2A orchestration operations directly and provide CLI
and MCP bridge operations for task submission, status retrieval, retry, and
cancellation.

#### Scenario: A2A task submit returns canonical metadata
- **WHEN** an agent submits a valid task through A2A
- **THEN** the system returns canonical task id, current state, and correlation metadata

#### Scenario: CLI task status query
- **WHEN** a user runs CLI status for an existing task identifier
- **THEN** the CLI returns current status and transition history summary

#### Scenario: MCP retry operation
- **WHEN** an MCP client retries a failed eligible task
- **THEN** the orchestrator enqueues a new execution attempt
- **AND** returns updated attempt metadata
