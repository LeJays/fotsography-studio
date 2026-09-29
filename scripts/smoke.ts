/**
 * Tests de fumée de l'API (voir README).
 *
 *   node scripts/smoke.ts                        # contre http://localhost:3001
 *   API_URL=http://localhost:3005 node scripts/smoke.ts
 *
 * Le script crée deux comptes techniques, exerce l'authentification, les gardes
 * de rôle et le CRUD « Équipe », puis supprime tout ce qu'il a créé.
 */
import { prisma } from '../server/db.ts'
import { hashPassword } from '../server/password.ts'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

const ADMIN_EMAIL = 'smoke.admin@fotsography.test'
const ADMIN_PASSWORD = 'SmokeAdmin2026'
const MEMBER_EMAIL = 'smoke.membre@fotsography.test'
const MEMBER_PASSWORD = 'SmokeMember2026'

interface Result {
  name: string
  ok: boolean
  info: string
}

const results: Result[] = []

const check = (name: string, ok: boolean, info = ''): void => {
  results.push({ name, ok, info })
  console.log(`${ok ? '  OK  ' : ' ECHEC'}  ${name}${info ? ` — ${info}` : ''}`)
}

/** Client HTTP avec son propre pot de cookies (simule un navigateur). */
const makeClient = () => {
  let cookie = ''

  return {
    request: async (
      method: string,
      path: string,
      body?: unknown,
    ): Promise<{ status: number; data: unknown }> => {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      const setCookie = response.headers.getSetCookie()[0] ?? ''

      if (setCookie.includes('Max-Age=0')) {
        cookie = ''
      } else if (setCookie) {
        cookie = setCookie.split(';')[0]
      }

      const text = await response.text()
      let data: unknown = null

      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }

      return { status: response.status, data }
    },
  }
}

const seedAdmin = async (): Promise<void> => {
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: hashPassword(ADMIN_PASSWORD),
      role: 'ADMIN',
      isActive: true,
      archivedAt: null,
      phone: '+237600000000',
    },
    create: {
      name: 'Smoke Admin',
      email: ADMIN_EMAIL,
      phone: '+237600000000',
      role: 'ADMIN',
      password: hashPassword(ADMIN_PASSWORD),
    },
  })
}

const cleanup = async (): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, MEMBER_EMAIL] } },
    select: { id: true },
  })

  const ids = users.map((user) => user.id)

  if (ids.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
}

const main = async (): Promise<void> => {
  console.log(`\nTests de fumée API → ${API_URL}\n`)

  await seedAdmin()

  const anonymous = makeClient()
  const admin = makeClient()
  const member = makeClient()

  const health = await anonymous.request('GET', '/api/health')
  check('GET /api/health → 200', health.status === 200, `status ${health.status}`)

  const setup = await anonymous.request('GET', '/api/auth/setup-status')
  check(
    'GET /api/auth/setup-status → 200 (installation déjà faite)',
    setup.status === 200 && (setup.data as { needsAdmin?: boolean }).needsAdmin === false,
    JSON.stringify(setup.data),
  )

  const lockedRegister = await anonymous.request('POST', '/api/auth/register', {
    name: 'Intrus',
    email: 'intrus@fotsography.test',
    phone: '+237699999999',
    password: 'Intrus2026',
  })
  check(
    'POST /api/auth/register verrouillé → 403',
    lockedRegister.status === 403,
    `status ${lockedRegister.status}`,
  )

  const badLogin = await anonymous.request('POST', '/api/auth/login', {
    identifier: ADMIN_EMAIL,
    password: 'mauvais-mot-de-passe',
  })
  check('POST /api/auth/login (mauvais mot de passe) → 401', badLogin.status === 401, `status ${badLogin.status}`)

  const adminLogin = await admin.request('POST', '/api/auth/login', {
    identifier: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
  check('POST /api/auth/login admin → 200', adminLogin.status === 200, `status ${adminLogin.status}`)

  const me = await admin.request('GET', '/api/auth/me')
  check('GET /api/auth/me (cookie de session) → 200', me.status === 200, `status ${me.status}`)

  const createMember = await admin.request('POST', '/api/users', {
    name: 'Smoke Membre',
    email: MEMBER_EMAIL,
    phone: '+237611111111',
    role: 'PHOTOGRAPHER',
    password: MEMBER_PASSWORD,
  })
  const createdMemberId = (createMember.data as { user?: { id?: string } }).user?.id
  check(
    'POST /api/users (admin) → 201',
    createMember.status === 201 && Boolean(createdMemberId),
    `status ${createMember.status}`,
  )

  const listUsers = await admin.request('GET', '/api/users')
  check('GET /api/users (admin) → 200', listUsers.status === 200, `status ${listUsers.status}`)

  const memberLogin = await member.request('POST', '/api/auth/login', {
    identifier: 'Smoke Membre',
    password: MEMBER_PASSWORD,
  })
  check('POST /api/auth/login par NOM → 200', memberLogin.status === 200, `status ${memberLogin.status}`)

  const forbidden = await member.request('GET', '/api/users')
  check('GET /api/users (membre) → 403', forbidden.status === 403, `status ${forbidden.status}`)

  const unauthorized = await makeClient().request('GET', '/api/auth/me')
  check('GET /api/auth/me sans session → 401', unauthorized.status === 401, `status ${unauthorized.status}`)

  const wrongPassword = await member.request('POST', '/api/auth/password', {
    currentPassword: 'pas-le-bon',
    newPassword: 'NouveauPass2026',
    confirmPassword: 'NouveauPass2026',
  })
  check('POST /api/auth/password (mauvais actuel) → 400', wrongPassword.status === 400, `status ${wrongPassword.status}`)

  const passwordChanged = await member.request('POST', '/api/auth/password', {
    currentPassword: MEMBER_PASSWORD,
    newPassword: 'NouveauPass2026',
    confirmPassword: 'NouveauPass2026',
  })
  check('POST /api/auth/password → 200', passwordChanged.status === 200, `status ${passwordChanged.status}`)

  const relogin = await makeClient().request('POST', '/api/auth/login', {
    identifier: MEMBER_EMAIL,
    password: 'NouveauPass2026',
  })
  check('Reconnexion avec le nouveau mot de passe → 200', relogin.status === 200, `status ${relogin.status}`)

  const forbiddenReset = await member.request('POST', `/api/users/${createdMemberId}/reset-password`, {
    password: 'Intrus2026',
  })
  check(
    'POST /api/users/:id/reset-password (membre) → 403',
    forbiddenReset.status === 403,
    `status ${forbiddenReset.status}`,
  )

  const weakReset = await admin.request('POST', `/api/users/${createdMemberId}/reset-password`, {
    password: 'abc',
  })
  check(
    'POST /api/users/:id/reset-password (trop court) → 422',
    weakReset.status === 422,
    `status ${weakReset.status}`,
  )

  const resetDone = await admin.request('POST', `/api/users/${createdMemberId}/reset-password`, {
    password: 'ResetPass2026',
  })
  check(
    'POST /api/users/:id/reset-password (admin) → 200',
    resetDone.status === 200,
    `status ${resetDone.status}`,
  )

  const resetRelogin = await makeClient().request('POST', '/api/auth/login', {
    identifier: MEMBER_EMAIL,
    password: 'ResetPass2026',
  })
  check(
    'Reconnexion avec le mot de passe réinitialisé → 200',
    resetRelogin.status === 200,
    `status ${resetRelogin.status}`,
  )

  const oldPasswordRejected = await makeClient().request('POST', '/api/auth/login', {
    identifier: MEMBER_EMAIL,
    password: 'NouveauPass2026',
  })
  check(
    'Ancien mot de passe refusé après réinitialisation → 401',
    oldPasswordRejected.status === 401,
    `status ${oldPasswordRejected.status}`,
  )

  const logout = await member.request('POST', '/api/auth/logout')
  check('POST /api/auth/logout → 204', logout.status === 204, `status ${logout.status}`)

  const afterLogout = await member.request('GET', '/api/auth/me')
  check('GET /api/auth/me après déconnexion → 401', afterLogout.status === 401, `status ${afterLogout.status}`)

  const adminId = (me.data as { user?: { id?: string } }).user?.id

  const archive = await admin.request('DELETE', `/api/users/${createdMemberId}`)
  check('DELETE /api/users/:id (admin) → 204', archive.status === 204, `status ${archive.status}`)

  const guardSelf = await admin.request('DELETE', `/api/users/${adminId}`)
  check('DELETE de son propre compte → 400', guardSelf.status === 400, `status ${guardSelf.status}`)

  const missingRoute = await admin.request('GET', '/api/inexistant')
  check('GET route inconnue → 404', missingRoute.status === 404, `status ${missingRoute.status}`)

  await cleanup()
}

const run = async (): Promise<void> => {
  try {
    await main()
  } catch (error) {
    console.error('\nErreur pendant les tests :', error)
    await cleanup().catch(() => undefined)
    process.exit(1)
  }

  const failures = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failures.length}/${results.length} tests réussis.\n`)

  process.exit(failures.length > 0 ? 1 : 0)
}

void run()
