const DAY_MS = 86_400_000

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null
}

function dateText(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftMonths(date: Date, months: number) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  )
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  return target
}

export function getKoreanToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export type RetirementPeriod = {
  start: string
  end: string
  days: number
  monthDays: number
}

export function getRetirementPeriods(
  referenceDate: string,
): RetirementPeriod[] {
  const reference = parseDate(referenceDate)
  if (!reference) return []
  let cursor = shiftMonths(reference, -3)
  const periods: RetirementPeriod[] = []
  while (cursor < reference) {
    const nextMonth = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    )
    const endExclusive = nextMonth < reference ? nextMonth : reference
    periods.push({
      start: dateText(cursor),
      end: dateText(new Date(endExclusive.getTime() - DAY_MS)),
      days: (endExclusive.getTime() - cursor.getTime()) / DAY_MS,
      monthDays: new Date(nextMonth.getTime() - DAY_MS).getUTCDate(),
    })
    cursor = endExclusive
  }
  return periods
}

type AllowanceLog = {
  overtime_minutes: number
  night_minutes: number
  holiday_minutes: number
  regular_minutes: number
  leave_type: string | null
}

// 월별 급여 화면과 동일하게 고정수당 외 실제 발생한 추가수당만 합산한다.
export function estimateAdditionalAllowance(
  log: AllowanceLog,
  hourlyWage: number,
  paidDailyMinutes: number,
) {
  const holidayLimit = paidDailyMinutes || 480
  const holidayBase = Math.min(log.holiday_minutes, holidayLimit)
  const holidayOvertime = Math.max(0, log.holiday_minutes - holidayLimit)
  return (
    (hourlyWage / 60) *
    (log.overtime_minutes * 1.5 +
      log.night_minutes * 0.5 +
      holidayBase * 1.5 +
      holidayOvertime * 2 +
      (log.leave_type === 'full_work' ? log.regular_minutes : 0))
  )
}

export type RetirementInput = {
  hireDate: string
  referenceDate: string
  wages: number[]
  annualBonus: number
  annualLeaveAllowance: number
  ordinaryDailyWage: number
}

export function calculateRetirement(input: RetirementInput) {
  const hire = parseDate(input.hireDate)
  const reference = parseDate(input.referenceDate)
  const periods = getRetirementPeriods(input.referenceDate)
  if (!hire || !reference || hire >= reference || !periods.length) return null
  const amounts = [
    ...input.wages,
    input.annualBonus,
    input.annualLeaveAllowance,
    input.ordinaryDailyWage,
  ]
  if (
    input.wages.length !== periods.length ||
    amounts.some((value) => !Number.isFinite(value) || value < 0)
  )
    return null
  const serviceDays = (reference.getTime() - hire.getTime()) / DAY_MS
  const periodDays = periods.reduce((sum, period) => sum + period.days, 0)
  const wages = input.wages.reduce((sum, value) => sum + value, 0)
  const bonusAllocation = (input.annualBonus * 3) / 12
  const leaveAllocation = (input.annualLeaveAllowance * 3) / 12
  const averageDailyWage =
    (wages + bonusAllocation + leaveAllocation) / periodDays
  const appliedDailyWage = Math.max(averageDailyWage, input.ordinaryDailyWage)
  const eligible = reference >= shiftMonths(hire, 12)
  return {
    serviceDays,
    periodDays,
    wages,
    bonusAllocation,
    leaveAllocation,
    averageDailyWage,
    appliedDailyWage,
    eligible,
    usesOrdinaryWage: input.ordinaryDailyWage > averageDailyWage,
    grossPay: eligible ? (appliedDailyWage * 30 * serviceDays) / 365 : 0,
  }
}
