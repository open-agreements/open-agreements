---
template_id: working-group-list
title: Working Group List
---

# {deal_name} — Working Group List

Updated: {updated_at}

## Members

| Name | Organization | Role | Email |
| --- | --- | --- | --- |
| {FOR m IN working_group}{$m.name} | {$m.organization} | {$m.role} | {$m.email}{END-FOR m} |
