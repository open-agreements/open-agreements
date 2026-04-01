import type { AnalysisSummary } from '../../../contracts-workspace/src/core/types.js';

/**
 * Build an HTML dashboard for the contract portfolio.
 * Self-contained — all CSS/JS inline. Designed for MCP Apps ui:// rendering.
 */
export function buildDashboardHtml(summary: AnalysisSummary, totalDocuments: number): string {
  const { analyzed_documents, unanalyzed_documents, stale_documents, orphaned_sidecars, by_document_type, expiring_soon } = summary;

  const typeRows = Object.entries(by_document_type)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td class="num">${count}</td></tr>`)
    .join('\n');

  const expiringRows = expiring_soon
    .map((e) => `<tr><td>${escapeHtml(e.path)}</td><td>${escapeHtml(e.document_type)}</td><td>${escapeHtml(e.expiration_date)}</td></tr>`)
    .join('\n');

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
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin-bottom: 24px;
  }
  .card {
    background: #fff; border-radius: 8px; padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .card .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .card .value.green { color: #16a34a; }
  .card .value.amber { color: #d97706; }
  .card .value.red { color: #dc2626; }
  .card .value.blue { color: #2563eb; }
  .section { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  .empty { color: #999; font-style: italic; padding: 12px; }
  .bar { display: flex; align-items: center; gap: 8px; }
  .bar-fill { height: 20px; border-radius: 4px; background: #3b82f6; min-width: 2px; }
  .bar-label { font-size: 12px; color: #666; white-space: nowrap; }
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
    <div class="label">Unindexed</div>
    <div class="value${unanalyzed_documents > 0 ? ' amber' : ''}">${unanalyzed_documents}</div>
  </div>
  <div class="card">
    <div class="label">Stale</div>
    <div class="value${stale_documents > 0 ? ' red' : ''}">${stale_documents}</div>
  </div>
  <div class="card">
    <div class="label">Orphaned</div>
    <div class="value${orphaned_sidecars > 0 ? ' red' : ''}">${orphaned_sidecars}</div>
  </div>
</div>

<div class="section">
  <h2>Document Types</h2>
  ${typeRows.length > 0 ? `<table><thead><tr><th>Type</th><th style="text-align:right">Count</th></tr></thead><tbody>${typeRows}</tbody></table>` : '<div class="empty">No indexed contracts yet.</div>'}
</div>

<div class="section">
  <h2>Expiring Soon (next 90 days)</h2>
  ${expiringRows.length > 0 ? `<table><thead><tr><th>Contract</th><th>Type</th><th>Expires</th></tr></thead><tbody>${expiringRows}</tbody></table>` : '<div class="empty">No contracts expiring in the next 90 days.</div>'}
</div>

</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
