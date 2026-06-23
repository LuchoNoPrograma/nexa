type SaleDocument = {
  type: 'sale'
  storeName: string
  address: string
  phone: string
  docLabel: string
  number: string
  dateLabel: string
  seller: string
  items: Array<{
    name: string
    quantity: number
    price: string
    total: string
    kind?: string
  }>
  subtotal: string
  discount?: {
    label: string
    amount: string
  } | null
  total: string
  paymentSummary: string
  payments: Array<{
    label: string
    amount: string
  }>
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
    body { margin: 0; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 10px; }
    .ticket { width: 80mm; margin: 0 auto; padding: 5mm; border: 1px solid #111; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.25; }
    header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 7px; }
    h1 { margin: 0; font-size: 14px; font-weight: 900; }
    header p { margin: 2px 0 0; font-size: 9px; color: #000; }
    .doc { margin: 8px 0; padding: 6px; border: 1px solid #000; text-align: center; }
    .doc span, .section-title { color: #000; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .doc strong { display: block; margin-top: 2px; font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .doc small { display: block; margin-top: 2px; color: #000; font-size: 8px; }
    .meta { display: grid; gap: 3px; }
    .meta div, .summary div, .payment div, .item-main, .total { display: flex; justify-content: space-between; gap: 8px; }
    .section-title { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; }
    .section-title:before, .section-title:after { content: ""; height: 1px; flex: 1; background: #000; }
    .item { padding: 5px 0; border-bottom: 1px dashed #000; break-inside: avoid; }
    .item strong, .summary strong, .meta b { font-weight: 900; }
    .item-main strong { min-width: 0; padding-right: 6px; overflow-wrap: anywhere; }
    .item b, .summary b, .payment b, .total b { font: 900 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
    .item-meta, .meta, .payment, small { color: #000; }
    ul { margin: 2px 0 0 8px; padding-left: 8px; color: #000; }
    .summary, .payment { display: grid; gap: 3px; }
    .total { margin-top: 7px; padding-top: 7px; border-top: 2px solid #000; align-items: baseline; font-size: 13px; font-weight: 900; text-transform: uppercase; }
    .total b { font-size: 13px; }
    table.rpt { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.rpt td, table.rpt th { padding: 2px 0; font-size: 10px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    table.rpt th { font-size: 8px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; }
    table.rpt td small, table.rpt .sub { display: block; font-size: 8px; }
    table.rpt .amt { text-align: right; font: 900 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; width: 22mm; }
    table.rpt th.amt { font-size: 8px; }
    table.rpt .qty { text-align: right; font: 900 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; width: 9mm; }
    table.rpt .time { font: 900 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; width: 13mm; }
    table.rpt tr.line td { border-bottom: 1px dashed #000; }
    table.rpt tr.strong td { border-top: 1px solid #000; font-weight: 900; padding-top: 4px; }
    table.rpt tr.strong .amt { font-size: 11px; }
    .grand { margin-top: 6px; padding-top: 6px; border-top: 2px solid #000; display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; font-weight: 900; }
    .grand b { font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .sign { margin-top: 24px; text-align: center; }
    .sign .line { border-top: 1px solid #000; margin: 0 6mm; padding-top: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
    footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #000; text-align: center; color: #000; font-size: 9px; }
    footer strong { display: block; margin-top: 3px; color: #000; }
  `
}

function renderShell(title: string, content: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${thermalCss()}</style>
</head>
<body>
  <main class="ticket">${content}</main>
</body>
</html>`
}

function renderSaleDocument(doc: SaleDocument) {
  const rows = doc.items.map(item => `
    <section class="item">
      <div class="item-main">
        <strong>${escapeHtml(item.name)}</strong>
        <b>${escapeHtml(item.total)}</b>
      </div>
      <div class="item-meta">${escapeHtml(item.quantity)} x ${escapeHtml(item.price)}</div>
      ${item.kind === 'combo' ? '<ul><li>1x Producto principal del combo</li><li>1x Complemento incluido</li></ul>' : ''}
    </section>
  `).join('')
  const discount = doc.discount
    ? `<div><span>Descuento</span><b>${escapeHtml(doc.discount.amount)}</b></div><small>${escapeHtml(doc.discount.label)}</small>`
    : ''
  const payments = doc.payments.map(payment => `
    <div><span>${escapeHtml(payment.label)}</span><b>${escapeHtml(payment.amount)}</b></div>
  `).join('')

  return renderShell(doc.number, `
    <header>
      <h1>${escapeHtml(doc.storeName)}</h1>
      <p>${escapeHtml(doc.address)}</p>
      <p>${escapeHtml(doc.phone)}</p>
    </header>
    <section class="doc">
      <span>${escapeHtml(doc.docLabel)}</span>
      <strong>${escapeHtml(doc.number)}</strong>
      <small>${escapeHtml(doc.dateLabel)}</small>
    </section>
    <section class="meta"><div><span>Atendió</span><b>${escapeHtml(doc.seller)}</b></div></section>
    <div class="section-title">Detalle</div>
    ${rows}
    <div class="section-title">Resumen</div>
    <section class="summary">
      <div><span>Subtotal</span><b>${escapeHtml(doc.subtotal)}</b></div>
      ${discount}
    </section>
    <section class="total"><span>Total</span><b>${escapeHtml(doc.total)}</b></section>
    <div class="section-title">Cobro</div>
    <section class="payment">
      <div><span>Método</span><b>${escapeHtml(doc.paymentSummary)}</b></div>
      ${payments}
    </section>
    <footer>
      <em>${escapeHtml(doc.footerNote)}</em>
      <strong>${escapeHtml(doc.footerStrong)}</strong>
    </footer>
  `)
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
  `)
}

export function renderThermalDocumentHtml(document: ThermalDocument) {
  if (document.type === 'sale') {
    return renderSaleDocument(document)
  }

  return renderCashReportDocument(document)
}
