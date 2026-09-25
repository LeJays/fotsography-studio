/**
 * Launcher de développement : démarre l'API Node (Prisma → Neon) et Vite
 * dans le même terminal. `Ctrl + C` arrête les deux processus.
 *
 *   npm run dev        → API (3001) + Vite (5173)
 *   npm run dev:web    → Vite uniquement (l'API doit déjà tourner)
 *   npm run dev:api    → API uniquement, avec redémarrage automatique
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiEntry = path.join(rootDir, 'server', 'index.ts')
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')

if (!existsSync(apiEntry) || !existsSync(viteBin)) {
  console.error('[dev] Fichiers introuvables : lancez `npm install` à la racine du projet.')
  process.exit(1)
}

const children = [
  { name: 'api', process: spawn(process.execPath, ['--watch', apiEntry], { cwd: rootDir, stdio: 'inherit' }) },
  { name: 'vite', process: spawn(process.execPath, [viteBin], { cwd: rootDir, stdio: 'inherit' }) },
]

let stopping = false

const stop = (signal = 'SIGTERM') => {
  if (stopping) return
  stopping = true

  for (const child of children) {
    if (child.process.exitCode === null) child.process.kill(signal)
  }

  setTimeout(() => process.exit(0), 300)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

for (const child of children) {
  child.process.on('exit', (code) => {
    if (stopping) return
    console.error(`[dev] le processus "${child.name}" s'est arrêté (code ${code ?? 'inconnu'}).`)
    stop()
  })

  child.process.on('error', (error) => {
    console.error(`[dev] impossible de démarrer "${child.name}" :`, error)
    stop()
  })
}

console.log('[dev] API Prisma/Neon + Vite en cours de démarrage…')
