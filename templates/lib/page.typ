#let report = json("/data/report.json")
#let theme = report.theme
#let navy = rgb(theme.navy)
#let light = rgb(theme.light)

#let setup(body) = {
  set document(date: none, title: report.header.title)
  set page(
    paper: "a4",
    margin: (top: 3.6cm, bottom: 2.2cm, x: 2cm),
    header-ascent: 0.6cm,
    header: {
      grid(
        columns: (auto, 1fr, auto),
        column-gutter: 0.4cm,
        align: horizon,
        image("/assets/logo.svg", height: 1.4cm),
        {
          text(font: "Carter One", size: 18pt, fill: navy, report.header.org)
          linebreak()
          text(size: 9pt, fill: luma(90), report.header.subtitle)
        },
        align(right)[
          #text(weight: "bold", size: 11pt, fill: navy, report.header.title)
          #linebreak()
          #text(size: 9pt, fill: luma(90), report.header.periodLabel)
        ],
      )
      v(0.15cm)
      line(length: 100%, stroke: 0.8pt + navy)
    },
    footer: context {
      set text(size: 8pt, fill: luma(90))
      align(center)[Página #counter(page).display() de #counter(page).final().first()]
    },
  )
  set text(font: "Lato", size: 10pt, lang: "pt", region: "pt")
  body
}
