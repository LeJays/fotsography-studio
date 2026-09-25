import { TASK_DELIVERY_LEAD_DAYS } from './consts.ts'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Convention de dates du projet :
 * - les champs « date seule » (date d'événement, livraison, dépense) sont stockés
 *   à minuit UTC → ils se formatent avec `formatDate` (fuseau UTC) ;
 * - les horodatages réels (créé le, payé le) se formatent avec `formatDateTime`.
 */

export const toDate = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value)

/** Ramène une date au début de journée (minuit UTC). */
export const startOfDay = (value: Date | string): Date => {
  const date = toDate(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export const addDays = (value: Date | string, days: number): Date =>
  new Date(startOfDay(value).getTime() + days * MS_PER_DAY)

/** Date de livraison d'une tâche : livraison globale du projet − 5 jours (par défaut). */
export const computeTaskDeliveryDate = (
  globalDeliveryDate: Date | string,
  leadDays: number = TASK_DELIVERY_LEAD_DAYS,
): Date => addDays(globalDeliveryDate, -leadDays)

export const isSameOrBefore = (value: Date | string, limit: Date | string): boolean =>
  startOfDay(value).getTime() <= startOfDay(limit).getTime()

export const isSameOrAfter = (value: Date | string, limit: Date | string): boolean =>
  startOfDay(value).getTime() >= startOfDay(limit).getTime()

/** Nombre de jours (calendaires) entre aujourd'hui et la date donnée ; négatif si dépassée. */
export const daysUntil = (value: Date | string): number =>
  Math.round((startOfDay(value).getTime() - startOfDay(new Date()).getTime()) / MS_PER_DAY)

const longDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** `12 mars 2026` — pour les champs « date seule ». */
export const formatDate = (value: Date | string): string => longDateFormatter.format(toDate(value))

/** `12/03/2026` — pour les tableaux. */
export const formatDateShort = (value: Date | string): string =>
  shortDateFormatter.format(toDate(value))

/** `12/03/2026 14:35` — pour les horodatages (créé le, payé le). */
export const formatDateTime = (value: Date | string): string => dateTimeFormatter.format(toDate(value))

/** `2026-03-12` — format attendu par `<input type="date">`. */
export const toDateInputValue = (value: Date | string): string => {
  const date = startOfDay(value)
  return date.toISOString().slice(0, 10)
}

/** Convertit la valeur d'un `<input type="date">` en date (minuit UTC). */
export const fromDateInputValue = (value: string): Date => new Date(`${value}T00:00:00.000Z`)

export const todayInputValue = (): string => toDateInputValue(new Date())
