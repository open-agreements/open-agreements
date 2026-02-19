import { ClosingChecklistSchema, type ClosingChecklist } from './schemas.js';

export { ClosingChecklistSchema, type ClosingChecklist } from './schemas.js';

/**
 * Render a closing checklist as Markdown (for CLI `checklist render` command).
 */
export function renderChecklistMarkdown(data: unknown): string {
  const c = ClosingChecklistSchema.parse(data);

  const lines: string[] = [];
  lines.push(`# ${c.deal_name} — Closing Checklist`);
  lines.push(`*Updated: ${c.updated_at}*`);
  lines.push('');

  if (c.working_group.length > 0) {
    lines.push('## Working Group');
    lines.push('| Name | Organization | Role | Email |');
    lines.push('|------|-------------|------|-------|');
    for (const m of c.working_group) {
      lines.push(`| ${m.name} | ${m.organization} | ${m.role ?? ''} | ${m.email ?? ''} |`);
    }
    lines.push('');
  }

  if (c.documents.length > 0) {
    lines.push('## Documents');
    lines.push('| Document | Status |');
    lines.push('|----------|--------|');
    for (const d of c.documents) {
      lines.push(`| ${d.document_name} | ${d.status} |`);
    }
    lines.push('');
  }

  if (c.action_items.length > 0) {
    lines.push('## Action Items');
    lines.push('| ID | Description | Status | Assigned To | Due Date |');
    lines.push('|----|-------------|--------|-------------|----------|');
    for (const a of c.action_items) {
      const assignee = a.assigned_to.individual_name ?? a.assigned_to.organization;
      lines.push(`| ${a.item_id} | ${a.description} | ${a.status} | ${assignee} | ${a.due_date ?? ''} |`);
    }
    lines.push('');
  }

  if (c.open_issues.length > 0) {
    lines.push('## Open Issues');
    lines.push('| ID | Title | Status | Escalation | Our Position | Their Position | Resolution |');
    lines.push('|----|-------|--------|------------|-------------|---------------|------------|');
    for (const i of c.open_issues) {
      lines.push(`| ${i.issue_id} | ${i.title} | ${i.status} | ${i.escalation_tier ?? ''} | ${i.our_position ?? ''} | ${i.their_position ?? ''} | ${i.resolution ?? ''} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
