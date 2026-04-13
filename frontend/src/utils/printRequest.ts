interface PrintItem {
  itemName: string;
  quantity: number;
  unitCost: number;
  specifications?: string | null;
  link?: string | null;
}

interface PrintRequest {
  id: string;
  title: string;
  status: string;
  priority: string;
  totalAmount: number;
  justification: string;
  createdAt: string;
  professorApproval: boolean;
  assistantName?: string | null;
  deliveryLocation?: string | null;
  requiredByDate?: string | null;
  requester: { fullName: string; department?: string | null };
  items: PrintItem[];
}

function formatKRW(amount: number) {
  return '₩' + amount.toLocaleString('ko-KR');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Seoul',
  });
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Pending Review',
    approved: 'Approved',
    queried: 'Under Query',
    declined: 'Declined',
    ordered: 'Ordered',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return map[s] ?? s;
}

function priorityLabel(p: string) {
  const map: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
  return map[p] ?? p;
}

export function printRequest(req: PrintRequest) {
  const itemRows = req.items.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td>${i + 1}</td>
      <td>
        <strong>${item.itemName}</strong>
        ${item.specifications ? `<div class="spec">${item.specifications}</div>` : ''}
        ${item.link ? `<div class="spec"><a href="${item.link}" class="link">${item.link}</a></div>` : ''}
      </td>
      <td class="center">${item.quantity}</td>
      <td class="right">${formatKRW(item.unitCost)}</td>
      <td class="right bold">${formatKRW(item.quantity * item.unitCost)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Procurement Request — ${req.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a2e;
      background: #fff;
      padding: 0;
    }

    /* ── Page layout ─────────────────────────────────────────── */
    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 48px 60px;
    }

    /* ── Header ──────────────────────────────────────────────── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #1d4ed8;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .header-left .org {
      font-size: 9pt;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 3px;
    }
    .header-left .title-big {
      font-size: 20pt;
      font-weight: 700;
      color: #1d4ed8;
      letter-spacing: -0.02em;
    }
    .header-left .subtitle {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .header-right .doc-label {
      font-size: 8.5pt;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .header-right .doc-id {
      font-size: 10pt;
      font-family: monospace;
      color: #374151;
      margin-top: 2px;
    }
    .header-right .doc-date {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 2px;
    }

    /* ── Status ribbon ───────────────────────────────────────── */
    .ribbon {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-left: 4px solid #0ea5e9;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 24px;
    }
    .ribbon .status-badge {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #0369a1;
      background: #e0f2fe;
      padding: 3px 10px;
      border-radius: 20px;
    }
    .ribbon .priority-badge {
      font-size: 8.5pt;
      font-weight: 600;
      color: #92400e;
      background: #fef3c7;
      padding: 3px 10px;
      border-radius: 20px;
    }
    .ribbon .approval-badge {
      font-size: 8.5pt;
      font-weight: 600;
      color: #065f46;
      background: #d1fae5;
      padding: 3px 10px;
      border-radius: 20px;
    }

    /* ── Section titles ──────────────────────────────────────── */
    .section {
      margin-bottom: 22px;
    }
    .section-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }

    /* ── Info grid ───────────────────────────────────────────── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 24px;
    }
    .info-grid.three {
      grid-template-columns: 1fr 1fr 1fr;
    }
    .info-item label {
      font-size: 8pt;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: block;
      margin-bottom: 2px;
    }
    .info-item .value {
      font-size: 10.5pt;
      color: #111827;
      font-weight: 500;
    }
    .info-item .value.light { font-weight: 400; color: #374151; }

    /* ── Justification block ─────────────────────────────────── */
    .justification {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 10.5pt;
      color: #374151;
      line-height: 1.6;
    }

    /* ── Items table ─────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    thead tr {
      background: #1d4ed8;
      color: #fff;
    }
    thead th {
      padding: 8px 12px;
      text-align: left;
      font-size: 8.5pt;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }
    td {
      padding: 9px 12px;
      vertical-align: top;
      border-bottom: 1px solid #e5e7eb;
    }
    td.right { text-align: right; }
    td.center { text-align: center; }
    td.bold { font-weight: 600; }
    .row-even { background: #fff; }
    .row-odd { background: #f8fafc; }
    .spec { font-size: 8.5pt; color: #6b7280; margin-top: 2px; }
    .link { color: #3b82f6; font-size: 8pt; word-break: break-all; }

    /* ── Totals ──────────────────────────────────────────────── */
    .totals-row td {
      border-top: 2px solid #1d4ed8;
      border-bottom: none;
      background: #eff6ff;
      padding: 10px 12px;
    }
    .grand-total {
      font-size: 13pt;
      font-weight: 700;
      color: #1d4ed8;
    }

    /* ── Signature block ─────────────────────────────────────── */
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-top: 40px;
    }
    .sig-box {
      border-top: 1.5px solid #374151;
      padding-top: 8px;
    }
    .sig-box .sig-label {
      font-size: 8pt;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    .sig-box .sig-line {
      margin-top: 32px;
      border-bottom: 1px solid #9ca3af;
    }
    .sig-box .sig-name {
      font-size: 8.5pt;
      color: #374151;
      margin-top: 4px;
    }

    /* ── Footer ──────────────────────────────────────────────── */
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 8pt;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }

    /* ── Print overrides ─────────────────────────────────────── */
    @media print {
      body { padding: 0; }
      .page { padding: 20px 28px 40px; }
      .no-print { display: none !important; }
      table { page-break-inside: avoid; }
      .signatures { page-break-inside: avoid; }
    }

    /* ── Print button (screen only) ──────────────────────────── */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1d4ed8;
      color: #fff;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .print-bar .print-btn {
      background: #fff;
      color: #1d4ed8;
      border: none;
      font-size: 10pt;
      font-weight: 600;
      padding: 6px 20px;
      border-radius: 6px;
      cursor: pointer;
    }
    .print-bar .close-btn {
      background: transparent;
      color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.3);
      font-size: 10pt;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    @media screen {
      .page { margin-top: 56px; }
    }
  </style>
</head>
<body>

<div class="print-bar no-print">
  <span style="font-weight:600; font-size:11pt;">NBSL — Procurement Request</span>
  <div style="display:flex;gap:10px;">
    <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>
</div>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="org">Nondestructive Biosensing Laboratory · Chungnam National University</div>
      <div class="title-big">NBSL</div>
      <div class="subtitle">Procurement Request Form</div>
    </div>
    <div class="header-right">
      <div class="doc-label">Reference No.</div>
      <div class="doc-id">${req.id.slice(-10).toUpperCase()}</div>
      <div class="doc-date">Submitted: ${fmtDate(req.createdAt)}</div>
    </div>
  </div>

  <!-- Status ribbon -->
  <div class="ribbon">
    <span class="status-badge">${statusLabel(req.status)}</span>
    <span class="priority-badge">Priority: ${priorityLabel(req.priority)}</span>
    ${req.professorApproval ? '<span class="approval-badge">✓ Professor Approval Obtained</span>' : ''}
  </div>

  <!-- Request title -->
  <div class="section">
    <div class="section-title">Request Title</div>
    <div style="font-size:15pt; font-weight:700; color:#111827; line-height:1.3;">${req.title}</div>
  </div>

  <!-- Requester info -->
  <div class="section">
    <div class="section-title">Request Information</div>
    <div class="info-grid three">
      <div class="info-item">
        <label>Requested By</label>
        <div class="value">${req.requester.fullName}</div>
      </div>
      ${req.requester.department ? `
      <div class="info-item">
        <label>Department</label>
        <div class="value light">${req.requester.department}</div>
      </div>` : ''}
      ${req.assistantName ? `
      <div class="info-item">
        <label>Assistant</label>
        <div class="value light">${req.assistantName}</div>
      </div>` : ''}
      ${req.requiredByDate ? `
      <div class="info-item">
        <label>Required By</label>
        <div class="value light">${fmtDate(req.requiredByDate)}</div>
      </div>` : ''}
      ${req.deliveryLocation ? `
      <div class="info-item">
        <label>Delivery Location</label>
        <div class="value light">${req.deliveryLocation}</div>
      </div>` : ''}
    </div>
  </div>

  <!-- Justification -->
  <div class="section">
    <div class="section-title">Justification</div>
    <div class="justification">${req.justification}</div>
  </div>

  <!-- Items table -->
  <div class="section">
    <div class="section-title">Procurement Items</div>
    <table>
      <thead>
        <tr>
          <th style="width:36px;">#</th>
          <th>Item Description</th>
          <th class="center" style="width:60px;">Qty</th>
          <th class="right" style="width:110px;">Unit Cost</th>
          <th class="right" style="width:120px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td colspan="4" style="text-align:right; font-size:10pt; font-weight:600; color:#374151;">Grand Total</td>
          <td class="right"><span class="grand-total">${formatKRW(req.totalAmount)}</span></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">Requested By</div>
      <div class="sig-line"></div>
      <div class="sig-name">${req.requester.fullName}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Professor / Supervisor</div>
      <div class="sig-line"></div>
      <div class="sig-name">Signature &amp; Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Administrator</div>
      <div class="sig-line"></div>
      <div class="sig-name">Signature &amp; Date</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>NBSL — Nondestructive Biosensing Lab, Chungnam National University</span>
    <span>Generated ${new Date().toLocaleString('en-KR', { timeZone: 'Asia/Seoul' })}</span>
  </div>

</div>

<script>
  // Auto-open print dialog when in print intent mode
  if (window.location.hash === '#print') {
    window.print();
  }
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) {
    alert('Please allow pop-ups for this site to use the print feature.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
