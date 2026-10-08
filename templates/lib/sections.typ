#import "/templates/lib/page.typ": green, light, muted, navy, red, report, rule-grey
#import "/templates/lib/charts.typ": composition-bar, composition-legend

#let head-cell(content) = table.cell(
  stroke: (bottom: 0.8pt + navy),
)[#text(size: 8pt, weight: "bold", fill: muted, tracking: 0.3pt, upper(content))]

#let styled-table(columns, align, headers, ..cells) = {
  set text(size: 8.5pt)
  set table.cell(breakable: false)
  table(
    columns: columns,
    align: (x, y) => align.at(x),
    stroke: (x, y) => (bottom: 0.4pt + rule-grey),
    inset: (x: 4pt, y: 5pt),
    table.header(..headers.map(head-cell)),
    ..cells,
  )
}

#let total-cell(..args, body) = table.cell(fill: light, ..args)[#text(weight: "bold", body)]

#let kpi-inset = (x: 0.35cm, y: 0.3cm)

#let kpi-body(card) = {
  let emphasis = card.at("emphasis", default: false)
  let label-ink = if emphasis { white.transparentize(15%) } else { muted }
  let value-ink = if emphasis { white } else { navy }
  block(spacing: 0pt, text(size: 8pt, fill: label-ink, upper(card.label)))
  v(0.18cm)
  block(spacing: 0pt, text(size: 17pt, weight: "bold", fill: value-ink, card.value))
  let caption = card.at("caption", default: none)
  if caption != none {
    v(0.1cm)
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

#let budget(section) = {
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
}

#let indicators(section) = {
  heading(level: 2, section.title)
  set text(size: 9pt)
  table(
    columns: (1fr, auto),
    align: (left, right),
    stroke: (x, y) => (bottom: 0.4pt + rule-grey),
    inset: (x: 4pt, y: 5pt),
    ..section.rows.map(row => (row.label, text(weight: "bold", row.value))).flatten(),
  )
}

#let in-kind(section) = {
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
}

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
  block(breakable: not keep-together, {
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

#let movements(section) = {
  if section.columns != "cashbook" {
    panic("movements: o formato '" + section.columns + "' não é suportado por este modelo")
  }
  heading(level: 2, section.title)
  let cells = section.rows.map(row => (
    row.data,
    row.doc,
    {
      row.descricao
      if row.refund { text(style: "italic", fill: navy)[ · reembolso] }
    },
    row.meio,
    row.at("entrada", default: (text: "")).text,
    row.at("saida", default: (text: "")).text,
    {
      let balance = row.at("acumulado", default: none)
      if balance != none { text(fill: balance-ink(balance.cents), balance.text) }
    },
  )).flatten()
  let footer = section.footer.map(line => (
    total-cell(colspan: 6, line.label),
    total-cell(align: right, line.value.text),
  )).flatten()
  styled-table(
    (1.9cm, 1.35cm, 1fr, 1.3cm, 2.1cm, 2.1cm, 2.3cm),
    (left, left, left, left, right, right, right),
    ("Data", "Doc.", "Descrição", "Meio", "Entrada", "Saída", "Acumulado"),
    ..cells,
    ..footer,
  )
}

#let text-section(section) = {
  heading(level: 2, section.title)
  for paragraph in section.paragraphs { par(paragraph) }
}

#let render-sections(report) = {
  for section in report.sections {
    let kind = section.kind
    if kind == "kpis" { kpis(section) }
    else if kind == "composition" { composition(section) }
    else if kind == "budget" { budget(section) }
    else if kind == "indicators" { indicators(section) }
    else if kind == "inKind" { in-kind(section) }
    else if kind == "pending" { pending(section) }
    else if kind == "movements" { movements(section) }
    else if kind == "text" { text-section(section) }
    else { panic("secção desconhecida: " + kind) }
  }
}
