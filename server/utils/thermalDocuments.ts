type SaleDocument = {
  type: 'sale'
  storeName: string
  address: string
  phone: string
  docLabel: string
  number: string
  seller: string
  items: Array<{
    name: string
    quantity: number
    price: string
    total: string
  }>
  discount?: {
    amount: string
  } | null
  total: string
  paymentSummary: string
  footerNote: string
  footerStrong: string
}

type CashReportCell = {
  text: string
  className?: string
  sub?: string
  colspan?: number
}

type CashReportRow = {
  cells: CashReportCell[]
  className?: string
}

type CashReportBlock =
  | { type: 'section-title', title: string }
  | { type: 'table', columns?: CashReportCell[], rows: CashReportRow[] }
  | { type: 'grand', label: string, value: string }
  | { type: 'sign', label: string }
  | { type: 'footer', text?: string, strong?: string }

type CashReportDocument = {
  type: 'cash-report'
  variant?: 'standard' | 'compact'
  title: string
  storeName: string
  registerName: string
  responsible: string
  docTitle: string
  docDate: string
  docSubtitle: string
  blocks: CashReportBlock[]
}

export type ThermalDocument = SaleDocument | CashReportDocument

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function thermalCss() {
  return `
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 12px; }
    .ticket { width: 80mm; margin: 0 auto; padding: 5mm; border: 1px solid #111; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.35; }
    header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 7px; }
    h1 { margin: 0; font-size: 17px; font-weight: 900; }
    header p { margin: 3px 0 0; font-size: 11px; color: #000; }
    .doc { margin: 8px 0; padding: 6px; border: 1px solid #000; text-align: center; }
    .doc span, .section-title { color: #000; font-size: 10px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
    .doc strong { display: block; margin-top: 3px; font: 900 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .doc small { display: block; margin-top: 3px; color: #000; font-size: 10px; }
    .meta { display: grid; gap: 3px; }
    .meta div, .summary div, .payment div, .item-main, .total { display: flex; justify-content: space-between; gap: 8px; }
    .section-title { display: flex; align-items: center; gap: 8px; margin: 10px 0 4px; }
    .section-title:before, .section-title:after { content: ""; height: 1px; flex: 1; background: #000; }
    .item { padding: 6px 0; border-bottom: 1px dashed #000; break-inside: avoid; }
    .item strong, .summary strong, .meta b { font-weight: 900; }
    .item-main strong { min-width: 0; padding-right: 6px; overflow-wrap: anywhere; }
    .item b, .summary b, .payment b, .total b { font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
    .item-meta, .meta, .payment, small { color: #000; }
    ul { margin: 2px 0 0 8px; padding-left: 8px; color: #000; }
    .summary, .payment { display: grid; gap: 3px; }
    .total { margin-top: 8px; padding-top: 8px; border-top: 2px solid #000; align-items: baseline; font-size: 16px; font-weight: 900; text-transform: uppercase; }
    .total b { font-size: 16px; }
    table.rpt { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.rpt td, table.rpt th { padding: 4px 0; font-size: 12px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    table.rpt th { font-size: 10px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; }
    table.rpt td small, table.rpt .sub { display: block; font-size: 10px; }
    table.rpt .amt { text-align: right; font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; width: 22mm; }
    table.rpt th.amt { font-size: 10px; }
    table.rpt .qty { text-align: center; font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; width: 9mm; }
    table.rpt .unit { text-align: right; font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; width: 17mm; }
    table.rpt .time { font: 900 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; width: 13mm; }
    table.rpt tr.line td { border-bottom: 1px dashed #000; }
    table.rpt tr.strong td { border-top: 1px solid #000; font-weight: 900; padding-top: 6px; }
    table.rpt tr.strong .amt { font-size: 13px; }
    .grand { margin-top: 8px; padding-top: 8px; border-top: 2px solid #000; display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 14px; font-weight: 900; }
    .grand b { font: 900 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
    .sign { margin-top: 24px; text-align: center; }
    .sign .line { border-top: 1px solid #000; margin: 0 6mm; padding-top: 4px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
    footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #000; text-align: center; color: #000; font-size: 11px; }
    footer strong { display: block; margin-top: 3px; color: #000; }
    .ticket.compact-report { padding: 2px 4mm 2mm; border: 0; font-size: 11px; line-height: 1.25; }
    .compact-report header { padding-bottom: 4px; }
    .compact-report h1 { font-size: 16px; }
    .compact-report header p { margin-top: 1px; font-size: 10px; }
    .compact-report .doc { margin: 5px 0; padding: 0 0 5px; border: 0; border-bottom: 1px dashed #000; }
    .compact-report .doc strong { margin-top: 2px; font-size: 12px; white-space: nowrap; }
    .compact-report .doc small { margin-top: 2px; }
    .compact-report table.rpt { margin-top: 5px; }
    .compact-report table.rpt td, .compact-report table.rpt th { padding: 4px 2px; }
    .compact-report table.rpt th:first-child, .compact-report table.rpt td:first-child { padding-left: 0; }
    .compact-report table.rpt th:last-child, .compact-report table.rpt td:last-child { padding-right: 0; }
    .compact-report table.rpt th { font-size: 9px; }
    .compact-report table.rpt .amt { width: 19mm; }
    .compact-report footer { margin-top: 9px; padding-top: 6px; font-size: 10px; }
    .ticket.sale-ticket { padding: 2px 4mm 2mm; border: 0; font-size: 11px; line-height: 1.25; }
    .sale-ticket header { padding-bottom: 4px; }
    .sale-ticket h1 { font-size: 16px; }
    .sale-ticket header p { margin-top: 1px; font-size: 10px; white-space: nowrap; }
    .sale-ticket .doc { margin: 5px 0; padding: 0 0 5px; border: 0; border-bottom: 1px dashed #000; }
    .sale-ticket .doc strong { margin-top: 2px; font-size: 12px; white-space: nowrap; }
    .sale-ticket .meta div, .sale-ticket .payment div { display: flex; justify-content: space-between; gap: 8px; }
    .sale-ticket .meta b { min-width: 0; overflow-wrap: anywhere; text-align: right; }
    .sale-ticket .section-title { margin: 7px 0 3px; }
    table.sale-lines { width: 100%; margin-top: 5px; border-collapse: collapse; table-layout: fixed; }
    table.sale-lines .qty-col { width: 9mm; }
    table.sale-lines .unit-col { width: 17mm; }
    table.sale-lines .amount-col { width: 19mm; }
    table.sale-lines th, table.sale-lines td { padding: 4px 2px; vertical-align: top; }
    table.sale-lines th:first-child, table.sale-lines td:first-child { padding-left: 0; }
    table.sale-lines th:last-child, table.sale-lines td:last-child { padding-right: 0; }
    table.sale-lines th { border-bottom: 1px solid #000; font-size: 9px; font-weight: 900; text-align: left; text-transform: uppercase; }
    table.sale-lines tbody td { border-bottom: 1px dashed #000; break-inside: avoid; }
    table.sale-lines .detail { overflow-wrap: anywhere; }
    table.sale-lines .qty { text-align: center; }
    table.sale-lines .unit, table.sale-lines .amt { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 900; white-space: nowrap; }
    table.sale-lines .discount-row td { padding-top: 5px; font-weight: 700; }
    table.sale-lines .total-row td { padding-top: 6px; border-top: 2px solid #000; font-size: 15px; font-weight: 900; text-transform: uppercase; }
    table.sale-lines .total-row .amt { font-size: 14px; }
    .sale-ticket .payment { display: grid; gap: 3px; }
    .sale-ticket .payment b { font: 900 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
    .sale-ticket footer { margin-top: 9px; padding-top: 6px; font-size: 10px; }
  `
}

function renderShell(title: string, content: string, ticketClass = '') {
  const className = ticketClass ? `ticket ${ticketClass}` : 'ticket'

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${thermalCss()}</style>
</head>
<body>
  <main class="${className}">${content}</main>
</body>
</html>`
}

function renderSaleDocument(doc: SaleDocument) {
  const rows = doc.items.map(item => `
    <tr>
      <td class="qty">${escapeHtml(item.quantity)}</td>
      <td class="detail">${escapeHtml(item.name)}</td>
      <td class="unit">${escapeHtml(item.price)}</td>
      <td class="amt">${escapeHtml(item.total)}</td>
    </tr>
  `).join('')
  const discount = doc.discount
    ? `<tr class="discount-row"><td colspan="3">Descuento</td><td class="amt">${escapeHtml(doc.discount.amount)}</td></tr>`
    : ''

  return renderShell(doc.number, `
    <header>
      <h1>${escapeHtml(doc.storeName)}</h1>
      <p>${escapeHtml(doc.address)} | ${escapeHtml(doc.phone)}</p>
    </header>
    <section class="doc">
      <span>${escapeHtml(doc.docLabel)}</span>
      <strong>${escapeHtml(doc.number)}</strong>
    </section>
    <section class="meta"><div><span>Atendió</span><b>${escapeHtml(doc.seller)}</b></div></section>
    <table class="sale-lines">
      <colgroup><col class="qty-col"><col><col class="unit-col"><col class="amount-col"></colgroup>
      <thead><tr><th class="qty">Cant.</th><th>Detalle</th><th class="unit">P/U</th><th class="amt">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        ${discount}
        <tr class="total-row"><td colspan="3">Total Bs</td><td class="amt">${escapeHtml(doc.total)}</td></tr>
      </tfoot>
    </table>
    <div class="section-title">Cobro</div>
    <section class="payment">
      <div><span>Método</span><b>${escapeHtml(doc.paymentSummary)}</b></div>
    </section>
    <footer>
      <em>${escapeHtml(doc.footerNote)}</em>
      <strong>${escapeHtml(doc.footerStrong)}</strong>
    </footer>
  `, 'sale-ticket')
}

function renderCell(cell: CashReportCell, tag: 'td' | 'th') {
  const classAttr = cell.className ? ` class="${escapeHtml(cell.className)}"` : ''
  const colspanAttr = cell.colspan && cell.colspan > 1 ? ` colspan="${Math.min(Math.floor(cell.colspan), 6)}"` : ''
  const sub = cell.sub ? `<span class="sub">${escapeHtml(cell.sub)}</span>` : ''
  return `<${tag}${classAttr}${colspanAttr}>${escapeHtml(cell.text)}${sub}</${tag}>`
}

function renderCashBlock(block: CashReportBlock) {
  if (block.type === 'section-title') {
    return `<div class="section-title">${escapeHtml(block.title)}</div>`
  }

  if (block.type === 'grand') {
    return `<div class="grand"><span>${escapeHtml(block.label)}</span><b>${escapeHtml(block.value)}</b></div>`
  }

  if (block.type === 'sign') {
    return `<div class="sign"><div class="line">${escapeHtml(block.label)}</div></div>`
  }

  if (block.type === 'footer') {
    return `<footer>${block.text ? `<em>${escapeHtml(block.text)}</em>` : ''}${block.strong ? `<strong>${escapeHtml(block.strong)}</strong>` : ''}</footer>`
  }

  const head = block.columns?.length
    ? `<thead><tr>${block.columns.map(cell => renderCell(cell, 'th')).join('')}</tr></thead>`
    : ''
  const rows = block.rows.map(row => {
    const classAttr = row.className ? ` class="${escapeHtml(row.className)}"` : ''
    return `<tr${classAttr}>${row.cells.map(cell => renderCell(cell, 'td')).join('')}</tr>`
  }).join('')

  return `<table class="rpt">${head}<tbody>${rows}</tbody></table>`
}

function renderCashReportDocument(doc: CashReportDocument) {
  return renderShell(doc.title, `
    <header>
      <h1>${escapeHtml(doc.storeName)}</h1>
      <p>${escapeHtml(doc.registerName)}</p>
      <p>Responsable: ${escapeHtml(doc.responsible)}</p>
    </header>
    <section class="doc">
      <span>${escapeHtml(doc.docTitle)}</span>
      <strong>${escapeHtml(doc.docDate)}</strong>
      <small>${escapeHtml(doc.docSubtitle)}</small>
    </section>
    ${doc.blocks.map(renderCashBlock).join('')}
  `, doc.variant === 'compact' ? 'compact-report' : '')
}

export function renderThermalDocumentHtml(document: ThermalDocument) {
  if (document.type === 'sale') {
    return renderSaleDocument(document)
  }

  return renderCashReportDocument(document)
}
