#import "/templates/lib/page.typ": navy, red, theme

#let neutral = rgb(theme.neutral)
#let slot-fill(i) = rgb(theme.segments.at(i))
#let slot-ink(i) = rgb(theme.segmentInk.at(i))

#let segment-fill(i, s) = if s.at("folded", default: false) { neutral } else { slot-fill(i) }
#let segment-ink(i, s) = if s.at("folded", default: false) { black } else { slot-ink(i) }

#let swatch(fill) = box(width: 8pt, height: 8pt, radius: 1.5pt, fill: fill, baseline: 0.5pt)

#let composition-bar(segments) = {
  let drawn = segments.enumerate().filter(((_, s)) => s.permille > 0)
  if drawn.len() > 0 {
    grid(
      columns: drawn.map(((_, s)) => s.permille * 1fr),
      column-gutter: 2pt,
      ..drawn.map(((i, s)) => rect(
        width: 100%,
        height: 0.8cm,
        radius: 2pt,
        inset: 0pt,
        fill: segment-fill(i, s),
        if s.permille >= 100 {
          align(center + horizon, text(size: 9pt, weight: "bold", fill: segment-ink(i, s), s.shareText))
        },
      )),
    )
  }
}

#let legend-grid(entries) = grid(
  columns: (1fr, 1fr),
  column-gutter: 0.5cm,
  row-gutter: 0.18cm,
  ..entries.map(entry => grid(
    columns: (auto, 1fr, auto),
    column-gutter: 0.18cm,
    align: (left + horizon, left + horizon, right + horizon),
    swatch(entry.fill),
    text(size: 8.5pt, entry.label),
    text(size: 8.5pt, entry.value),
  )),
)

#let composition-legend(segments) = legend-grid(segments.enumerate().map(((i, s)) => (
  fill: segment-fill(i, s),
  label: s.label,
  value: [#text(weight: "bold", s.shareText)#h(0.25cm)#s.value.text],
)))

#let position-fill(i, s) = if s.negative { red } else { slot-fill(i) }

#let position-bar(segments) = {
  let drawn = segments.enumerate().filter(((_, s)) => s.permille > 0)
  if drawn.len() > 0 {
    grid(
      columns: drawn.map(((_, s)) => s.permille * 1fr),
      column-gutter: 2pt,
      ..drawn.map(((i, s)) => rect(width: 100%, height: 0.8cm, radius: 2pt, inset: 0pt, fill: position-fill(i, s))),
    )
  }
}

#let position-legend(segments) = legend-grid(segments.enumerate().map(((i, s)) => (
  fill: position-fill(i, s),
  label: s.label,
  value: text(weight: "bold", fill: if s.negative { red } else { black }, s.value.text),
)))

#let net-label(net) = align(right, {
  block(spacing: 0pt, text(size: 8pt, fill: luma(90), upper("Posição líquida")))
  v(0.12cm)
  block(spacing: 0pt, text(size: 14pt, weight: "bold", fill: navy, net.text))
})

#let bar-scale = 1260

#let value-bar(permille, label, fill) = grid(
  columns: (permille * 1fr, (bar-scale - permille) * 1fr),
  align: horizon + left,
  if permille > 0 { rect(width: 100%, height: 0.3cm, radius: (right: 1.5pt), fill: fill) } else { [] },
  [#h(0.15cm)#text(size: 8pt, label)],
)

#let grouped-bars(bars, labels) = {
  block(sticky: true, below: 0.3cm, {
    swatch(neutral)
    h(0.12cm)
    text(size: 8.5pt, labels.at(0))
    h(0.5cm)
    swatch(navy)
    h(0.12cm)
    text(size: 8.5pt, labels.at(1))
  })
  for bar in bars {
    block(
      breakable: false,
      spacing: 0.2cm,
      grid(
        columns: (4.4cm, 1fr),
        column-gutter: 0.2cm,
        align: horizon + left,
        text(size: 8.5pt, bar.label),
        stack(
          spacing: 2pt,
          value-bar(bar.previousPermille, bar.previousText, neutral),
          value-bar(bar.currentPermille, bar.currentText, navy),
        ),
      ),
    )
  }
}
