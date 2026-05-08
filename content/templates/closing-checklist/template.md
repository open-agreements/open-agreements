---
template_id: closing-checklist
title: Closing Checklist
---

# {deal_name} — Closing Checklist

Updated: {updated_at}

## Documents

| ID | Title | Link | Status | Responsible |
| --- | --- | --- | --- | --- |
| {FOR d IN documents}{$d.entry_id} | {$d.title} | {$d.link} | {$d.status} | {$d.responsible}{END-FOR d} |

## Action Items

| ID | Description | Status | Assigned To | Due Date |
| --- | --- | --- | --- | --- |
| {FOR a IN action_items}{$a.item_id} | {$a.description} | {$a.status} | {$a.assigned_to} | {$a.due_date}{END-FOR a} |

## Open Issues

| ID | Title | Status | Summary | Citation |
| --- | --- | --- | --- | --- |
| {FOR i IN open_issues}{$i.issue_id} | {$i.title} | {$i.status} | {$i.summary} | {$i.citation}{END-FOR i} |
