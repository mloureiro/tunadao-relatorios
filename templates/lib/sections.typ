#import "/templates/lib/page.typ": green, light, muted, navy, red, page-top, report, rule-grey, theme
#import "/templates/lib/charts.typ": composition-bar, composition-legend, grouped-bars, net-label, position-bar, position-legend

#let short-table-rows = 15

#let keep-whole(row-count, body) = block(
  above: 0.75cm,
  breakable: row-count > short-table-rows,
  body,
)

#let head-cell(content) = table.cell(
  stroke: (bottom: 0.8pt + navy),
)[#text(size: 8pt, weight: "bold", fill: muted, tracking: 0.3pt, if content.find(regex("\\d")) == none { upper(content) } else { content })]

#let styled-table(columns, align, headers, header: true, ..cells) = {
  set text(size: 8.5pt)
  set table.cell(breakable: false)
  table(
    columns: columns,
    align: (x, y) => align.at(x),
    stroke: (x, y) => (bottom: 0.4pt + rule-grey),
    inset: (x: 4pt, y: 5pt),
    ..if header { (table.header(..headers.map(head-cell)),) } else { () },
    ..cells,
  )
}

#let tail-rows = 2

#let split-table(columns, align, headers, rows, footer, last) = {
  let all = rows + footer
  if all.len() <= short-table-rows {
    block(spacing: 0pt, breakable: false, sticky: last, styled-table(columns, align, headers, ..all.flatten()))
  } else if last {
    let keep = calc.min(rows.len(), tail-rows)
    let head = rows.slice(0, rows.len() - keep)
    let tail = rows.slice(rows.len() - keep) + footer
    block(spacing: 0pt, styled-table(columns, align, headers, ..head.flatten()))
    block(spacing: 0pt, sticky: true, breakable: false, context {
      let starts-page = here().position().y < page-top + 2pt
      styled-table(columns, align, headers, header: starts-page, ..tail.flatten())
    })
  } else {
    block(spacing: 0pt, styled-table(columns, align, headers, ..all.flatten()))
  }
}

#let total-cell(..args, body) = table.cell(fill: light, ..args)[#text(weight: "bold", body)]

#let kpi-inset = (x: 0.35cm, y: 0.4cm)

#let kpi-body(card) = {
  let emphasis = card.at("emphasis", default: false)
  let label-ink = if emphasis { white.transparentize(15%) } else { muted }
  let value-ink = if emphasis { white } else { navy }
  block(spacing: 0pt, text(size: 8pt, fill: label-ink, upper(card.label)))
  v(0.26cm)
  block(spacing: 0pt, text(size: 17pt, weight: "bold", fill: value-ink, card.value))
  let caption = card.at("caption", default: none)
  if caption != none {
    v(0.2cm)
    block(spacing: 0pt, text(size: 8pt, fill: label-ink, caption))
  }
}

#let kpi-card(card, height) = {
  let emphasis = card.at("emphasis", default: false)
  block(
    width: 100%,
    height: height,
    fill: if emphasis { navy } else { light },
    stroke: 0.5pt + if emphasis { navy } else { rule-grey },
    radius: 4pt,
    inset: kpi-inset,
    kpi-body(card),
  )
}

#let kpis(section) = {
  let count = section.cards.len()
  let columns = if count <= 4 { count } else if count <= 6 { 3 } else { 4 }
  let gutter = 0.3cm
  block(breakable: false, layout(size => {
    let card-width = (size.width - gutter * (columns - 1)) / columns
    let text-width = card-width - kpi-inset.x * 2
    let height = calc.max(..section.cards.map(card => measure(block(width: text-width, kpi-body(card))).height)) + kpi-inset.y * 2
    grid(
      columns: (1fr,) * columns,
      gutter: gutter,
      ..section.cards.map(card => kpi-card(card, height)),
    )
  }))
}

#let composition(section) = {
  heading(level: 2, section.title)
  if section.segments.len() == 0 {
    text(size: 9pt, fill: muted)[Sem valores a apresentar.]
  } else {
    block(breakable: false, {
      composition-bar(section.segments)
      v(0.3cm)
      composition-legend(section.segments)
    })
  }
}

#let desvio-ink(side, cents) = if cents == 0 { black } else if (cents > 0) == (side == "receita") { green } else { red }

#let budget-row(side, row, total: false) = {
  let wrap = if total { body => total-cell(body) } else { body => body }
  (
    wrap(row.label),
    wrap(row.orcado.text),
    wrap(row.realizado.text),
    wrap(text(fill: desvio-ink(side, row.desvio.cents), row.desvio.text)),
    wrap(row.execucao),
  )
}

#let budget(section) = keep-whole(section.rows.len() + 1, {
  heading(level: 2, section.title)
  styled-table(
    (1fr, 2.5cm, 2.5cm, 2.5cm, 1.9cm),
    (left, right, right, right, right),
    ("Rubrica", "Orçado", "Realizado", "Desvio", "Execução"),
    ..section.rows.map(row => budget-row(section.side, row)).flatten(),
    ..budget-row(section.side, section.total, total: true),
  )
  let note = section.at("note", default: none)
  if note != none {
    v(0.15cm)
    text(size: 8pt, style: "italic", fill: muted, note)
  }
})

#let indicators(section) = keep-whole(section.rows.len(), {
  heading(level: 2, section.title)
  set text(size: 9pt)
  table(
    columns: (1fr, auto),
    align: (left, right),
    stroke: (x, y) => (bottom: 0.4pt + rule-grey),
    inset: (x: 4pt, y: 5pt),
    ..section.rows.map(row => (row.label, text(weight: "bold", row.value))).flatten(),
  )
})

#let in-kind(section) = keep-whole(section.rows.len() + 1, {
  heading(level: 2, section.title)
  let rows = section.rows
  let has(field) = rows.any(row => row.at(field, default: none) != none)
  let show-date = has("data")
  let show-activity = rows.map(row => row.atividade).dedup().len() > 1
  let show-quantity = has("quantidade")
  let show-missing = has("emFalta")
  let show-value = has("valor")

  let columns = ()
  let align = ()
  let headers = ()
  if show-date { columns.push(1.9cm); align.push(left); headers.push("Data") }
  if show-activity { columns.push(3cm); align.push(left); headers.push("Atividade") }
  columns.push(1fr); align.push(left); headers.push("Apoio")
  if show-quantity { columns.push(2cm); align.push(right); headers.push("Quantidade") }
  if show-missing { columns.push(2cm); align.push(right); headers.push("Em falta") }
  if show-value { columns.push(2.6cm); align.push(right); headers.push("Valor estimado") }

  let cells = rows.map(row => {
    let cells = ()
    if show-date { cells.push(row.at("data", default: "")) }
    if show-activity { cells.push(row.atividade) }
    cells.push(row.tipo)
    if show-quantity { cells.push(row.at("quantidade", default: "")) }
    if show-missing { cells.push(row.at("emFalta", default: "")) }
    if show-value { cells.push(row.at("valor", default: (text: "")).text) }
    cells
  }).flatten()

  let total = section.at("total", default: none)
  let footer = if total != none {
    (
      total-cell(colspan: columns.len() - 1, "Total estimado, fora do saldo"),
      total-cell(total.text),
    )
  } else { () }
  styled-table(columns, align, headers, ..cells, ..footer)
})

#let pending-side(side-title, rows, empty, total, total-label) = {
  heading(level: 3, side-title)
  if rows.len() == 0 {
    set text(size: 8.5pt)
    table(
      columns: (1fr, 2.4cm),
      align: (left, right),
      fill: light,
      stroke: (x, y) => (bottom: 0.4pt + rule-grey),
      inset: (x: 4pt, y: 5pt),
      text(fill: muted, empty),
      text(weight: "bold", total.text),
    )
  } else {
    let cells = rows.map(row => (
      row.entidade,
      {
        row.descricao
        let notes = row.at("notas", default: none)
        if notes != none {
          linebreak()
          text(size: 8pt, style: "italic", fill: muted, notes)
        }
      },
      row.registo,
      row.valor.text,
    )).flatten()
    styled-table(
      (3.6cm, 1fr, 1.9cm, 2.4cm),
      (left, left, left, right),
      ("Entidade", "Descrição", "Registo", "Valor"),
      ..cells,
      total-cell(colspan: 3, total-label),
      total-cell(total.text),
    )
  }
}

#let pending-keep-together-rows = 12

#let pending(section) = {
  let keep-together = section.receber.len() + section.pagar.len() <= pending-keep-together-rows
  block(above: 0.75cm, breakable: not keep-together, {
    heading(level: 2, section.title)
    text(size: 9pt, fill: muted, section.refLabel)
    pending-side(
      "A receber",
      section.receber,
      section.at("emptyReceber", default: "Nada a receber"),
      section.totals.receber,
      "Total a receber",
    )
    pending-side(
      "A pagar",
      section.pagar,
      section.at("emptyPagar", default: "Nada a pagar"),
      section.totals.pagar,
      "Total a pagar",
    )
  })
}

#let balance-ink(cents) = if cents < 0 { red } else { black }

#let refund-mark(row) = if row.refund { text(style: "italic", fill: navy)[ · reembolso] }

#let cashbook-layout = (
  columns: (1.9cm, 1.35cm, 1fr, 1.3cm, 2.1cm, 2.1cm, 2.3cm),
  align: (left, left, left, left, right, right, right),
  headers: ("Data", "Doc.", "Descrição", "Meio", "Entrada", "Saída", "Acumulado"),
  cells: row => (
    row.data,
    row.doc,
    [#row.descricao#refund-mark(row)],
    row.meio,
    row.at("entrada", default: (text: "")).text,
    row.at("saida", default: (text: "")).text,
    {
      let balance = row.at("acumulado", default: none)
      if balance != none { text(fill: balance-ink(balance.cents), balance.text) }
    },
  ),
  footer-span: 6,
)

#let signed-layout = (
  columns: (1.9cm, 1.35cm, 1fr, 1.5cm, 2.6cm),
  align: (left, left, left, left, right),
  headers: ("Data", "Doc.", "Descrição", "Meio", "Valor"),
  cells: row => (
    row.data,
    row.doc,
    [#row.descricao#refund-mark(row)],
    row.meio,
    text(fill: balance-ink(row.valor.cents), row.valor.text),
  ),
  footer-span: 4,
)

#let footer-rows(layout, lines) = lines.map(line => (
  total-cell(colspan: layout.footer-span, line.label),
  total-cell(align: right, line.value.text),
))

#let movements(section, last: false) = {
  let layout = if section.columns == "cashbook" { cashbook-layout } else if section.columns == "signed" {
    signed-layout
  } else {
    panic("movements: o formato '" + section.columns + "' não é suportado por este modelo")
  }
  let outside = section.at("outside", default: none)
  let footer = footer-rows(layout, section.footer)
  heading(level: 2, section.title)
  let rows = section.rows.map(layout.cells)
  if outside == none {
    split-table(layout.columns, layout.align, layout.headers, rows, footer, last)
  } else {
    split-table(layout.columns, layout.align, layout.headers, rows, (), false)
    heading(level: 3, outside.title)
    split-table(layout.columns, layout.align, layout.headers, outside.rows.map(layout.cells), footer, last)
  }
}

#let text-section(section, last: false) = {
  let body = {
    heading(level: 2, section.title)
    for paragraph in section.paragraphs { par(paragraph) }
  }
  if last { block(sticky: true, breakable: false, body) } else { body }
}

#let summary(section) = block(
  width: 100%,
  fill: rgb(theme.accentGold).lighten(88%),
  stroke: (left: 3pt + rgb(theme.accentGold)),
  radius: (right: 3pt),
  inset: (x: 0.45cm, y: 0.35cm),
  below: 0.5cm,
  text(size: 10.5pt, section.text),
)

#let key-value-table(rows) = {
  set text(size: 9pt)
  table(
    columns: (1fr, 3.4cm),
    align: (left, right),
    stroke: (x, y) => (bottom: 0.4pt + rule-grey),
    inset: (x: 4pt, y: 5pt),
    ..rows.map(row => if row.at("emphasis", default: false) {
      (total-cell(row.label), total-cell(align: right, row.value.text))
    } else {
      (row.label, row.value.text)
    }).flatten(),
  )
}

#let bridge(section) = keep-whole(section.rows.len(), {
  heading(level: 2, section.title)
  key-value-table(section.rows)
})

#let difference-ink(cents) = if cents == 0 { green } else { red }

#let difference-row(label, difference) = (
  label: label,
  value: (text: text(weight: "bold", fill: difference-ink(difference.cents), difference.text)),
)

#let reconciliation(section) = keep-whole(section.rows.len() + 1, {
  heading(level: 2, section.title)
  set text(size: 9pt)
  table(
    columns: (1fr, 3.4cm),
    align: (left, right),
    stroke: (x, y) => (bottom: 0.4pt + rule-grey),
    inset: (x: 4pt, y: 5pt),
    ..section.rows.map(row => if row.at("emphasis", default: false) {
      (total-cell(row.label), total-cell(align: right, row.value.text))
    } else {
      (row.label, row.value.text)
    }).flatten(),
    total-cell("Diferença para os livros"),
    table.cell(fill: light, align: right, text(weight: "bold", fill: difference-ink(section.difference.cents), section.difference.text)),
  )
})

#let cash-count(section) = keep-whole(section.rows.len() + 3, {
  heading(level: 2, section.title)
  styled-table(
    (1fr, 2.4cm, 3.4cm),
    (left, right, right),
    ("Denominação", "Quantidade", "Valor"),
    ..section.rows.map(row => (row.label, row.qty, row.value.text)).flatten(),
    total-cell(colspan: 2, "Total contado"),
    total-cell(align: right, section.total.text),
    table.cell(colspan: 2)[Caixa nos livros],
    section.book.text,
    total-cell(colspan: 2, "Diferença"),
    table.cell(fill: light, align: right, text(weight: "bold", fill: difference-ink(section.difference.cents), section.difference.text)),
  )
})

#let position(section) = block(breakable: false, above: 0.75cm, {
  heading(level: 2, section.title)
  grid(
    columns: (1fr, auto),
    column-gutter: 0.6cm,
    align: horizon,
    position-bar(section.segments),
    net-label(section.net),
  )
  v(0.3cm)
  position-legend(section.segments)
})

#let by-activity(section) = keep-whole(section.rows.len() + 1, {
  heading(level: 2, section.title)
  styled-table(
    (1fr, 2.8cm, 2.8cm, 2.8cm),
    (left, right, right, right),
    ("Atividade", "Recebido", "Pago", "Resultado"),
    ..section.rows.map(row => (
      row.atividade,
      row.recebido.text,
      row.pago.text,
      text(fill: balance-ink(row.resultado.cents), row.resultado.text),
    )).flatten(),
    total-cell("Total"),
    total-cell(align: right, section.total.recebido.text),
    total-cell(align: right, section.total.pago.text),
    total-cell(align: right, section.total.resultado.text),
  )
})

#let comparison-row(row) = {
  let wrap = if row.kind == "saldo" or row.kind == "total" { body => total-cell(body) } else { body => body }
  (
    wrap(row.label),
    wrap(align(right, row.previous)),
    wrap(align(right, row.current)),
    wrap(align(right, row.variation)),
  )
}

#let year-comparison(section) = {
  pagebreak(weak: true)
  heading(level: 2, section.title)
  if section.status == "sem-dados" {
    block(
      width: 100%,
      fill: light,
      stroke: 0.5pt + rule-grey,
      radius: 3pt,
      inset: 0.4cm,
      text(size: 9.5pt, fill: muted, section.at("message", default: "Sem dados no período de comparação.")),
    )
  } else {
    styled-table(
      (1fr, 3.1cm, 3.1cm, 2.7cm),
      (left, right, right, right),
      ("Rubrica", section.labels.at(0), section.labels.at(1), "Variação"),
      ..section.rows.map(comparison-row).flatten(),
    )
    let bars = section.at("bars", default: ())
    for (side, title) in (("receita", "Recebido por rubrica"), ("despesa", "Pago por rubrica")) {
      let side-bars = bars.filter(bar => bar.side == side)
      if side-bars.len() > 0 {
        heading(level: 3, title)
        grouped-bars(side-bars, section.labels)
      }
    }
  }
  if report.tipo == "letivo" { pagebreak(weak: true) }
}

#let render-sections(report) = {
  let count = report.sections.len()
  for (index, section) in report.sections.enumerate() {
    let kind = section.kind
    let last = index == count - 1
    if kind == "summary" { summary(section) }
    else if kind == "kpis" { kpis(section) }
    else if kind == "bridge" { bridge(section) }
    else if kind == "composition" { composition(section) }
    else if kind == "position" { position(section) }
    else if kind == "budget" { budget(section) }
    else if kind == "byActivity" { by-activity(section) }
    else if kind == "indicators" { indicators(section) }
    else if kind == "inKind" { in-kind(section) }
    else if kind == "pending" { pending(section) }
    else if kind == "reconciliation" { reconciliation(section) }
    else if kind == "cashCount" { cash-count(section) }
    else if kind == "movements" { movements(section, last: last) }
    else if kind == "yearComparison" { year-comparison(section) }
    else if kind == "text" or kind == "declaration" { text-section(section, last: last) }
    else { panic("secção desconhecida: " + kind) }
  }
}
