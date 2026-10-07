#import "/templates/lib/page.typ": light, navy, report, setup

#show: setup

#let glyphs = "á à â ã ç é ê í ó ô õ ú Á À Â Ã Ç É Ê Í Ó Ô Õ Ú € − º ª × · 1\u{00A0}234,56\u{00A0}€"

= Conjunto de glifos

#text(weight: "regular")[Lato Regular: #glyphs]

#text(weight: "bold")[Lato Bold: #glyphs]

#text(style: "italic")[Lato Italic: #glyphs]

#text(weight: "bold", style: "italic")[Lato Bold Italic: #glyphs]

#text(font: "Carter One")[Carter One: #glyphs]

= Tabela de várias páginas

#table(
  columns: (2cm, 1fr, 3cm),
  align: (right, left, right),
  fill: (_, y) => if y > 0 and calc.odd(y) { light },
  table.header(
    table.cell(fill: navy)[#text(fill: white, weight: "bold")[N.º]],
    table.cell(fill: navy)[#text(fill: white, weight: "bold")[Descrição]],
    table.cell(fill: navy)[#text(fill: white, weight: "bold")[Valor]],
  ),
  ..range(1, 121).map(i => (
    [#i],
    [Linha de teste #i – descrição com acentuação: ação, coração, lição],
    [#calc.rem(i * 37, 1000),#calc.rem(i, 100) €],
  )).flatten(),
)

#if report.trace.attachReport {
  pdf.attach(
    "/report.json",
    read("/data/report.json", encoding: none),
    relationship: "data",
    mime-type: "application/json",
    description: "Dados deste relatório",
  )
}
