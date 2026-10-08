#let palette = (
  rgb("#2a78d6"),
  rgb("#eb6834"),
  rgb("#1baf7a"),
  rgb("#eda100"),
  rgb("#e87ba4"),
  rgb("#008300"),
  rgb("#4a3aa7"),
  rgb("#e34948"),
)
#let on-palette = (white, black, black, black, black, white, white, black)
#let overflow = (luma(120), luma(150), luma(180), luma(205))

#let slot-fill(i) = if i < palette.len() { palette.at(i) } else {
  overflow.at(calc.min(i - palette.len(), overflow.len() - 1))
}
#let slot-ink(i) = if i < on-palette.len() { on-palette.at(i) } else { black }

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
