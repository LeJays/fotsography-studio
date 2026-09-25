import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { formatAmount } from '../../../shared/money.ts'
import type { FinanceOverview } from '../../../shared/types.ts'
import { Alert, Button, Card, PageHeader, StatCard, TableWrapper, Td, Th } from '../../components/ui'
import { ApiError, fetchFinances } from '../../lib/api'

const empty: FinanceOverview = { totalRevenue: 0, collected: 0, remaining: 0, expenses: 0, memberPayouts: 0, netMargin: 0, projects: [], members: [] }

export const FinancesPage = () => {
  const [overview, setOverview] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => { try { setOverview((await fetchFinances()).overview); setError('') } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Chargement financier impossible.') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const exportCsv = () => {
    const rows = [['Projet', 'Client', 'Facturé', 'Encaissé', 'Reste', 'Dépenses', 'Rémunérations', 'Marge'], ...overview.projects.map((p) => [p.eventName, p.clientName, p.totalAmount, p.paidAmount, p.remainingAmount, p.expenseAmount, p.memberPayout, p.margin])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'bilan-financier-fotsography.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <div className="space-y-6"><PageHeader title="Finances globales" subtitle="Recettes, charges et marge nette du studio." actions={<Button variant="secondary" onClick={exportCsv} disabled={!overview.projects.length}><Download className="h-4 w-4" /> Exporter CSV</Button>} />{error ? <Alert tone="error">{error}</Alert> : null}{loading ? <Card className="p-12 text-center text-sm text-studio-dark/55">Chargement du bilan…</Card> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Chiffre d’affaires" value={formatAmount(overview.totalRevenue)} /><StatCard label="Encaissé" value={formatAmount(overview.collected)} /><StatCard label="Reste à encaisser" value={formatAmount(overview.remaining)} /><StatCard label="Dépenses" value={formatAmount(overview.expenses)} /><StatCard label="Rémunérations membres" value={formatAmount(overview.memberPayouts)} /><StatCard label="Marge nette" value={formatAmount(overview.netMargin)} /></div><section><h2 className="mb-3 font-serif text-xl font-bold text-studio-dark">Bilan par projet</h2><TableWrapper><thead><tr><Th>Projet</Th><Th>Encaissé</Th><Th>Dépenses</Th><Th>Rémunérations</Th><Th>Marge</Th></tr></thead><tbody>{overview.projects.map((p) => <tr key={p.id}><Td><strong>{p.eventName}</strong><span className="block text-xs text-studio-dark/50">{p.clientName}</span></Td><Td>{formatAmount(p.paidAmount)}<span className="block text-xs text-studio-dark/50">reste {formatAmount(p.remainingAmount)}</span></Td><Td>{formatAmount(p.expenseAmount)}</Td><Td>{formatAmount(p.memberPayout)}</Td><Td><strong className={p.margin >= 0 ? 'text-green-700' : 'text-red-600'}>{formatAmount(p.margin)}</strong></Td></tr>)}</tbody></TableWrapper></section><section><h2 className="mb-3 font-serif text-xl font-bold text-studio-dark">Rémunérations par membre</h2><TableWrapper><thead><tr><Th>Membre</Th><Th>Tâches</Th><Th>Rémunération prévue</Th></tr></thead><tbody>{overview.members.map((m) => <tr key={m.id}><Td>{m.name}</Td><Td>{m.taskCount}</Td><Td><strong>{formatAmount(m.payout)}</strong></Td></tr>)}</tbody></TableWrapper></section></>}</div>
}
