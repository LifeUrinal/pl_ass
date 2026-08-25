import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SCurveData } from '../../lib/calculations'
import { formatKr, todayIsoMonth } from '../../lib/calculations'

interface Props {
  data: SCurveData
}

export default function SCurveChart({ data }: Props) {
  const { punkter, produsertVerdiHittil } = data
  const idag = todayIsoMonth()
  let closest = punkter[0]
  for (const p of punkter) {
    if (p.maned <= idag) closest = p
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={punkter} margin={{ top: 24, right: 70, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="maned" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)} M`} tick={{ fontSize: 12 }} width={60} />
        <Tooltip formatter={(v: number) => formatKr(v)} />
        <Legend />
        <Line
          type="monotone"
          dataKey="planlagtKumulativt"
          name="Fakturaplan (kumulativ)"
          stroke="#3b6ef6"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="fakturertKumulativt"
          name="Faktisk fakturert (kumulativ)"
          stroke="#e07b39"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        {closest && (
          <ReferenceDot
            x={closest.maned}
            y={produsertVerdiHittil}
            r={6}
            fill="#2fa84f"
            stroke="none"
            label={{ value: 'Produsert verdi', position: 'top', fontSize: 12, fill: '#2fa84f' }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
