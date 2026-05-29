export type WorkSegment = {
  start: Date
  end: Date
}

export type PayCalculationInput = {
  hourlyWage: number
  segments: WorkSegment[]
  breakMinutes: number
  isHoliday: boolean
  regularLimitMinutes?: number
}

export type PayCalculationResult = {
  totalMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  nightMinutes: number
  holidayMinutes: number
  regularPay: number
  overtimePay: number
  nightPay: number
  holidayPay: number
  totalPay: number
}

const MINUTES_PER_HOUR = 60
export const DEFAULT_REGULAR_LIMIT_MINUTES = 8 * MINUTES_PER_HOUR

export function combineDateAndTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function formatMinutes(minutes: number) {
  const normalized = Math.max(0, Math.round(minutes))
  const hours = Math.floor(normalized / MINUTES_PER_HOUR)
  const rest = normalized % MINUTES_PER_HOUR

  if (hours === 0) {
    return `${rest}분`
  }

  if (rest === 0) {
    return `${hours}시간`
  }

  return `${hours}시간 ${rest}분`
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'KRW',
  }).format(Math.round(value))
}

export function calculateNightMinutes(segments: WorkSegment[]) {
  return segments.reduce((total, segment) => {
    let cursor = new Date(segment.start)
    let segmentNightMinutes = 0

    while (cursor < segment.end) {
      const nextHour = new Date(cursor)
      nextHour.setMinutes(60, 0, 0)
      const sliceEnd = nextHour < segment.end ? nextHour : segment.end
      const hour = cursor.getHours()

      if (hour >= 22 || hour < 6) {
        segmentNightMinutes += minutesBetween(cursor, sliceEnd)
      }

      cursor = sliceEnd
    }

    return total + segmentNightMinutes
  }, 0)
}

export function calculatePay(input: PayCalculationInput): PayCalculationResult {
  const regularLimitMinutes =
    input.regularLimitMinutes ?? DEFAULT_REGULAR_LIMIT_MINUTES
  const grossWorkMinutes = input.segments.reduce(
    (total, segment) => total + minutesBetween(segment.start, segment.end),
    0,
  )
  const totalMinutes = Math.max(0, grossWorkMinutes - input.breakMinutes)
  const regularMinutes = input.isHoliday
    ? 0
    : Math.min(totalMinutes, regularLimitMinutes)
  const overtimeMinutes = input.isHoliday
    ? 0
    : Math.max(0, totalMinutes - regularLimitMinutes)
  const nightMinutes = Math.min(calculateNightMinutes(input.segments), totalMinutes)
  const holidayMinutes = input.isHoliday ? totalMinutes : 0

  const regularPay =
    (regularMinutes / MINUTES_PER_HOUR) * input.hourlyWage
  const overtimePay =
    (overtimeMinutes / MINUTES_PER_HOUR) * input.hourlyWage * 1.5
  const nightPay = (nightMinutes / MINUTES_PER_HOUR) * input.hourlyWage * 0.5

  let holidayPay = 0
  if (input.isHoliday) {
    const holidayBaseMinutes = Math.min(
      holidayMinutes,
      regularLimitMinutes,
    )
    const holidayOverMinutes = Math.max(
      0,
      holidayMinutes - regularLimitMinutes,
    )
    holidayPay =
      (holidayBaseMinutes / MINUTES_PER_HOUR) * input.hourlyWage * 1.5 +
      (holidayOverMinutes / MINUTES_PER_HOUR) * input.hourlyWage * 2
  }

  return {
    totalMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes,
    holidayMinutes,
    regularPay,
    overtimePay,
    nightPay,
    holidayPay,
    totalPay: regularPay + overtimePay + nightPay + holidayPay,
  }
}
