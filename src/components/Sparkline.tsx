import { buildSparklinePath } from '../lib/market'

interface Props {
  series: number[]
  positive: boolean
  label: string
}

const WIDTH = 240
const HEIGHT = 64

export function Sparkline({ series, positive, label }: Props) {
  const points = buildSparklinePath(series, WIDTH, HEIGHT)
  return (
    <svg
      className={`sparkline sparkline--${positive ? 'up' : 'down'}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {points ? (
        <>
          <polyline className="sparkline__area" points={`${points} ${WIDTH},${HEIGHT} 0,${HEIGHT}`} />
          <polyline className="sparkline__line" points={points} />
        </>
      ) : null}
    </svg>
  )
}
