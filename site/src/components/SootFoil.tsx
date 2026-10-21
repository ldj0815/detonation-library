/**
 * A soot-foil cell pattern: the elongated diamond cells a detonation writes on
 * a sooted plate. Cells are about 1.7 times longer (along propagation, x) than
 * wide (y) and alternate rows are staggered by half a cell.
 */
interface Props {
  className?: string
  /** Cell width in px; the length follows from the aspect ratio. */
  cell?: number
  /** Opacity of the line work. */
  opacity?: number
}

export default function SootFoil({ className = '', cell = 44, opacity = 1 }: Props) {
  const w = cell
  const l = Math.round(cell * 1.7)
  const id = `soot-${w}`
  // One tile holds two staggered rows of cells.
  const tileW = l
  const tileH = 2 * w
  const d = [
    `M0 ${w / 2} L${l / 2} 0 L${l} ${w / 2} L${l / 2} ${w} Z`,
    `M${-l / 2} ${w * 1.5} L0 ${w} L${l / 2} ${w * 1.5} L0 ${2 * w} Z`,
    `M${l / 2} ${w * 1.5} L${l} ${w} L${l * 1.5} ${w * 1.5} L${l} ${2 * w} Z`,
  ].join(' ')
  // A few cells picked out in gold, like the brighter cells on a real foil.
  const marks = [
    [1, 0], [3, 1], [6, 0], [8, 2], [11, 1], [13, 3], [16, 0], [19, 2],
  ]
  return (
    <svg
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMinYMin slice"
      style={{ opacity }}
    >
      <defs>
        <pattern id={id} width={tileW} height={tileH} patternUnits="userSpaceOnUse">
          <path d={d} fill="none" stroke="var(--line-2)" strokeWidth="1" />
        </pattern>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mask)`}>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
        {marks.map(([col, row]) => {
          const x = col * (l / 2)
          const y = row * w + (col % 2 === 1 ? w / 2 : 0)
          return (
            <path
              key={`${col}-${row}`}
              d={`M${x} ${y + w / 2} L${x + l / 2} ${y} L${x + l} ${y + w / 2} L${x + l / 2} ${y + w} Z`}
              fill="var(--mark)"
              fillOpacity="0.28"
              stroke="none"
            />
          )
        })}
      </g>
    </svg>
  )
}
