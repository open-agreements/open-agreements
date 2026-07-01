---
template_id: working-group-list
title: Working Group List
document:
  title: Working Group List
  version: "1.0"
  license: CC0-1.0
---

# {deal_name} — Working Group List

Updated: {updated_at}

## Members

| Name | Organization | Role | Email |
| --- | --- | --- | --- |
| {FOR m IN working_group}{$m.name} | {$m.organization} | {$m.role} | {$m.email}{END-FOR m} |
