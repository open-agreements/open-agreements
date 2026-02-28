/**
 * Human-readable labels for checklist enum statuses.
 */
export const STATUS_LABELS: Record<string, string> = {
  // ChecklistEntryStatusEnum
  NOT_STARTED: 'Not Started',
  DRAFT: 'Draft',
  CIRCULATED: 'Circulated',
  FORM_FINAL: 'Form Final',
  PARTIALLY_SIGNED: 'Partially Signed',
  FULLY_EXECUTED: 'Fully Executed',
  DELIVERED: 'Delivered',
  FILED_OR_RECORDED: 'Filed / Recorded',

  // ChecklistItemStatusEnum (action items)
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',

  // SignatoryStatusEnum
  PENDING: 'Pending',
  RECEIVED: 'Received',
  N_A: 'N/A',

  // IssueStatusEnum
  OPEN: 'Open',
  CLOSED: 'Closed',
};

export function humanStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
