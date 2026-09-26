import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { PAYMENT_TYPE_LABELS } from '../../shared/consts.ts'
import { formatDate, formatDateTime } from '../../shared/dates.ts'
import { formatAmount } from '../../shared/money.ts'
import type { PaymentMethod, PaymentSummary, ProjectDetail, ReceiptSummary, TaskPayoutSummary, TaskSummary } from '../../shared/types.ts'

const styles = StyleSheet.create({
  page: { padding: 38, fontFamily: 'Helvetica', color: '#1f2933', fontSize: 10, backgroundColor: '#fffdf9' },
  top: { borderBottomWidth: 2, borderBottomColor: '#bc8b50', paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  brand: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#24211f' },
  gold: { color: '#bc8b50' }, small: { color: '#706a64', fontSize: 8, marginTop: 4 },
  title: { fontSize: 23, fontFamily: 'Helvetica-Bold', marginTop: 30 },
  number: { marginTop: 6, color: '#bc8b50', fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 25, padding: 15, backgroundColor: '#f5efe8', borderRadius: 4 },
  label: { fontSize: 8, color: '#766e66', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#e4ddd4' },
  tableHeader: { flexDirection: 'row', paddingVertical: 7, marginTop: 18, backgroundColor: '#292522', color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#e4ddd4', fontSize: 7 },
  cellDate: { width: '23%' }, cellMethod: { width: '20%' }, cellReference: { width: '32%' }, cellAmount: { width: '25%', textAlign: 'right' },
  total: { marginTop: 18, padding: 15, backgroundColor: '#292522', color: '#fff', flexDirection: 'row', justifyContent: 'space-between' },
  footer: { position: 'absolute', left: 38, right: 38, bottom: 30, borderTopWidth: 1, borderTopColor: '#ded6ce', paddingTop: 9, color: '#766e66', fontSize: 8, textAlign: 'center' },
})

const ReceiptDocument = ({ project, receipt, payment }: { project: ProjectDetail; receipt: ReceiptSummary; payment?: PaymentSummary }) => {
  const isFinal = receipt.isFinalInvoice
  const expenseTotal = project.expenses.reduce((total, expense) => total + expense.amount, 0)
  return <Document title={`${isFinal ? 'Facture finale' : 'Reçu'} ${receipt.number}`} author="Fotsography Studio"><Page size="A4" style={styles.page}>
    <View style={styles.top}><View><Text style={styles.brand}>Fotsography <Text style={styles.gold}>Studio</Text></Text><Text style={styles.small}>PHOTOGRAPHY & VIDEOGRAPHY</Text></View><View><Text style={styles.label}>Document n°</Text><Text style={styles.value}>{receipt.number}</Text><Text style={styles.small}>Émis le {formatDate(receipt.issuedAt)}</Text></View></View>
    <Text style={styles.title}>{isFinal ? 'FACTURE FINALE' : 'REÇU DE PAIEMENT'}</Text><Text style={styles.number}>{project.eventName}</Text>
    <View style={styles.section}><Text style={styles.label}>Facturé à</Text><Text style={styles.value}>{project.clientName}</Text><Text style={styles.small}>Événement : {project.eventName} · {project.eventLocation}</Text><Text style={styles.small}>Date de l'événement : {formatDate(project.eventDate)}</Text></View>
    {isFinal ? <><View style={styles.row}><Text>Montant total de la prestation</Text><Text style={styles.value}>{formatAmount(project.totalAmount)}</Text></View><Text style={{ ...styles.label, marginTop: 18 }}>Historique des paiements</Text><View style={styles.tableHeader}><Text style={styles.cellDate}>Date et heure</Text><Text style={styles.cellMethod}>Moyen</Text><Text style={styles.cellReference}>Référence</Text><Text style={styles.cellAmount}>Montant</Text></View>{project.payments.map((item) => <View key={item.id} style={styles.tableRow}><Text style={styles.cellDate}>{formatDateTime(item.paymentDate)}</Text><Text style={styles.cellMethod}>{item.method === 'MOMO' ? 'Mobile Money' : item.method === 'BANK' ? 'Virement' : 'Espèces'}</Text><Text style={styles.cellReference}>{item.reference || '—'}</Text><Text style={styles.cellAmount}>{formatAmount(item.amount)}</Text></View>)}<Text style={{ ...styles.label, marginTop: 18 }}>Dépenses du projet</Text>{project.expenses.length ? <><View style={styles.tableHeader}><Text style={styles.cellDate}>Date</Text><Text style={styles.cellMethod}>Activité</Text><Text style={styles.cellReference}>Dépense / fournisseur</Text><Text style={styles.cellAmount}>Montant</Text></View>{project.expenses.map((expense) => <View key={expense.id} style={styles.tableRow}><Text style={styles.cellDate}>{formatDate(expense.expenseDate)}</Text><Text style={styles.cellMethod}>{expense.activityName}</Text><Text style={styles.cellReference}>{expense.description}{expense.supplier ? ` - ${expense.supplier}` : ''}</Text><Text style={styles.cellAmount}>{formatAmount(expense.amount)}</Text></View>)}</> : <Text style={styles.small}>Aucune dépense enregistrée.</Text>}<View style={styles.row}><Text style={styles.value}>Total des dépenses</Text><Text style={styles.value}>{formatAmount(expenseTotal)}</Text></View><View style={styles.total}><Text style={styles.value}>TOTAL RÉGLÉ</Text><Text style={styles.value}>{formatAmount(project.paidAmount)}</Text></View></> : <><View style={styles.row}><Text>Nature du règlement</Text><Text style={styles.value}>{payment ? PAYMENT_TYPE_LABELS[payment.type] : PAYMENT_TYPE_LABELS[receipt.type]}</Text></View><View style={styles.row}><Text>Date de paiement</Text><Text style={styles.value}>{payment ? formatDate(payment.paymentDate) : formatDate(receipt.issuedAt)}</Text></View><View style={styles.row}><Text>Mode de paiement</Text><Text style={styles.value}>{payment?.method === 'MOMO' ? 'Mobile Money' : payment?.method === 'BANK' ? 'Virement bancaire' : 'Espèces'}</Text></View><View style={styles.total}><Text style={styles.value}>MONTANT REÇU</Text><Text style={styles.value}>{formatAmount(receipt.amount)}</Text></View></>}
    <Text style={styles.footer}>Merci pour votre confiance. Ce document confirme l'enregistrement du règlement par Fotsography Studio.</Text>
  </Page></Document>
}

export const downloadReceiptPdf = async (project: ProjectDetail, receipt: ReceiptSummary, payment?: PaymentSummary): Promise<void> => {
  const blob = await pdf(<ReceiptDocument project={project} receipt={receipt} payment={payment} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${receipt.isFinalInvoice ? 'facture-finale' : 'recu'}-${receipt.number}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

/** Ouvre le document PDF dans un nouvel onglet, sans le télécharger. */
export const previewReceiptPdf = async (project: ProjectDetail, receipt: ReceiptSummary, payment?: PaymentSummary): Promise<void> => {
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) return
  previewWindow.document.title = receipt.number
  const blob = await pdf(<ReceiptDocument project={project} receipt={receipt} payment={payment} />).toBlob()
  const url = URL.createObjectURL(blob)
  previewWindow.location.href = url
}

const METHOD_LABELS: Record<PaymentMethod, string> = { CASH: 'Espèces', MOMO: 'Mobile Money', BANK: 'Virement' }

/** Reçu d'un versement (total ou tranche) de la rémunération d'un membre pour une tâche. */
const TaskPayoutReceiptDocument = ({ task, payout }: { task: TaskSummary; payout: TaskPayoutSummary }) => (
  <Document title={`Reçu de rémunération ${payout.receiptNumber ?? ''}`.trim()} author="Fotsography Studio">
    <Page size="A4" style={styles.page}>
      <View style={styles.top}>
        <View>
          <Text style={styles.brand}>Fotsography <Text style={styles.gold}>Studio</Text></Text>
          <Text style={styles.small}>PHOTOGRAPHY & VIDEOGRAPHY</Text>
        </View>
        <View>
          <Text style={styles.label}>Document n°</Text>
          <Text style={styles.value}>{payout.receiptNumber ?? '—'}</Text>
          <Text style={styles.small}>Émis le {formatDateTime(payout.paidAt)}</Text>
        </View>
      </View>
      <Text style={styles.title}>REÇU DE RÉMUNÉRATION</Text>
      <Text style={styles.number}>{task.name}</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Versé à</Text>
        <Text style={styles.value}>{task.assignedUserName}</Text>
        <Text style={styles.small}>Tâche : {task.name}</Text>
        <Text style={styles.small}>Activité : {task.activityName} · Projet : {task.projectName}</Text>
        <Text style={styles.small}>Échéance de la tâche : {formatDate(task.deliveryDate)}</Text>
      </View>
      <View style={styles.row}>
        <Text>Montant de ce versement</Text>
        <Text style={styles.value}>{formatAmount(payout.amount)}</Text>
      </View>
      <View style={styles.row}>
        <Text>Rémunération convenue</Text>
        <Text>{formatAmount(task.memberPayout ?? 0)}</Text>
      </View>
      <View style={styles.row}>
        <Text>Total versé à ce jour</Text>
        <Text>{formatAmount(task.paidPayout ?? payout.amount)}</Text>
      </View>
      <View style={styles.row}>
        <Text>Reste à verser</Text>
        <Text>{formatAmount(task.payoutRemaining ?? 0)}</Text>
      </View>
      <View style={styles.row}>
        <Text>Moyen de paiement</Text>
        <Text>{METHOD_LABELS[payout.method]}</Text>
      </View>
      {payout.reference ? (
        <View style={styles.row}>
          <Text>Référence</Text>
          <Text>{payout.reference}</Text>
        </View>
      ) : null}
      {payout.note ? (
        <View style={styles.row}>
          <Text>Note</Text>
          <Text>{payout.note}</Text>
        </View>
      ) : null}
      <View style={styles.total}>
        <Text style={styles.value}>VERSEMENT RÉGLÉ</Text>
        <Text style={styles.value}>{formatAmount(payout.amount)}</Text>
      </View>
      <Text style={styles.footer}>Document émis par Fotsography Studio. Ce reçu confirme le versement de la rémunération indiquée ci-dessus.</Text>
    </Page>
  </Document>
)

/** Télécharge le reçu PDF d'un versement de rémunération (tranche ou solde). */
export const downloadTaskPayoutReceipt = async (task: TaskSummary, payout: TaskPayoutSummary): Promise<void> => {
  const blob = await pdf(<TaskPayoutReceiptDocument task={task} payout={payout} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `recu-${payout.receiptNumber ?? 'rémuneration'}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
