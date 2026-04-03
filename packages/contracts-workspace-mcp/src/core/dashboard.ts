import type { AnalysisSummary, DocumentRecord } from '../../../contracts-workspace/src/core/types.js';

/**
 * Build an HTML dashboard for the contract portfolio.
 * Self-contained — all CSS/JS inline. Designed for MCP Apps ui:// rendering.
 */
export function buildDashboardHtml(summary: AnalysisSummary, documents: DocumentRecord[]): string {
  const {
    analyzed_documents, unanalyzed_documents, stale_documents, orphaned_sidecars,
    pending_signature, expiring_30_days, expiring_30_90_days,
    by_document_type, expiring_soon,
  } = summary;

  const totalDocuments = documents.length;

  const typeRows = Object.entries(by_document_type)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `<tr><td>${esc(type)}</td><td class="num">${count}</td></tr>`)
    .join('\n');

  // Build document table rows — sorted by expiration date (soonest first)
  const indexedDocs = documents
    .filter((d) => d.analyzed)
    .sort((a, b) => {
      const aExp = a.classification?.expiration_date ?? '9999-12-31';
      const bExp = b.classification?.expiration_date ?? '9999-12-31';
      return aExp.localeCompare(bExp);
    });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const docRows = indexedDocs.map((d) => {
    const cls = d.classification;
    if (!cls) return '';
    const expDate = cls.expiration_date ? new Date(cls.expiration_date) : null;
    const isUrgent = expDate && expDate >= now && expDate <= thirtyDaysFromNow;
    const rowClass = isUrgent ? ' class="urgent"' : '';
    const counterparty = cls.parties.length > 0 ? cls.parties[0] : '—';
    const expires = cls.expiration_date ?? '—';
    const status = cls.status ?? '—';
    const autoRenew = cls.auto_renewal === true ? 'Yes' : cls.auto_renewal === false ? 'No' : '—';
    const rename = cls.suggested_rename ? `<span class="rename" title="${esc(cls.suggested_rename)}">📎</span>` : '';
    return `<tr${rowClass}><td title="${esc(cls.summary)}">${esc(d.path)}${rename}</td><td>${esc(cls.document_type ?? '—')}</td><td>${esc(counterparty)}</td><td>${esc(expires)}</td><td>${esc(status)}</td><td>${esc(autoRenew)}</td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contract Portfolio Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8f9fa; color: #1a1a2e; padding: 24px;
  }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #1a1a2e; }
  h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #333; }

  .cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px; margin-bottom: 24px;
  }
  .card {
    background: #fff; border-radius: 8px; padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .card .value.blue { color: #2563eb; }
  .card .value.green { color: #16a34a; }
  .card .value.red { color: #dc2626; }
  .card .value.amber { color: #d97706; }

  .section {
    background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .table-scroll { max-height: 400px; overflow-y: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e7eb;
    font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase;
    position: sticky; top: 0; background: #fff;
  }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  tr.urgent td { background: #fef2f2; }
  .empty { color: #999; font-style: italic; padding: 12px; }
  .rename { cursor: help; margin-left: 4px; font-size: 12px; }

  .health {
    display: flex; gap: 24px; padding: 12px 16px;
    background: #f1f5f9; border-radius: 8px; font-size: 12px; color: #64748b;
  }
  .health span { font-weight: 600; }
</style>
</head>
<body>
<h1>Contract Portfolio</h1>

<div class="cards">
  <div class="card">
    <div class="label">Total</div>
    <div class="value blue">${totalDocuments}</div>
  </div>
  <div class="card">
    <div class="label">Indexed</div>
    <div class="value green">${analyzed_documents}</div>
  </div>
  <div class="card">
    <div class="label">Expiring &lt; 30d</div>
    <div class="value${expiring_30_days > 0 ? ' red' : ''}">${expiring_30_days}</div>
  </div>
  <div class="card">
    <div class="label">Expiring 30-90d</div>
    <div class="value${expiring_30_90_days > 0 ? ' amber' : ''}">${expiring_30_90_days}</div>
  </div>
  <div class="card">
    <div class="label">Pending Signature</div>
    <div class="value${pending_signature > 0 ? ' amber' : ''}">${pending_signature}</div>
  </div>
</div>

<div class="section">
  <h2>Contracts</h2>
  ${docRows.length > 0 ? `<div class="table-scroll"><table>
    <thead><tr><th>Path</th><th>Type</th><th>Counterparty</th><th>Expires</th><th>Status</th><th>Auto-Renew</th></tr></thead>
    <tbody>${docRows}</tbody>
  </table></div>` : '<div class="empty">No indexed contracts yet.</div>'}
</div>

<div class="section">
  <h2>Document Types</h2>
  ${typeRows.length > 0 ? `<table><thead><tr><th>Type</th><th style="text-align:right">Count</th></tr></thead><tbody>${typeRows}</tbody></table>` : '<div class="empty">No data.</div>'}
</div>

<div class="health">
  Unindexed: <span>${unanalyzed_documents}</span> &nbsp;|&nbsp;
  Stale: <span>${stale_documents}</span> &nbsp;|&nbsp;
  Orphaned: <span>${orphaned_sidecars}</span>
</div>

</body>
</html>`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
