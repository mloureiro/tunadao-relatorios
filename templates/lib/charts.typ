#import "/templates/lib/page.typ": theme

#let slot-fill(i) = rgb(theme.segments.at(i))
#let slot-ink(i) = rgb(theme.segmentInk.at(i))

#let swatch(i) = box(width: 8pt, height: 8pt, radius: 1.5pt, fill: slot-fill(i), baseline: 0.5pt)

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
        fill: slot-fill(i),
        if s.permille >= 100 {
          align(center + horizon, text(size: 9pt, weight: "bold", fill: slot-ink(i), s.shareText))
        },
      )),
    )
  }
}

#let composition-legend(segments) = grid(
  columns: (1fr, 1fr),
  column-gutter: 0.5cm,
  row-gutter: 0.18cm,
  ..segments.enumerate().map(((i, s)) => grid(
    columns: (auto, 1fr, auto),
    column-gutter: 0.18cm,
    align: (left + horizon, left + horizon, right + horizon),
    swatch(i),
    text(size: 8.5pt, s.label),
    text(size: 8.5pt)[#text(weight: "bold", s.shareText)#h(0.25cm)#s.value.text],
  )),
)
