#let report = json("/data/report.json")
#let theme = report.theme
#let navy = rgb(theme.navy)
#let light = rgb(theme.light)
#let red = rgb(theme.accentRed)
#let green = rgb(theme.positive)
#let muted = luma(90)
#let rule-grey = luma(220)
#let page-top = 3.6cm

#let letterhead-blue = rgb("#1668B3")
#let letterhead-ink = rgb("#111111")

#let setup(body) = {
  set document(date: none, title: report.header.title)
  set page(
    paper: "a4",
    margin: (top: page-top, bottom: 2.6cm, left: 2.4cm, right: 2cm),
    header-ascent: 0.5cm,
    footer-descent: 0.4cm,
    background: image("/assets/letterhead/fundo.png", width: 100%, height: 100%),
    header: {
      grid(
        columns: (1fr, auto, auto),
        column-gutter: 0.35cm,
        align: horizon,
        {
          text(weight: "bold", size: 11pt, fill: navy, report.header.title)
          linebreak()
          text(size: 9pt, fill: muted, report.header.periodLabel)
        },
        align(right, {
          text(font: "Rubik", weight: "bold", size: 20pt, fill: letterhead-ink, report.header.org)
          linebreak()
          text(font: "Nunito", size: 7.5pt, fill: letterhead-blue, report.header.subtitle)
        }),
        image("/assets/letterhead/selo.jpg", height: 1.9cm),
      )
    },
    footer: context {
      set text(font: "Nunito", size: 8pt, fill: letterhead-ink)
      line(length: 100%, stroke: 0.4pt + luma(150))
      v(0.1cm)
      grid(
        columns: (1fr, auto, 1fr),
        align: (left, center, right + horizon),
        [],
        align(center)[
          #text(weight: "bold")[#report.header.org - #report.header.subtitle] \
          #report.header.address | NIPC: #report.header.nipc
        ],
        text(size: 9pt, weight: "bold")[#counter(page).display()/#counter(page).final().first()],
      )
    },
  )
  set text(font: "Lato", size: 10pt, lang: "pt", region: "pt")
  set par(justify: false, leading: 0.6em)
  set heading(outlined: false, numbering: none)
  show heading.where(level: 2): it => block(
    above: 0.75cm,
    below: 0.3cm,
    sticky: true,
    text(size: 10.5pt, weight: "bold", fill: navy, tracking: 0.4pt, upper(it.body)),
  )
  show heading.where(level: 3): it => block(
    above: 0.5cm,
    below: 0.2cm,
    sticky: true,
    text(size: 9.5pt, weight: "bold", fill: navy, it.body),
  )
  body
}

#let lead() = {
  let text-lead = report.header.at("lead", default: none)
  if text-lead != none {
    let parts = text-lead.split(" · ")
    block(below: 0.4cm, {
      text(size: 15pt, weight: "bold", fill: navy, parts.first())
      if parts.len() > 1 {
        linebreak()
        v(0.1cm)
        text(size: 10pt, fill: muted, parts.slice(1).join(" · "))
      }
    })
  }
}

#let signature-lines() = {
  let signatures = report.signatures
  if signatures.len() > 0 {
    let has(field) = signatures.any(sig => sig.at(field, default: none) != none)
    let centred(field, ..style) = signatures.map(sig => align(center, text(size: 9pt, ..style, sig.at(field, default: ""))))
    grid(
      columns: (1fr,) * signatures.len(),
      column-gutter: 0.8cm,
      row-gutter: 0.2cm,
      ..signatures.map(sig => {
        v(1.3cm)
        line(length: 100%, stroke: 0.6pt + luma(120))
      }),
      ..centred("title", weight: "bold"),
      ..if has("name") { centred("name") } else { () },
      ..if has("detail") { centred("detail", size: 8.5pt, fill: muted) } else { () },
      ..signatures.map(sig => align(center, pad(top: 0.2cm, text(size: 8.5pt, fill: muted, "Data: ____/____/______")))),
    )
  }
}

#let trace-line() = {
  let trace = report.trace
  let sources = trace.sources.map(s => s.name + " (impressão digital " + s.sha256Short + ")").join(", ")
  line(length: 100%, stroke: 0.4pt + rule-grey)
  v(0.1cm)
  text(size: 8pt, fill: muted)[
    Gerado a #trace.generatedAtLabel a partir de #sources · versão #trace.generatorVersion
  ]
}

#let attach-report() = {
  if report.trace.attachReport {
    pdf.attach(
      "/report.json",
      read("/data/report.json", encoding: none),
      relationship: "data",
      mime-type: "application/json",
      description: "Dados deste relatório",
    )
  }
}

#let finish() = {
  let declaration = report.sections.find(section => section.kind == "declaration")
  block(breakable: false, above: 1.2cm, {
    if declaration != none {
      heading(level: 2, declaration.title)
      for paragraph in declaration.paragraphs { par(paragraph) }
    }
    signature-lines()
    v(0.9cm)
    trace-line()
  })
  attach-report()
}
