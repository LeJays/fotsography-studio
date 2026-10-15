import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FinanceOverview, FinanceProjectSummary } from '../../../shared/types.ts'
import { formatAmount } from '../../../shared/money.ts'
import { Card, EmptyState } from '../../components/ui'
import { CircleDollarSign } from 'lucide-react'

/* ─── Couleurs cohérentes avec le design system studio ─── */
const C = {
  collected: '#c0392b',   // studio-terracotta
  remaining: '#e8c97a',   // studio-gold clair
  expenses:  '#f0a500',   // studio-gold
  payout:    '#6b7280',   // gris neutre
  margin:    '#16a34a',   // vert
  marginNeg: '#dc2626',   // rouge
}

/* ─── Tooltip commun ─── */
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-studio-dark/10 bg-white px-3 py-2 text-sm shadow-lg">
      {label && <p className="mb-1 font-semibold text-studio-dark">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name} : <strong>{formatAmount(entry.value)}</strong>
        </p>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   1. Donut — Répartition du chiffre d'affaires global
   ══════════════════════════════════════════════════════════ */
export const RevenueDonut = ({ finance }: { finance: FinanceOverview }) => {
  const { collected, remaining, expenses, memberPayouts, netMargin } = finance

  if (finance.totalRevenue === 0) return null

  const isMarginNeg = netMargin < 0
  const data = [
    { name: 'Encaissé',        value: collected,    color: C.collected },
    { name: 'Reste à encaisser', value: remaining,  color: C.remaining },
    { name: 'Dépenses',        value: expenses,     color: C.expenses },
    { name: 'Rémunérations',   value: memberPayouts, color: C.payout },
    { name: isMarginNeg ? 'Déficit' : 'Marge nette', value: Math.abs(netMargin), color: isMarginNeg ? C.marginNeg : C.margin },
  ].filter((d) => d.value > 0)

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-bold text-studio-dark">Répartition du CA</h2>
        <p className="mt-1 text-sm text-studio-dark/55">Vue globale sur l'ensemble des projets.</p>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* Donut */}
        <div className="h-52 w-full sm:w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Légende */}
        <div className="flex-1 space-y-2 text-sm w-full">
          {data.map((entry) => {
            const pct = Math.round((entry.value / finance.totalRevenue) * 100)
            return (
              <div key={entry.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: entry.color }} />
                  <span className="truncate text-studio-dark/70">{entry.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="font-semibold text-studio-dark">{formatAmount(entry.value)}</span>
                  <span className="text-xs text-studio-dark/45">{pct} %</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════
   2. Barres groupées — Comparatif financier par projet
   ══════════════════════════════════════════════════════════ */
export const ProjectBarsChart = ({ projects }: { projects: FinanceProjectSummary[] }) => {
  const visible = projects.slice(0, 8)   // max 8 projets pour la lisibilité

  if (visible.length === 0) {
    return (
      <Card>
        <h2 className="font-serif text-xl font-bold text-studio-dark">Finances par projet</h2>
        <EmptyState icon={<CircleDollarSign className="h-5 w-5" />} title="Aucune donnée" description="Les données financières apparaîtront dès la création d'un projet." />
      </Card>
    )
  }

  const data = visible.map((p) => ({
    name: p.eventName.length > 14 ? `${p.eventName.slice(0, 13)}…` : p.eventName,
    fullName: p.eventName,
    clientName: p.clientName,
    'Total': p.totalAmount,
    'Encaissé': p.paidAmount,
    'Dépenses': p.expenseAmount,
  }))

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-bold text-studio-dark">Finances par projet</h2>
        <p className="mt-1 text-sm text-studio-dark/55">
          Comparatif total, encaissé et dépenses sur les {visible.length} projets les plus récents.
        </p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as typeof data[0]
                return (
                  <div className="rounded-xl border border-studio-dark/10 bg-white px-3 py-2 text-sm shadow-lg">
                    <p className="mb-1 font-semibold text-studio-dark">{d.fullName}</p>
                    <p className="text-xs text-studio-dark/50 mb-2">{d.clientName}</p>
                    {payload.map((entry) => (
                      <p key={entry.name as string} className="flex items-center gap-1.5" style={{ color: entry.color as string }}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color as string }} />
                        {entry.name as string} : <strong>{formatAmount(entry.value as number)}</strong>
                      </p>
                    ))}
                  </div>
                )
              }}
            />
            <Bar dataKey="Total"    fill="#d1d5db" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Encaissé" fill={C.collected} radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Dépenses" fill={C.expenses}  radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Légende manuelle (plus lisible que la légende auto de Recharts) */}
      <div className="flex flex-wrap gap-4 text-xs text-studio-dark/60">
        {[
          { label: 'Total projet', color: '#d1d5db' },
          { label: 'Encaissé',    color: C.collected },
          { label: 'Dépenses',    color: C.expenses },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════
   3. Barre double encaissement + dépenses par projet actif
      (utilisée dans la section "Projets à suivre")
   ══════════════════════════════════════════════════════════ */
export const ProjectFinanceBar = ({
  totalAmount,
  paidAmount,
  expenseAmount,
}: {
  totalAmount: number
  paidAmount: number
  expenseAmount: number
}) => {
  if (totalAmount === 0) return null
  const paidPct   = Math.min(Math.round((paidAmount   / totalAmount) * 100), 100)
  const expPct    = Math.min(Math.round((expenseAmount / totalAmount) * 100), 100)

  return (
    <div className="space-y-1.5">
      {/* Barre encaissement */}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-studio-dark/10">
          <div className="h-full bg-studio-terracotta transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        <span className="w-16 text-right text-xs text-studio-dark/55">{formatAmount(paidAmount)}</span>
      </div>
      {/* Barre dépenses */}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-studio-dark/10">
          <div className="h-full bg-studio-gold transition-all" style={{ width: `${expPct}%` }} />
        </div>
        <span className="w-16 text-right text-xs text-studio-dark/55">{formatAmount(expenseAmount)}</span>
      </div>
      {/* Labels */}
      <div className="flex gap-4 text-xs text-studio-dark/45">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-studio-terracotta" />Encaissé</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-studio-gold" />Dépenses</span>
      </div>
    </div>
  )
}
