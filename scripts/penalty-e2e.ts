/**
 * Test end-to-end du flux de pénalités de retard (API réelle).
 *
 *   node scripts/penalty-e2e.ts      # avec l'API lancée (API_URL, défaut http://localhost:3001)
 *
 * Scénario : option activée → tâche en retard cumule → paiement partiel →
 * déduction automatique sur le versement → traçabilité complète → nettoyage.
 */
import { prisma } from '../server/db.ts'
import { hashPassword } from '../server/password.ts'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_EMAIL = 'penalty.admin@fotsography.test'
const MEMBER_EMAIL = 'penalty.membre@fotsography.test'
const ASSISTANT_EMAIL = 'penalty.assistant@fotsography.test'
const PASSWORD = 'PenaltyE2E2026'

let failures = 0
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${name}${info ? ` — ${info}` : ''}`)
  if (!ok) failures += 1
}

/** Client HTTP avec pot de cookies (simule un navigateur). */
const makeClient = () => {
  let cookie = ''
  return {
    request: async (method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> => {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const setCookie = response.headers.getSetCookie()[0] ?? ''
      if (setCookie.includes('Max-Age=0')) cookie = ''
      else if (setCookie) cookie = setCookie.split(';')[0]
      const text = await response.text()
      let data: Record<string, unknown> = {}
      try { data = text ? (JSON.parse(text) as Record<string, unknown>) : {} } catch { data = {} }
      return { status: response.status, data }
    },
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const main = async (): Promise<void> => {
  console.log(`\nE2E pénalités de retard → ${API_URL}\n`)

  // --- Seed direct en base (comme scripts/smoke.ts) -----------------------
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: hashPassword(PASSWORD), role: 'ADMIN', isActive: true, archivedAt: null, phone: '+237600000001' },
    create: { name: 'Penalty Admin', email: ADMIN_EMAIL, phone: '+237600000001', role: 'ADMIN', password: hashPassword(PASSWORD) },
  })
  const member = await prisma.user.upsert({
    where: { email: MEMBER_EMAIL },
    update: { password: hashPassword(PASSWORD), role: 'EDITOR', isActive: true, archivedAt: null, phone: '+237600000002' },
    create: { name: 'Penalty Membre', email: MEMBER_EMAIL, phone: '+237600000002', role: 'EDITOR', password: hashPassword(PASSWORD) },
  })
  // L'assistant consulte et encaisse les pénalités (sans accès aux finances globales).
  const assistant = await prisma.user.upsert({
    where: { email: ASSISTANT_EMAIL },
    update: { password: hashPassword(PASSWORD), role: 'ASSISTANT', isActive: true, archivedAt: null, phone: '+237600000004' },
    create: { name: 'Penalty Assistant', email: ASSISTANT_EMAIL, phone: '+237600000004', role: 'ASSISTANT', password: hashPassword(PASSWORD) },
  })
  const client = await prisma.client.create({ data: { name: 'Client E2E Pénalités', phone: '+237600000003', createdById: admin.id } })
  const deliveryDate = new Date(Math.floor((Date.now() - 5 * MS_PER_DAY) / MS_PER_DAY) * MS_PER_DAY) // J‑5 à minuit UTC
  const project = await prisma.project.create({
    data: {
      clientId: client.id, eventName: 'E2E Pénalités', eventLocation: 'Douala', eventDate: deliveryDate,
      globalDeliveryDate: deliveryDate, totalAmount: 100000, advanceAmount: 30000, intermediateAmount: 50000, finalAmount: 20000,
      createdById: admin.id,
    },
  })
  const activity = await prisma.activity.create({ data: { projectId: project.id, name: 'Retouches E2E' } })
  const task = await prisma.task.create({
    data: { activityId: activity.id, assignedUserId: member.id, name: 'Retouche galerie E2E', deliveryDate, memberPayout: 50000 },
  })

  try {
    const adminApi = makeClient()
    const memberApi = makeClient()

    // --- Authentification ------------------------------------------------
    const login = await adminApi.request('POST', '/api/auth/login', { identifier: ADMIN_EMAIL, password: PASSWORD })
    check('Connexion admin', login.status === 200, `status ${login.status}`)
    const loginMember = await memberApi.request('POST', '/api/auth/login', { identifier: MEMBER_EMAIL, password: PASSWORD })
    check('Connexion membre', loginMember.status === 200, `status ${loginMember.status}`)

    // --- Activation de l'option dans les réglages ------------------------
    const before = await adminApi.request('GET', '/api/settings')
    const original = before.data.settings as Record<string, unknown>
    check('Lecture des réglages', before.status === 200)
    // Le GET renvoie `null` pour les champs optionnels : on les remplace par '' (comme le formulaire des Réglages).
    const cleanSettings = Object.fromEntries(Object.entries(original).map(([key, value]) => [key, value === null ? '' : value]))
    const settingsPayload = { ...cleanSettings, latePenaltyEnabled: true, latePenaltyAmount: 10000, latePenaltyIntervalDays: 2 }
    const enabled = await adminApi.request('PATCH', '/api/settings', settingsPayload)
    check('Option pénalités activée (case cochée)', enabled.status === 200 && (enabled.data.settings as Record<string, unknown>).latePenaltyEnabled === true, `status ${enabled.status}`)

    // --- Cumul sur la tâche en retard (5 jours → 3 tranches) -------------
    const late = await adminApi.request('GET', `/api/tasks/${task.id}`)
    const lateTask = late.data.task as { latePenalty?: { accrued: number; blocks: number; daysLate: number; running: boolean }; isLate?: boolean }
    const latePenalty = lateTask.latePenalty
    check('Tâche en retard → cumul 30 000 F (5 j, 3 tranches)', latePenalty?.accrued === 30000 && latePenalty?.blocks === 3 && latePenalty?.running === true, JSON.stringify(latePenalty))
    check('Solde renvoyé à l’admin', late.data.penaltyBalance === 30000, String(late.data.penaltyBalance))
    check('Badge « retard » présent', lateTask.isLate === true)

    // --- Vue d'ensemble + paiement partiel -------------------------------
    const overview1 = await adminApi.request('GET', '/api/penalties')
    const ov1 = overview1.data.overview as { enabled: boolean; members: { userId: string; balance: number; tasks: unknown[] }[] }
    const debtMember = ov1.members.find((m) => m.userId === member.id)
    check('Vue pénalités : option active et solde membre 30 000', ov1.enabled === true && debtMember?.balance === 30000, `actif ${ov1.enabled}, solde ${debtMember?.balance}`)
    check('Membre redevable identifié avec sa tâche', debtMember?.balance === 30000 && debtMember.tasks.length === 1)

    const partial = await adminApi.request('POST', '/api/penalties/payments', { userId: member.id, amount: 10000, method: 'MOMO', reference: 'TX-E2E-1' })
    check('Paiement partiel de 10 000 accepté', partial.status === 201, `status ${partial.status}`)
    check('Nouveau solde = 20 000', partial.data.balance === 20000, String(partial.data.balance))

    const tooMuch = await adminApi.request('POST', '/api/penalties/payments', { userId: member.id, amount: 999999 })
    check('Paiement supérieur au solde refusé (400)', tooMuch.status === 400, `status ${tooMuch.status}`)

    // --- Déduction automatique sur le versement --------------------------
    const payout = await adminApi.request('POST', `/api/tasks/${task.id}/payout`, { amount: 15000, method: 'CASH' })
    check('Versement de 15 000 traité', payout.status === 200, `status ${payout.status}`)
    check('Pénalité déduite : 15 000 (solde 20 000)', payout.data.penaltyDeducted === 15000, String(payout.data.penaltyDeducted))
    check('Net versé au membre : 0', payout.data.netPaid === 0, String(payout.data.netPaid))
    check('Solde restant : 5 000', payout.data.penaltyBalance === 5000, String(payout.data.penaltyBalance))

    // --- Traçabilité complète -------------------------------------------
    const overview2 = await adminApi.request('GET', '/api/penalties')
    const ov2 = overview2.data.overview as { members: { userId: string; accrued: number; paid: number; balance: number }[]; payments: { kind: string; amount: number; taskId: string | null; receiptNumber: string | null; reference: string | null; userName: string }[] }
    const m2 = ov2.members.find((m) => m.userId === member.id)
    check('Soldes du membre : accumulé 30 000 / payé 25 000 / dû 5 000', m2?.accrued === 30000 && m2?.paid === 25000 && m2?.balance === 5000, JSON.stringify(m2))
    const manual = ov2.payments.find((p) => p.kind === 'MANUAL')
    const withdrawn = ov2.payments.find((p) => p.kind === 'WITHDRAWN')
    check('Historique : paiement direct tracé (10 000, MOMO)', manual?.amount === 10000 && manual.reference === 'TX-E2E-1' && manual.userName === 'Penalty Membre')
    check('Historique : déduction tracée (15 000, liée à la tâche + reçu)', withdrawn?.amount === 15000 && withdrawn.taskId === task.id && Boolean(withdrawn.receiptNumber))

    // --- Cloisonnement des rôles ----------------------------------------
    const memberOverview = await memberApi.request('GET', '/api/penalties')
    check('Membre refusé sur /api/penalties (403)', memberOverview.status === 403, `status ${memberOverview.status}`)
    const myTasks = await memberApi.request('GET', '/api/tasks?mine=true')
    const mine = (myTasks.data.tasks as { id: string; latePenalty?: { accrued: number } }[]).find((t) => t.id === task.id)
    check('Le membre voit sa propre pénalité', mine?.latePenalty?.accrued === 30000, JSON.stringify(mine?.latePenalty))

    // --- Assistant : consultation + encaissement des pénalités -------------
    const assistantApi = makeClient()
    const loginAssistant = await assistantApi.request('POST', '/api/auth/login', { identifier: ASSISTANT_EMAIL, password: PASSWORD })
    check('Connexion assistant', loginAssistant.status === 200, `status ${loginAssistant.status}`)
    const assistantOverview = await assistantApi.request('GET', '/api/penalties')
    const assistantRow = (assistantOverview.data.overview as { members: { userId: string; balance: number }[] } | undefined)?.members.find((m) => m.userId === member.id)
    check('Assistant autorisé à consulter les pénalités (200)', assistantOverview.status === 200 && assistantRow?.balance === 5000, `status ${assistantOverview.status}, solde ${assistantRow?.balance}`)
    const assistantTask = await assistantApi.request('GET', `/api/tasks/${task.id}`)
    const assistantView = assistantTask.data.task as { latePenalty?: { accrued: number } }
    check('Assistant voit le montant de la pénalité sur la tâche', assistantView.latePenalty?.accrued === 30000, JSON.stringify(assistantView.latePenalty))
    check('Assistant reçoit le solde dû du membre', assistantTask.data.penaltyBalance === 5000, String(assistantTask.data.penaltyBalance))
    const assistantPayment = await assistantApi.request('POST', '/api/penalties/payments', { userId: member.id, amount: 2000, method: 'CASH' })
    check('Assistant peut encaisser un règlement partiel (2 000)', assistantPayment.status === 201 && assistantPayment.data.balance === 3000, `status ${assistantPayment.status}, solde ${assistantPayment.data.balance}`)
    const overview3 = await assistantApi.request('GET', '/api/penalties')
    const traced = (overview3.data.overview as { payments: { amount: number; paidByName: string | null }[] }).payments.find((p) => p.amount === 2000)
    check('Règlement de l’assistant tracé à son nom', traced?.paidByName === 'Penalty Assistant', JSON.stringify(traced))

    // --- Option décochée : plus de cumul, dette conservée ---------------
    const disabled = await adminApi.request('PATCH', '/api/settings', { ...settingsPayload, latePenaltyEnabled: false })
    check('Option décochée', disabled.status === 200)
    const afterOff = await adminApi.request('GET', `/api/tasks/${task.id}`)
    const pOff = (afterOff.data.task as { latePenalty?: { accrued: number; running: boolean } } | undefined)?.latePenalty
    check('Après désactivation : dette conservée, plus de cumul', pOff?.accrued === 30000 && pOff?.running === false, JSON.stringify(pOff))

    // --- Restauration des réglages d'origine -----------------------------
    const restore = await adminApi.request('PATCH', '/api/settings', cleanSettings)
    const restored = await adminApi.request('GET', '/api/settings')
    check('Réglages restaurés', restore.status === 200 && (restored.data.settings as Record<string, unknown>).latePenaltyEnabled === original.latePenaltyEnabled, `status ${restore.status}`)
  } finally {
    // --- Nettoyage : on supprime tout ce que le scénario a créé ----------
    await prisma.penaltyPayment.deleteMany({ where: { OR: [{ userId: member.id }, { paidById: admin.id }, { paidById: assistant.id }, { taskId: task.id }] } })
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [admin.id, member.id, assistant.id] } } })
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined)
    await prisma.client.delete({ where: { id: client.id } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, member.id, assistant.id] } } }).catch(() => undefined)
    console.log('\nNettoyage effectué.')
  }

  console.log(failures === 0 ? '\nE2E pénalités : toutes les vérifications sont passées.\n' : `\nE2E pénalités : ${failures} échec(s).\n`)
  process.exit(failures > 0 ? 1 : 0)
}

void main().catch((error: unknown) => {
  console.error('\nErreur pendant l’E2E :', error)
  process.exit(1)
})

