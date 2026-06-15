import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  CalendarDays,
  Clock,
  Download,
  Grid3X3,
  Home,
  Info,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Save,
  Settings,
  Trash2,
  Users,
  UserRound,
  X,
} from 'lucide-react'
import JSZip from 'jszip'
import './App.css'
import { supabase } from './supabase'
import {
  calculatePay,
  combineDateAndTime,
  formatCurrency,
  formatMinutes,
  DEFAULT_REGULAR_LIMIT_MINUTES,
  type PayCalculationResult,
} from './payCalculator'
import type { Session, User } from '@supabase/supabase-js'

type Profile = {
  id: string
  email: string
  name: string
  role: string
  position: string | null
  hire_date: string | null
  organization_division_id: string | null
  organization_team_id: string | null
  organization_part_id: string | null
  annual_salary: number | null
  standard_hourly_wage: number | null
  dependent_count: number
  child_count: number
}

type AdminUser = Profile

type SystemSettings = {
  id: number
  default_regular_minutes: number
  default_regular_start_time: string | null
  default_regular_end_time: string | null
  default_break_minutes: number
  monthly_non_taxable_pay: number
  weekly_holiday_day: number
  saturday_policy: string
  monthly_inclusive_overtime_hours: number
  monthly_inclusive_holiday_hours: number
  pension_rate: number
  health_insurance_rate: number
  long_term_care_rate: number
  employment_insurance_rate: number
  local_income_tax_rate: number
}

type WorkLog = {
  id: string
  user_id: string
  work_date: string
  hourly_wage: number
  office_clock_in: string
  office_clock_out: string
  remote_clock_in: string | null
  remote_clock_out: string | null
  commute_minutes: number
  break_minutes: number
  is_holiday: boolean
  regular_minutes: number
  overtime_minutes: number
  night_minutes: number
  holiday_minutes: number
  leave_type: string | null
  leave_minutes: number
  overtime_reason: string | null
  regular_pay: number
  overtime_pay: number
  night_pay: number
  holiday_pay: number
  leave_pay: number
  total_pay: number
}

type LeaveType = 'none' | 'full' | 'morning_half' | 'afternoon_half'

type WorkForm = {
  workDate: string
  workStart: string
  workEnd: string
  commuteStart: string
  commuteEnd: string
  noCommute: boolean
  isHoliday: boolean
  leaveType: LeaveType
  overtimeReason: string
}

type SettingsForm = {
  position: string
  hireDate: string
  organizationDivisionId: string
  organizationTeamId: string
  organizationPartId: string
  annualSalary: string
  standardHourlyWage: string
  defaultRegularStart: string
  defaultRegularEnd: string
  defaultBreakMinutes: string
  dependentCount: string
  childCount: string
  monthlyNonTaxablePay: string
  weeklyHolidayDay: string
  saturdayPolicy: string
  monthlyInclusiveOvertimeHours: string
  monthlyInclusiveHolidayHours: string
  pensionRate: string
  healthInsuranceRate: string
  longTermCareRate: string
  employmentInsuranceRate: string
  localIncomeTaxRate: string
}

type CalendarDay = {
  date: string
  day: number
  weekday: number
}

type PaidHoliday = {
  date: string
  name: string
  paidMinutes: number
  totalPay: number
}

type CustomHoliday = {
  id: string
  holiday_date: string
  name: string
  is_substitute: boolean
  created_at: string
}

type OrganizationDivision = {
  id: string
  name: string
  head_user_id: string | null
  created_at: string
}

type OrganizationTeam = {
  id: string
  division_id: string
  name: string
  head_user_id: string | null
  created_at: string
}

type OrganizationPart = {
  id: string
  team_id: string
  name: string
  head_user_id: string | null
  created_at: string
}

type OrganizationDraft = {
  divisionId: string
  teamId: string
  partId: string
}

type AdminCreateUserForm = {
  divisionId: string
  teamId: string
  partId: string
  name: string
  email: string
  position: string
}

type AdminUserProfileDraft = {
  position: string
  hireDate: string
  annualSalary: string
  dependentCount: string
  childCount: string
}

const profileSelect =
  'id, email, name, role, position, hire_date, organization_division_id, organization_team_id, organization_part_id, annual_salary, standard_hourly_wage, dependent_count, child_count'
const systemSettingsSelect =
  'id, default_regular_minutes, default_regular_start_time, default_regular_end_time, default_break_minutes, monthly_non_taxable_pay, weekly_holiday_day, saturday_policy, monthly_inclusive_overtime_hours, monthly_inclusive_holiday_hours, pension_rate, health_insurance_rate, long_term_care_rate, employment_insurance_rate, local_income_tax_rate'
const customHolidaySelect =
  'id, holiday_date, name, is_substitute, created_at'
const organizationDivisionSelect = 'id, name, head_user_id, created_at'
const organizationTeamSelect = 'id, division_id, name, head_user_id, created_at'
const organizationPartSelect = 'id, team_id, name, head_user_id, created_at'
const workLogTemplateBucket = 'worklog-templates'
const workLogTemplateFileName = 'stl-monthly-worklog-template.xlsx'

const today = new Date().toISOString().slice(0, 10)
const currentYear = today.slice(0, 4)
const currentMonth = today.slice(5, 7)

async function loadWorkLogTemplateBuffer() {
  const { data, error } = await supabase.storage
    .from(workLogTemplateBucket)
    .download(workLogTemplateFileName)

  if (error || !data) {
    throw new Error(
      error?.message ?? '근태 기록 템플릿 파일을 불러오지 못했습니다.',
    )
  }

  return data.arrayBuffer()
}

const initialForm: WorkForm = {
  workDate: today,
  workStart: '09:00',
  workEnd: '22:00',
  commuteStart: '18:00',
  commuteEnd: '19:00',
  noCommute: true,
  isHoliday: false,
  leaveType: 'none',
  overtimeReason: '',
}

const initialSettingsForm: SettingsForm = {
  position: '사원',
  hireDate: '',
  organizationDivisionId: '',
  organizationTeamId: '',
  organizationPartId: '',
  annualSalary: '0',
  standardHourlyWage: '0',
  defaultRegularStart: '10:00',
  defaultRegularEnd: '19:00',
  defaultBreakMinutes: '60',
  dependentCount: '1',
  childCount: '0',
  monthlyNonTaxablePay: '0',
  weeklyHolidayDay: '0',
  saturdayPolicy: 'offday',
  monthlyInclusiveOvertimeHours: '52.14',
  monthlyInclusiveHolidayHours: '13.333333',
  pensionRate: '4.75',
  healthInsuranceRate: '3.595',
  longTermCareRate: '13.14',
  employmentInsuranceRate: '0.9',
  localIncomeTaxRate: '10',
}

const initialAdminCreateUserForm: AdminCreateUserForm = {
  divisionId: '',
  teamId: '',
  partId: '',
  name: '',
  email: '',
  position: '사원',
}

const weekdayOptions = [
  { value: '0', label: '일요일' },
  { value: '1', label: '월요일' },
  { value: '2', label: '화요일' },
  { value: '3', label: '수요일' },
  { value: '4', label: '목요일' },
  { value: '5', label: '금요일' },
  { value: '6', label: '토요일' },
]

const positionOptions = [
  '사원',
  '주임',
  '대리',
  '과장',
  '차장',
  '부장',
  '이사',
  '상무',
  '전무',
  '대표',
]

const leaveOptions: Array<{ value: LeaveType; label: string }> = [
  { value: 'none', label: '휴가 없음' },
  { value: 'full', label: '연차' },
  { value: 'morning_half', label: '오전반차' },
  { value: 'afternoon_half', label: '오후반차' },
]

const MONTHLY_STANDARD_WORK_HOURS = 209

function calculateStandardHourlyWageFromAnnualSalary(
  annualSalary: string | number,
  inclusiveOvertimeHours: string | number,
  inclusiveHolidayHours: string | number,
) {
  const monthlySalary = (Number(annualSalary) || 0) / 12
  const payableHours =
    MONTHLY_STANDARD_WORK_HOURS +
    (Number(inclusiveOvertimeHours) || 0) * 1.5 +
    (Number(inclusiveHolidayHours) || 0) * 1.5

  if (monthlySalary <= 0 || payableHours <= 0) {
    return 0
  }

  return monthlySalary / payableHours
}

function calculateAnnualSalaryFromHourlyWage(
  hourlyWage: number,
  inclusiveOvertimeHours: string | number,
  inclusiveHolidayHours: string | number,
) {
  const payableHours =
    MONTHLY_STANDARD_WORK_HOURS +
    (Number(inclusiveOvertimeHours) || 0) * 1.5 +
    (Number(inclusiveHolidayHours) || 0) * 1.5

  return Math.round(hourlyWage * payableHours * 12)
}

function combineDateAndTimeWithRollover(
  date: string,
  value: string,
  previousValue?: string,
) {
  const nextDate = combineDateAndTime(date, value)

  if (previousValue && timeToMinutes(value) < timeToMinutes(previousValue)) {
    nextDate.setDate(nextDate.getDate() + 1)
  }

  return nextDate
}

function toDateTimeLocal(date: string, value: string, previousValue?: string) {
  return combineDateAndTimeWithRollover(date, value, previousValue).toISOString()
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function decimalNumberOnly(value: string) {
  const normalized = value.replace(/[^\d.]/g, '')
  const [integerPart, ...decimalParts] = normalized.split('.')

  if (decimalParts.length === 0) {
    return integerPart
  }

  return `${integerPart}.${decimalParts.join('').slice(0, 2)}`
}

function formatAllowanceHours(minutes: number) {
  const hours = Math.max(0, minutes) / 60

  return `${hours.toFixed(2)}시간`
}

function calculateAutoBreakMinutes(workMinutes: number) {
  return Math.floor(Math.max(0, workMinutes) / 240) * 30
}

type HolidayChecker = {
  isHoliday: (
    date: Date,
  ) => false | Array<{ name: string; type: string }>
  getHolidays: (year: number) => Array<{
    date: string
    start: Date
    end: Date
    name: string
    type: string
  }>
}

let koreanHolidaysPromise: Promise<HolidayChecker> | null = null

async function getKoreanHolidayChecker() {
  koreanHolidaysPromise ??= import('date-holidays').then(
    ({ default: Holidays }) => new Holidays('KR') as HolidayChecker,
  )

  return koreanHolidaysPromise
}

async function getKoreanPublicHolidayName(date: string) {
  const [year, month] = date.split('-')
  const paidHolidayNames = await getKoreanPaidHolidayNames(year, month)

  return paidHolidayNames.get(date) ?? null
}

function getCustomHolidayDisplayName(holiday: Pick<CustomHoliday, 'name' | 'is_substitute'>) {
  if (holiday.is_substitute) {
    return '대체휴무'
  }

  return holiday.name
}

async function getKoreanPaidHolidayNames(year: string, month: string) {
  const holidayChecker = await getKoreanHolidayChecker()
  const monthDays = getCalendarDays(year, month)
  const namesByDate = new Map<string, string>()

  monthDays.forEach(({ date }) => {
    const holiday = holidayChecker.isHoliday(new Date(`${date}T12:00:00+09:00`))
    const publicHoliday =
      holiday && holiday.find(({ type }) => type === 'public')

    if (publicHoliday) {
      namesByDate.set(date, publicHoliday.name)
    }
  })

  namesByDate.set(`${year}-05-01`, '근로자의 날')

  const allYearHolidays = holidayChecker
    .getHolidays(Number(year))
    .filter(({ type }) => type === 'public')

  allYearHolidays.forEach((holiday) => {
    if (!isSubstitutableKoreanHoliday(holiday.name)) {
      return
    }

    const firstDate = holiday.date.slice(0, 10)
    const holidayDates = new Set<string>()
    const durationDays = Math.max(
      1,
      Math.round(
        (new Date(holiday.end).getTime() - new Date(holiday.start).getTime()) /
          86_400_000,
      ),
    )

    Array.from({ length: durationDays }, (_, index) => {
      holidayDates.add(addDays(firstDate, index))
    })

    const hasWeekend = Array.from(holidayDates).some(
      (date) => !isWeekday(date),
    )

    if (!hasWeekend) {
      return
    }

    let substituteDate = addDays(firstDate, durationDays)
    while (!isWeekday(substituteDate) || namesByDate.has(substituteDate)) {
      substituteDate = addDays(substituteDate, 1)
    }

    if (substituteDate.startsWith(`${year}-${month}`)) {
      namesByDate.set(substituteDate, `${holiday.name} 대체공휴일`)
    }
  })

  return namesByDate
}

function formatNumber(value: string | number) {
  return new Intl.NumberFormat('ko-KR').format(Number(value) || 0)
}

function formatWorkDateWithWeekday(date: string) {
  const parsedDate = new Date(`${date}T12:00:00+09:00`)
  const weekday = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  }).format(parsedDate)

  return `${date} (${weekday})`
}

function getKoreanWeekday(date: string) {
  return new Date(`${date}T12:00:00+09:00`).getDay()
}

function addDays(date: string, days: number) {
  const parsedDate = new Date(`${date}T12:00:00+09:00`)
  parsedDate.setDate(parsedDate.getDate() + days)

  return parsedDate.toISOString().slice(0, 10)
}

function isSubstitutableKoreanHoliday(name: string) {
  return [
    '설날',
    '추석',
    '어린이날',
    '3·1절',
    '광복절',
    '개천절',
    '한글날',
    '석가탄신일',
    '부처님오신날',
    '성탄절',
    '기독탄신일',
  ].some((holidayName) => name.includes(holidayName))
}

function isWeekday(date: string) {
  const weekday = getKoreanWeekday(date)

  return weekday >= 1 && weekday <= 5
}

function getWeeklyHolidayName(
  date: string,
  weeklyHolidayDay: string,
  saturdayPolicy: string,
) {
  const weekday = getKoreanWeekday(date)

  if (weekday === Number(weeklyHolidayDay)) {
    return '주휴일'
  }

  if (weekday === 6 && saturdayPolicy === 'holiday') {
    return '토요일 휴일'
  }

  return null
}

function minutesFromTimeRange(start: string, end: string) {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return 0
  }

  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  const normalizedEndMinutes =
    endMinutes >= startMinutes ? endMinutes : endMinutes + 24 * 60

  return Math.max(0, normalizedEndMinutes - startMinutes)
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0
  }

  return hour * 60 + minute
}

function minutesToTime(minutes: number) {
  const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hour = Math.floor(normalizedMinutes / 60)
  const minute = normalizedMinutes % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function getLeaveLabel(leaveType: string | null | undefined) {
  return leaveOptions.find((option) => option.value === leaveType)?.label ?? '휴가'
}

function normalizeLeaveType(leaveType: string | null | undefined): LeaveType {
  return leaveOptions.some((option) => option.value === leaveType)
    ? (leaveType as LeaveType)
    : 'none'
}

function dateTimeToTimeValue(value: string | null | undefined) {
  if (!value) {
    return '00:00'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '00:00'
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}

function buildWorkFormFromLog(log: WorkLog): WorkForm {
  const workStart = dateTimeToTimeValue(log.office_clock_in)
  const workEnd = dateTimeToTimeValue(log.office_clock_out)
  const hasCommute = log.commute_minutes > 0
  const commuteEnd = hasCommute ? workEnd : initialForm.commuteEnd
  const commuteStart = hasCommute
    ? minutesToTime(timeToMinutes(commuteEnd) - log.commute_minutes)
    : initialForm.commuteStart

  return {
    workDate: log.work_date,
    workStart,
    workEnd,
    commuteStart,
    commuteEnd,
    noCommute: !hasCommute,
    isHoliday: log.is_holiday,
    leaveType: normalizeLeaveType(log.leave_type),
    overtimeReason: log.overtime_reason ?? '',
  }
}

function getWorkLogClockMinutes(
  workDate: string,
  value: string | null | undefined,
) {
  if (!value) {
    return 0
  }

  const baseDate = new Date(`${workDate}T00:00:00`)
  const targetDate = new Date(value)
  const elapsedMinutes = Math.round(
    (targetDate.getTime() - baseDate.getTime()) / 60000,
  )

  return elapsedMinutes === 0 ? 24 * 60 : Math.max(0, elapsedMinutes)
}

function formatClockMinutes(minutes: number) {
  const hour = Math.floor(Math.max(0, minutes) / 60)
  const minute = Math.max(0, minutes) % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relationshipsNamespace =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

type SheetXmlContext = {
  document: XMLDocument
  sheetData: Element
}

function parseSpreadsheetXml(xml: string) {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function serializeSpreadsheetXml(document: XMLDocument) {
  return new XMLSerializer().serializeToString(document)
}

function getSpreadsheetChildren(parent: Element, localName: string) {
  return Array.from(parent.childNodes).filter(
    (node): node is Element =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).localName === localName,
  )
}

function getColumnNumber(address: string) {
  const column = address.match(/^[A-Z]+/)?.[0] ?? ''

  return column.split('').reduce((total, letter) => {
    return total * 26 + letter.charCodeAt(0) - 64
  }, 0)
}

function getRowNumber(address: string) {
  return Number(address.match(/\d+$/)?.[0] ?? 0)
}

function createSpreadsheetElement(document: XMLDocument, name: string) {
  return document.createElementNS(spreadsheetNamespace, name)
}

function getOrCreateRow(context: SheetXmlContext, rowNumber: number) {
  const rows = getSpreadsheetChildren(context.sheetData, 'row')
  const existingRow = rows.find((row) => Number(row.getAttribute('r')) === rowNumber)

  if (existingRow) {
    return existingRow
  }

  const row = createSpreadsheetElement(context.document, 'row')
  row.setAttribute('r', String(rowNumber))

  const nextRow = rows.find((candidate) => {
    return Number(candidate.getAttribute('r')) > rowNumber
  })

  context.sheetData.insertBefore(row, nextRow ?? null)
  return row
}

function getOrCreateCell(context: SheetXmlContext, address: string) {
  const row = getOrCreateRow(context, getRowNumber(address))
  const cells = getSpreadsheetChildren(row, 'c')
  const existingCell = cells.find((cell) => cell.getAttribute('r') === address)

  if (existingCell) {
    return existingCell
  }

  const cell = createSpreadsheetElement(context.document, 'c')
  cell.setAttribute('r', address)

  const targetColumn = getColumnNumber(address)
  const nextCell = cells.find((candidate) => {
    return getColumnNumber(candidate.getAttribute('r') ?? '') > targetColumn
  })

  row.insertBefore(cell, nextCell ?? null)
  return cell
}

function clearCellValue(cell: Element) {
  Array.from(cell.childNodes).forEach((child) => {
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      ['f', 'v', 'is'].includes((child as Element).localName)
    ) {
      cell.removeChild(child)
    }
  })
  cell.removeAttribute('t')
}

function toExcelDateSerial(date: Date) {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const excelEpoch = Date.UTC(1899, 11, 30)

  return (utcDate - excelEpoch) / 86400000
}

function setXmlCellValue(
  context: SheetXmlContext,
  address: string,
  value: string | number | Date | null | undefined,
) {
  const cell = getOrCreateCell(context, address)
  clearCellValue(cell)

  if (value === null || value === undefined || value === '') {
    return
  }

  if (typeof value === 'string') {
    cell.setAttribute('t', 'inlineStr')

    const inlineString = createSpreadsheetElement(context.document, 'is')
    const text = createSpreadsheetElement(context.document, 't')
    text.textContent = value
    inlineString.appendChild(text)
    cell.appendChild(inlineString)
    return
  }

  const cellValue = createSpreadsheetElement(context.document, 'v')
  cellValue.textContent = String(value instanceof Date ? toExcelDateSerial(value) : value)
  cell.appendChild(cellValue)
}

function setXmlTimeCellValue(
  context: SheetXmlContext,
  address: string,
  minutes: number | null | undefined,
) {
  setXmlCellValue(
    context,
    address,
    minutes === null || minutes === undefined ? null : minutes / (24 * 60),
  )
}

function getSafeSheetName(name: string, usedSheetNames: Set<string>) {
  const baseName = (name || '사용자')
    .replace(/[\\/?*[\]:]/g, '')
    .trim()
    .slice(0, 31)
  let safeName = baseName || '사용자'
  let suffix = 2

  while (usedSheetNames.has(safeName)) {
    const suffixText = ` ${suffix}`
    safeName = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`
    suffix += 1
  }

  usedSheetNames.add(safeName)
  return safeName
}

function replaceSheetReference(
  document: XMLDocument | null,
  oldName: string,
  newName: string,
) {
  if (!document) {
    return
  }

  const oldReference = `'${oldName.replace(/'/g, "''")}'!`
  const newReference = `'${newName.replace(/'/g, "''")}'!`

  Array.from(document.getElementsByTagNameNS(spreadsheetNamespace, 'f')).forEach(
    (formula) => {
      if (formula.textContent) {
        formula.textContent = formula.textContent
          .split(oldReference)
          .join(newReference)
      }
    },
  )
}

function normalizeWeekdayFormula(document: XMLDocument) {
  Array.from(document.getElementsByTagNameNS(spreadsheetNamespace, 'f')).forEach(
    (formula) => {
      if (formula.textContent?.includes('TEXT(F3,"AAA")')) {
        formula.textContent = formula.textContent.replace(
          'TEXT(F3,"AAA")',
          'TEXT(F3,"aaa")',
        )
      }
    },
  )
}

function downloadWorkbookBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getWorkbookSheetTargets(workbookDocument: XMLDocument, relsDocument: XMLDocument) {
  const relationships = new Map(
    Array.from(relsDocument.getElementsByTagName('Relationship')).map((relationship) => [
      relationship.getAttribute('Id') ?? '',
      relationship.getAttribute('Target') ?? '',
    ]),
  )

  return new Map(
    Array.from(workbookDocument.getElementsByTagNameNS(spreadsheetNamespace, 'sheet'))
      .map((sheet) => {
        const relationId = sheet.getAttributeNS(relationshipsNamespace, 'id') ?? ''
        const target = relationships.get(relationId)

        if (!target) {
          return null
        }

        const normalizedTarget = target.startsWith('/')
          ? target.slice(1)
          : `xl/${target}`

        return [
          sheet.getAttribute('name') ?? '',
          { element: sheet, path: normalizedTarget },
        ] as const
      })
      .filter((entry): entry is readonly [string, { element: Element; path: string }] =>
        Boolean(entry),
      ),
  )
}

function getLeaveMinutes(leaveType: LeaveType, paidWorkdayMinutes: number) {
  if (leaveType === 'full') {
    return paidWorkdayMinutes
  }

  if (leaveType === 'morning_half' || leaveType === 'afternoon_half') {
    return Math.round(paidWorkdayMinutes / 2)
  }

  return 0
}

function getWorkRangeForLeaveType(
  leaveType: LeaveType,
  defaultStart: string,
  defaultEnd: string,
  breakMinutes: number,
) {
  if (leaveType === 'none') {
    return null
  }

  if (leaveType === 'full') {
    return {
      workStart: defaultStart,
      workEnd: defaultStart,
    }
  }

  const defaultGrossMinutes = minutesFromTimeRange(defaultStart, defaultEnd)
  const halfPaidMinutes = Math.round(
    Math.max(0, defaultGrossMinutes - breakMinutes) / 2,
  )
  const halfGrossMinutes = halfPaidMinutes + breakMinutes

  if (leaveType === 'morning_half') {
    return {
      workStart: minutesToTime(
        timeToMinutes(defaultEnd) - halfGrossMinutes - breakMinutes,
      ),
      workEnd: defaultEnd,
    }
  }

  return {
    workStart: defaultStart,
    workEnd: minutesToTime(
      timeToMinutes(defaultStart) + halfGrossMinutes + breakMinutes,
    ),
  }
}

function normalizeStoredTime(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback
  }

  return value.slice(0, 5)
}

function getMonthRange(year: string, month: string) {
  const normalizedYear = Number(year) || Number(currentYear)
  const normalizedMonth = Number(month) || Number(currentMonth)
  const start = `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}-01`
  const lastDate = new Date(normalizedYear, normalizedMonth, 0).getDate()
  const end = `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`

  return { start, end }
}

function getCalendarDays(year: string, month: string): CalendarDay[] {
  const normalizedYear = Number(year) || Number(currentYear)
  const normalizedMonth = Number(month) || Number(currentMonth)
  const lastDate = new Date(normalizedYear, normalizedMonth, 0).getDate()

  return Array.from({ length: lastDate }, (_, index) => {
    const day = index + 1
    const date = `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    return {
      date,
      day,
      weekday: getKoreanWeekday(date),
    }
  })
}

function isDateBeforeHireDate(date: string, hireDate?: string | null) {
  return Boolean(hireDate && date < hireDate)
}

function getMonthlyEmploymentRatio(
  hireDate: string | null | undefined,
  year: string,
  month: string,
) {
  if (!hireDate) {
    return 1
  }

  const { start, end } = getMonthRange(year, month)

  if (hireDate > end) {
    return 0
  }

  if (hireDate <= start) {
    return 1
  }

  const lastDay = Number(end.slice(8, 10))
  const hireDay = Number(hireDate.slice(8, 10))

  return Math.max(0, Math.min(1, (lastDay - hireDay + 1) / lastDay))
}

function formatCalendarTime(log: WorkLog, value: string) {
  const workStart = new Date(log.office_clock_in)
  const target = new Date(value)
  const minutes = Math.max(
    0,
    Math.round((target.getTime() - workStart.getTime()) / 60000),
  )
  const startHour = workStart.getHours()
  const totalMinutes = startHour * 60 + minutes
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function getCalendarPayClass(totalPay: number) {
  if (totalPay >= 400_000) {
    return 'pay-tier-top'
  }

  if (totalPay >= 300_000) {
    return 'pay-tier-high'
  }

  if (totalPay >= 200_000) {
    return 'pay-tier-mid'
  }

  if (totalPay >= 100_000) {
    return 'pay-tier-base'
  }

  return 'pay-tier-low'
}

function percentToRate(value: string | number) {
  return (Number(value) || 0) / 100
}

function calculateInsurance(
  monthlyPay: number,
  monthlyPensionBasePay: number,
  rates: {
    pensionRate: string
    healthInsuranceRate: string
    longTermCareRate: string
    employmentInsuranceRate: string
  },
) {
  const pension = Math.round(
    monthlyPensionBasePay * percentToRate(rates.pensionRate),
  )
  const health = Math.round(
    monthlyPay * percentToRate(rates.healthInsuranceRate),
  )
  const longTermCare = Math.round(
    health * percentToRate(rates.longTermCareRate),
  )
  const employment = Math.round(
    monthlyPay * percentToRate(rates.employmentInsuranceRate),
  )
  const total = pension + health + longTermCare + employment

  return {
    pension,
    health,
    longTermCare,
    employment,
    total,
    netPay: Math.max(0, monthlyPay - total),
  }
}

function calculateProgressiveIncomeTax(taxBase: number) {
  const brackets = [
    { limit: 14_000_000, rate: 0.06, deduction: 0 },
    { limit: 50_000_000, rate: 0.15, deduction: 1_260_000 },
    { limit: 88_000_000, rate: 0.24, deduction: 5_760_000 },
    { limit: 150_000_000, rate: 0.35, deduction: 15_440_000 },
    { limit: 300_000_000, rate: 0.38, deduction: 19_940_000 },
    { limit: 500_000_000, rate: 0.4, deduction: 25_940_000 },
    { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 65_940_000 },
  ]
  const bracket = brackets.find(({ limit }) => taxBase <= limit) ?? brackets[0]

  return Math.max(0, Math.round(taxBase * bracket.rate - bracket.deduction))
}

function calculateEarnedIncomeDeduction(annualPay: number) {
  if (annualPay <= 5_000_000) {
    return annualPay * 0.7
  }

  if (annualPay <= 15_000_000) {
    return 3_500_000 + (annualPay - 5_000_000) * 0.4
  }

  if (annualPay <= 45_000_000) {
    return 7_500_000 + (annualPay - 15_000_000) * 0.15
  }

  if (annualPay <= 100_000_000) {
    return 12_000_000 + (annualPay - 45_000_000) * 0.05
  }

  return Math.min(20_000_000, 14_750_000 + (annualPay - 100_000_000) * 0.02)
}

function calculateEarnedIncomeTaxCredit(calculatedTax: number) {
  if (calculatedTax <= 0) {
    return 0
  }

  const credit =
    calculatedTax <= 1_300_000
      ? calculatedTax * 0.55
      : 715_000 + (calculatedTax - 1_300_000) * 0.3

  return Math.min(740_000, Math.round(credit))
}

function calculateChildTaxCredit(childCount: number) {
  if (childCount <= 0) {
    return 0
  }

  if (childCount === 1) {
    return 150_000
  }

  if (childCount === 2) {
    return 300_000
  }

  return 300_000 + (childCount - 2) * 300_000
}

function calculatePayrollTax(
  monthlyPay: number,
  dependentCount: number,
  childCount: number,
  localIncomeTaxRate: string,
) {
  const annualPay = monthlyPay * 12
  const earnedIncomeDeduction = calculateEarnedIncomeDeduction(annualPay)
  const normalizedDependents = Math.max(1, dependentCount)
  const taxableIncome = Math.max(
    0,
    annualPay - earnedIncomeDeduction - normalizedDependents * 1_500_000,
  )
  const calculatedTax = calculateProgressiveIncomeTax(taxableIncome)
  const annualIncomeTax = Math.max(
    0,
    calculatedTax -
      calculateEarnedIncomeTaxCredit(calculatedTax) -
      calculateChildTaxCredit(childCount),
  )
  const incomeTax = Math.round(annualIncomeTax / 12)
  const localIncomeTax = Math.floor(incomeTax * percentToRate(localIncomeTaxRate))

  return {
    incomeTax,
    localIncomeTax,
    total: incomeTax + localIncomeTax,
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authMode, setAuthMode] = useState<
    'login' | 'signup' | 'forgot' | 'reset'
  >('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [form, setForm] = useState(initialForm)
  const [settingsForm, setSettingsForm] = useState(initialSettingsForm)
  const [profilePasswordForm, setProfilePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [editingWorkLogId, setEditingWorkLogId] = useState<string | null>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminCreateUserForm, setAdminCreateUserForm] =
    useState<AdminCreateUserForm>(initialAdminCreateUserForm)
  const [adminUserFilters, setAdminUserFilters] = useState({
    divisionId: '',
    teamId: '',
    partId: '',
    name: '',
  })
  const [selectedWorkLogUserIds, setSelectedWorkLogUserIds] = useState<string[]>(
    [],
  )
  const [workLogDownloadYear, setWorkLogDownloadYear] = useState(currentYear)
  const [workLogDownloadMonth, setWorkLogDownloadMonth] = useState(currentMonth)
  const [selectedAdminUser, setSelectedAdminUser] = useState<AdminUser | null>(
    null,
  )
  const [saveMessage, setSaveMessage] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')
  const [profilePasswordMessage, setProfilePasswordMessage] = useState('')
  const [calendarMessage, setCalendarMessage] = useState('')
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [isAdminCreateUserModalOpen, setIsAdminCreateUserModalOpen] =
    useState(false)
  const [isProfilePasswordModalOpen, setIsProfilePasswordModalOpen] =
    useState(false)
  const [activePage, setActivePage] = useState<
    'work' | 'calendar' | 'organization' | 'profile' | 'users' | 'system'
  >('work')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedHolidayName, setSelectedHolidayName] = useState<string | null>(
    null,
  )
  const [paidHolidayNames, setPaidHolidayNames] = useState<Map<string, string>>(
    new Map(),
  )
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([])
  const [organizationDivisions, setOrganizationDivisions] = useState<
    OrganizationDivision[]
  >([])
  const [organizationTeams, setOrganizationTeams] = useState<OrganizationTeam[]>(
    [],
  )
  const [organizationParts, setOrganizationParts] = useState<OrganizationPart[]>(
    [],
  )
  const [organizationForm, setOrganizationForm] = useState({
    divisionName: '',
    teamDivisionId: '',
    teamName: '',
    partTeamId: '',
    partName: '',
  })
  const [organizationCreateMode, setOrganizationCreateMode] = useState<
    'division' | 'team' | 'part' | null
  >(null)
  const [adminUserOrgDrafts, setAdminUserOrgDrafts] = useState<
    Record<string, OrganizationDraft>
  >({})
  const [adminUserProfileDrafts, setAdminUserProfileDrafts] = useState<
    Record<string, AdminUserProfileDraft>
  >({})
  const [organizationUserEditor, setOrganizationUserEditor] =
    useState<AdminUser | null>(null)
  const [adminUserEditor, setAdminUserEditor] = useState<AdminUser | null>(null)
  const [organizationHeadEditor, setOrganizationHeadEditor] = useState<{
    tableName:
      | 'organization_divisions'
      | 'organization_teams'
      | 'organization_parts'
    id: string
    title: string
    roleLabel: string
    headUserId: string | null
  } | null>(null)
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false)
  const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false)
  const [holidayForm, setHolidayForm] = useState({
    date: `${selectedYear}-${selectedMonth}-01`,
    name: '',
    isSubstitute: false,
  })
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!nextSession) {
        setProfile(null)
        setLogs([])
        setEditingWorkLogId(null)
      }

      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset')
      }

      setSession(nextSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user.id) {
      return
    }

    loadProfile(session.user)
    loadSystemSettings()
    loadOrganizationUnits()
    // loadProfile and loadLogs are stable enough for this session-bound sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  useEffect(() => {
    if (!session?.user.id) {
      return
    }

    loadLogs()
    // loadLogs reads the selected month range and current session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, selectedAdminUser?.id, selectedMonth, selectedYear])

  useEffect(() => {
    let isActive = true

    loadMonthlyHolidaySettings().then((holidayNames) => {
      if (isActive) {
        setPaidHolidayNames(holidayNames)
      }
    })

    return () => {
      isActive = false
    }
    // loadMonthlyHolidaySettings reads the selected month range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    if (!toastMessage) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 2600)

    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  useEffect(() => {
    if (
      (activePage === 'users' ||
        activePage === 'system' ||
        activePage === 'organization') &&
      isAdmin
    ) {
      loadAdminUsers()
    }
    // loadAdminUsers depends on current profile role and is used only for admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, isAdmin])

  useEffect(() => {
    let isActive = true
    const workDate = form.workDate

    getConfiguredHolidayName(workDate).then((publicHolidayName) => {
      if (!isActive) {
        return
      }

      const holidayName =
        publicHolidayName ??
        getWeeklyHolidayName(
          workDate,
          settingsForm.weeklyHolidayDay,
          settingsForm.saturdayPolicy,
        )

      setSelectedHolidayName(holidayName)
      setForm((currentForm) => {
        if (currentForm.workDate !== workDate) {
          return currentForm
        }

        if (editingWorkLogId) {
          return currentForm
        }

        return {
          ...currentForm,
          isHoliday: holidayName !== null,
        }
      })
    })

    return () => {
      isActive = false
    }
  }, [
    customHolidays,
    editingWorkLogId,
    form.workDate,
    settingsForm.saturdayPolicy,
    settingsForm.weeklyHolidayDay,
  ])

  const commuteMinutes = useMemo(() => {
    if (form.noCommute) {
      return 0
    }

    return minutesFromTimeRange(form.commuteStart, form.commuteEnd)
  }, [form.commuteEnd, form.commuteStart, form.noCommute])

  const grossWorkMinutes = useMemo(() => {
    return minutesFromTimeRange(form.workStart, form.workEnd)
  }, [form.workEnd, form.workStart])
  const breakMinutes = useMemo(() => {
    return calculateAutoBreakMinutes(grossWorkMinutes)
  }, [grossWorkMinutes])

  const isNextDayWorkEnd =
    timeToMinutes(form.workEnd) < timeToMinutes(form.workStart)
  const isNextDayCommuteEnd =
    !form.noCommute && timeToMinutes(form.commuteEnd) < timeToMinutes(form.commuteStart)
  const workTargetUser = selectedAdminUser ?? profile
  const workTargetUserId = workTargetUser?.id ?? session?.user.id ?? ''
  const workTargetAnnualSalary =
    selectedAdminUser?.annual_salary ?? Number(settingsForm.annualSalary)
  const workTargetHireDate =
    selectedAdminUser?.hire_date ?? profile?.hire_date ?? settingsForm.hireDate
  const workTargetDependentCount =
    selectedAdminUser?.dependent_count || Number(settingsForm.dependentCount) || 1
  const workTargetChildCount =
    selectedAdminUser?.child_count ?? (Number(settingsForm.childCount) || 0)
  const getTeamsForDivision = (divisionId: string) =>
    organizationTeams.filter((team) => team.division_id === divisionId)
  const getPartsForTeam = (teamId: string) =>
    organizationParts.filter((part) => part.team_id === teamId)
  const getDivisionName = (divisionId: string | null | undefined) =>
    organizationDivisions.find((division) => division.id === divisionId)?.name ?? ''
  const getTeamName = (teamId: string | null | undefined) =>
    organizationTeams.find((team) => team.id === teamId)?.name ?? ''
  const getPartName = (partId: string | null | undefined) =>
    organizationParts.find((part) => part.id === partId)?.name ?? ''
  const getUserName = (userId: string | null | undefined) =>
    adminUsers.find((user) => user.id === userId)?.name ?? ''
  const getPositionRank = (position: string | null | undefined) => {
    const positionRanks: Record<string, number> = {
      대표: 100,
      전무: 90,
      상무: 80,
      이사: 70,
      부장: 60,
      차장: 50,
      과장: 40,
      대리: 30,
      주임: 20,
      사원: 10,
    }

    return position ? (positionRanks[position] ?? 0) : 0
  }
  const sortOrganizationUsers = (
    users: AdminUser[],
    headUserId?: string | null,
  ) =>
    [...users].sort((firstUser, secondUser) => {
      const firstIsHead = headUserId && firstUser.id === headUserId
      const secondIsHead = headUserId && secondUser.id === headUserId

      if (firstIsHead !== secondIsHead) {
        return firstIsHead ? -1 : 1
      }

      const positionDiff =
        getPositionRank(secondUser.position) - getPositionRank(firstUser.position)

      if (positionDiff !== 0) {
        return positionDiff
      }

      const firstHireDate = firstUser.hire_date ?? '9999-12-31'
      const secondHireDate = secondUser.hire_date ?? '9999-12-31'
      const hireDateDiff = firstHireDate.localeCompare(secondHireDate)

      if (hireDateDiff !== 0) {
        return hireDateDiff
      }

      return firstUser.name.localeCompare(secondUser.name, 'ko')
    })
  const getUserHeadRoles = (user: Profile) => {
    const roles = [
      organizationDivisions.some((division) => division.head_user_id === user.id)
        ? '본부장'
        : '',
      organizationTeams.some((team) => team.head_user_id === user.id) ? '팀장' : '',
      organizationParts.some((part) => part.head_user_id === user.id)
        ? '파트장'
        : '',
    ].filter(Boolean)

    return roles.join(' · ')
  }
  const renderUserLabel = (user: Profile) => (
    <>
      <span>
        {user.position ?? '직급 없음'} {user.name}
      </span>
      {getUserHeadRoles(user) && <em>{getUserHeadRoles(user)}</em>}
    </>
  )
  const getOrganizationPath = (targetProfile: Profile) => {
    const items = [
      getDivisionName(targetProfile.organization_division_id),
      getTeamName(targetProfile.organization_team_id),
      getPartName(targetProfile.organization_part_id),
    ].filter(Boolean)

    return items.length > 0 ? items.join(' / ') : '조직 미지정'
  }
  const getAdminOrgDraft = (targetProfile: Profile): OrganizationDraft =>
    adminUserOrgDrafts[targetProfile.id] ?? {
      divisionId: targetProfile.organization_division_id ?? '',
      teamId: targetProfile.organization_team_id ?? '',
      partId: targetProfile.organization_part_id ?? '',
    }
  const getAdminProfileDraft = (
    targetProfile: Profile,
  ): AdminUserProfileDraft =>
    adminUserProfileDrafts[targetProfile.id] ?? {
      position: targetProfile.position ?? initialSettingsForm.position,
      hireDate: targetProfile.hire_date ?? '',
      annualSalary: String(targetProfile.annual_salary ?? 0),
      dependentCount: String(targetProfile.dependent_count ?? 1),
      childCount: String(targetProfile.child_count ?? 0),
    }
  const profileTeams = getTeamsForDivision(settingsForm.organizationDivisionId)
  const profileParts = getPartsForTeam(settingsForm.organizationTeamId)
  const organizationEditorDraft = organizationUserEditor
    ? getAdminOrgDraft(organizationUserEditor)
    : { divisionId: '', teamId: '', partId: '' }
  const organizationEditorTeams = getTeamsForDivision(
    organizationEditorDraft.divisionId,
  )
  const organizationEditorParts = getPartsForTeam(organizationEditorDraft.teamId)
  const adminEditorDraft = adminUserEditor
    ? getAdminOrgDraft(adminUserEditor)
    : { divisionId: '', teamId: '', partId: '' }
  const adminProfileEditorDraft = adminUserEditor
    ? getAdminProfileDraft(adminUserEditor)
    : {
        position: initialSettingsForm.position,
        hireDate: '',
        annualSalary: '0',
        dependentCount: '1',
        childCount: '0',
      }
  const adminProfileEditorHourlyWage = calculateStandardHourlyWageFromAnnualSalary(
    adminProfileEditorDraft.annualSalary,
    settingsForm.monthlyInclusiveOvertimeHours,
    settingsForm.monthlyInclusiveHolidayHours,
  )
  const adminEditorTeams = getTeamsForDivision(adminEditorDraft.divisionId)
  const adminEditorParts = getPartsForTeam(adminEditorDraft.teamId)
  const adminCreateUserTeams = getTeamsForDivision(
    adminCreateUserForm.divisionId,
  )
  const adminCreateUserParts = getPartsForTeam(adminCreateUserForm.teamId)
  const adminFilterTeams = getTeamsForDivision(adminUserFilters.divisionId)
  const adminFilterParts = getPartsForTeam(adminUserFilters.teamId)
  const filteredAdminUsers = sortOrganizationUsers(
    adminUsers.filter((user) => {
      const normalizedKeyword = adminUserFilters.name.trim().toLowerCase()
      const matchesDivision =
        !adminUserFilters.divisionId ||
        user.organization_division_id === adminUserFilters.divisionId
      const matchesTeam =
        !adminUserFilters.teamId ||
        user.organization_team_id === adminUserFilters.teamId
      const matchesPart =
        !adminUserFilters.partId ||
        user.organization_part_id === adminUserFilters.partId
      const matchesName =
        !normalizedKeyword || user.name.toLowerCase().includes(normalizedKeyword)

      return matchesDivision && matchesTeam && matchesPart && matchesName
    }),
  )
  const filteredAdminUserIds = filteredAdminUsers.map((user) => user.id)
  const isAllFilteredUsersSelected =
    filteredAdminUserIds.length > 0 &&
    filteredAdminUserIds.every((userId) =>
      selectedWorkLogUserIds.includes(userId),
    )
  const organizationChartUsers = isAdmin
    ? adminUsers
    : profile
      ? [profile]
      : []
  const getDivisionUsers = (division: OrganizationDivision) =>
    sortOrganizationUsers(
      organizationChartUsers.filter(
        (user) =>
          user.organization_division_id === division.id &&
          !user.organization_team_id,
      ),
      division.head_user_id,
    )
  const getTeamUsers = (team: OrganizationTeam) =>
    sortOrganizationUsers(
      organizationChartUsers.filter(
        (user) => user.organization_team_id === team.id && !user.organization_part_id,
      ),
      team.head_user_id,
    )
  const getPartUsers = (part: OrganizationPart) =>
    sortOrganizationUsers(
      organizationChartUsers.filter((user) => user.organization_part_id === part.id),
      part.head_user_id,
    )
  const unassignedOrganizationUsers = sortOrganizationUsers(
    organizationChartUsers.filter((user) => !user.organization_division_id),
  )

  const defaultRegularMinutes = useMemo(() => {
    return minutesFromTimeRange(
      settingsForm.defaultRegularStart,
      settingsForm.defaultRegularEnd,
    )
  }, [settingsForm.defaultRegularEnd, settingsForm.defaultRegularStart])
  const standardHourlyWage = useMemo(
    () =>
      calculateStandardHourlyWageFromAnnualSalary(
        workTargetAnnualSalary,
        settingsForm.monthlyInclusiveOvertimeHours,
        settingsForm.monthlyInclusiveHolidayHours,
      ),
    [
      settingsForm.monthlyInclusiveHolidayHours,
      settingsForm.monthlyInclusiveOvertimeHours,
      workTargetAnnualSalary,
    ],
  )
  const profileHourlyWage = useMemo(
    () =>
      calculateStandardHourlyWageFromAnnualSalary(
        settingsForm.annualSalary,
        settingsForm.monthlyInclusiveOvertimeHours,
        settingsForm.monthlyInclusiveHolidayHours,
      ),
    [
      settingsForm.annualSalary,
      settingsForm.monthlyInclusiveHolidayHours,
      settingsForm.monthlyInclusiveOvertimeHours,
    ],
  )

  const calculation = useMemo(() => {
    const segments = [
      {
        start: combineDateAndTime(form.workDate, form.workStart),
        end: combineDateAndTimeWithRollover(
          form.workDate,
          form.workEnd,
          form.workStart,
        ),
      },
    ]

    return calculatePay({
      hourlyWage: standardHourlyWage,
      segments,
      breakMinutes: breakMinutes + commuteMinutes,
      isHoliday: form.isHoliday,
      regularLimitMinutes: defaultRegularMinutes || undefined,
    })
  }, [
    breakMinutes,
    commuteMinutes,
    defaultRegularMinutes,
    form,
    standardHourlyWage,
  ])
  const paidWorkdayMinutes = Math.max(
    0,
    defaultRegularMinutes - calculateAutoBreakMinutes(defaultRegularMinutes),
  )
  const leaveMinutes = getLeaveMinutes(form.leaveType, paidWorkdayMinutes)
  const leavePay = (leaveMinutes / 60) * standardHourlyWage
  const dailyTotalPay = calculation.totalPay + leavePay

  const calendarDays = getCalendarDays(selectedYear, selectedMonth)
  const calendarLeadingBlankCount = calendarDays[0]?.weekday ?? 0
  const payrollLogs = logs.filter(
    (log) => !isDateBeforeHireDate(log.work_date, workTargetHireDate),
  )
  const logsByDate = new Map(payrollLogs.map((log) => [log.work_date, log]))
  const paidHolidayMinutes = paidWorkdayMinutes
  const paidHolidays = calendarDays
    .filter(
      ({ date }) =>
        !isDateBeforeHireDate(date, workTargetHireDate) &&
        isWeekday(date) &&
        paidHolidayNames.has(date) &&
        !logsByDate.has(date),
    )
    .map<PaidHoliday>(({ date }) => ({
      date,
      name: paidHolidayNames.get(date) ?? '유급휴일',
      paidMinutes: paidHolidayMinutes,
      totalPay: (paidHolidayMinutes / 60) * standardHourlyWage,
    }))
  const paidHolidaysByDate = new Map(
    paidHolidays.map((holiday) => [holiday.date, holiday]),
  )
  const monthlyEmploymentRatio = getMonthlyEmploymentRatio(
    workTargetHireDate,
    selectedYear,
    selectedMonth,
  )
  const monthlySalary =
    Math.max(0, (Number(workTargetAnnualSalary) || 0) / 12) *
    monthlyEmploymentRatio
  const fixedOvertimeMinutes = Math.round(
    (Number(settingsForm.monthlyInclusiveOvertimeHours) || 0) *
      60 *
      monthlyEmploymentRatio,
  )
  const fixedHolidayMinutes = Math.round(
    (Number(settingsForm.monthlyInclusiveHolidayHours) || 0) *
      60 *
      monthlyEmploymentRatio,
  )
  const fixedOvertimePay =
    (fixedOvertimeMinutes / 60) * standardHourlyWage * 1.5
  const fixedHolidayPay =
    (fixedHolidayMinutes / 60) * standardHourlyWage * 1.5
  const fixedAllowancePayTotal = fixedOvertimePay + fixedHolidayPay
  const contractBasePay = Math.max(
    0,
    monthlySalary - fixedAllowancePayTotal,
  )
  const actualOvertimeMinutes = payrollLogs.reduce(
    (total, log) => total + log.overtime_minutes,
    0,
  )
  const actualNightMinutes = payrollLogs.reduce(
    (total, log) => total + log.night_minutes,
    0,
  )
  const actualHolidayBaseMinutes = payrollLogs.reduce(
    (total, log) =>
      total + Math.min(log.holiday_minutes, paidWorkdayMinutes || 480),
    0,
  )
  const actualHolidayOvertimeMinutes = payrollLogs.reduce(
    (total, log) =>
      total + Math.max(0, log.holiday_minutes - (paidWorkdayMinutes || 480)),
    0,
  )
  const additionalOvertimeMinutes = actualOvertimeMinutes
  const additionalNightMinutes = actualNightMinutes
  const additionalHolidayMinutes = actualHolidayBaseMinutes
  const additionalHolidayOvertimeMinutes = actualHolidayOvertimeMinutes
  const additionalOvertimePay =
    (additionalOvertimeMinutes / 60) * standardHourlyWage * 1.5
  const additionalNightPay =
    (additionalNightMinutes / 60) * standardHourlyWage * 0.5
  const additionalHolidayPay =
    (additionalHolidayMinutes / 60) * standardHourlyWage * 1.5
  const additionalHolidayOvertimePay =
    (additionalHolidayOvertimeMinutes / 60) * standardHourlyWage * 2
  const additionalPayTotal =
    additionalOvertimePay +
    additionalNightPay +
    additionalHolidayPay +
    additionalHolidayOvertimePay
  const monthlyTotal = contractBasePay + fixedAllowancePayTotal + additionalPayTotal
  const monthlyNonTaxablePay =
    Number(settingsForm.monthlyNonTaxablePay) || 0
  const monthlyTaxablePay = Math.max(0, monthlyTotal - monthlyNonTaxablePay)
  const monthlyPensionBasePay = monthlySalary
  const monthlyInsurance = calculateInsurance(
    monthlyTaxablePay,
    monthlyPensionBasePay,
    settingsForm,
  )
  const monthlyTax = calculatePayrollTax(
    monthlyTaxablePay,
    Number(workTargetDependentCount) || 1,
    Number(workTargetChildCount) || 0,
    settingsForm.localIncomeTaxRate,
  )
  const monthlyTaxTotal = monthlyTax.total
  const monthlyDeductions = monthlyInsurance.total + monthlyTax.total
  const monthlyNetPay = Math.max(0, monthlyTotal - monthlyDeductions)
  const userDisplayName = `${profile?.name ?? '사용자'}${
    profile?.position ? ` ${profile.position}` : ''
  }`
  const editingWorkLog = logs.find((log) => log.id === editingWorkLogId) ?? null
  const hasSavedWorkLogForSelectedDate = logs.some(
    (log) => log.work_date === form.workDate && log.id !== editingWorkLogId,
  )
  const isSelectedWorkDateBeforeHire = isDateBeforeHireDate(
    form.workDate,
    workTargetHireDate,
  )
  const monthlyRows = [
    ...payrollLogs.map((log) => ({ date: log.work_date, log, holiday: null })),
    ...paidHolidays.map((holiday) => ({ date: holiday.date, log: null, holiday })),
  ].sort((left, right) => right.date.localeCompare(left.date))
  const getMonthlyDayStatus = (date: string, log?: WorkLog | null) => {
    const customHoliday = customHolidays.find(
      (holiday) => holiday.holiday_date === date,
    )
    const configuredHolidayName = paidHolidayNames.get(date)
    const weeklyHolidayName = getWeeklyHolidayName(
      date,
      settingsForm.weeklyHolidayDay,
      settingsForm.saturdayPolicy,
    )
    const isSaturdayOffday =
      getKoreanWeekday(date) === 6 && settingsForm.saturdayPolicy === 'offday'

    if (customHoliday?.is_substitute) {
      return log ? '휴일근로 · 대체근로' : '대체휴무'
    }

    if (configuredHolidayName) {
      return log ? `휴일근로 · ${configuredHolidayName}` : configuredHolidayName
    }

    if (weeklyHolidayName) {
      return log ? `휴일근로 · ${weeklyHolidayName}` : weeklyHolidayName
    }

    if (log?.is_holiday) {
      return '휴일근로'
    }

    if (isSaturdayOffday) {
      return log ? '휴무일 근무' : '휴무일'
    }

    return '근무일'
  }
  const isMonthlyHolidayDate = (date: string, log?: WorkLog | null) =>
    Boolean(
      log?.is_holiday ||
        paidHolidayNames.has(date) ||
        getWeeklyHolidayName(
          date,
          settingsForm.weeklyHolidayDay,
          settingsForm.saturdayPolicy,
        ),
    )
  const yearOptions = Array.from(
    { length: 5 },
    (_, index) => Number(currentYear) - 2 + index,
  )

  async function loadOrganizationUnits() {
    const [divisionResult, teamResult, partResult] = await Promise.all([
      supabase
        .from('organization_divisions')
        .select(organizationDivisionSelect)
        .order('name', { ascending: true }),
      supabase
        .from('organization_teams')
        .select(organizationTeamSelect)
        .order('name', { ascending: true }),
      supabase
        .from('organization_parts')
        .select(organizationPartSelect)
        .order('name', { ascending: true }),
    ])

    if (divisionResult.error || teamResult.error || partResult.error) {
      setOrganizationDivisions([])
      setOrganizationTeams([])
      setOrganizationParts([])
      return
    }

    const divisions = (divisionResult.data ?? []) as OrganizationDivision[]
    const teams = (teamResult.data ?? []) as OrganizationTeam[]
    const parts = (partResult.data ?? []) as OrganizationPart[]

    setOrganizationDivisions(divisions)
    setOrganizationTeams(teams)
    setOrganizationParts(parts)
    setOrganizationForm((currentForm) => ({
      ...currentForm,
      teamDivisionId:
        currentForm.teamDivisionId || divisions[0]?.id || '',
      partTeamId: currentForm.partTeamId || teams[0]?.id || '',
    }))
  }

  async function loadAdminUsers() {
    if (!isAdmin) {
      setAdminUsers([])
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(profileSelect)
      .order('name', { ascending: true })

    if (error) {
      setSettingsMessage(error.message)
      setAdminUsers([])
      return
    }

    setAdminUsers((data ?? []) as AdminUser[])
  }

  async function handleCreateAdminUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSettingsMessage('')

    const normalizedEmail = adminCreateUserForm.email.trim().toLowerCase()
    const trimmedName = adminCreateUserForm.name.trim()

    if (!trimmedName || !normalizedEmail) {
      setSettingsMessage('이름과 메일을 입력해주세요.')
      return
    }

    const { data, error } = await supabase.functions.invoke<{
      user?: AdminUser
      message?: string
    }>('admin-create-user', {
      body: {
        email: normalizedEmail,
        password: normalizedEmail,
        name: trimmedName,
        position: adminCreateUserForm.position,
        organizationDivisionId: adminCreateUserForm.divisionId || null,
        organizationTeamId: adminCreateUserForm.teamId || null,
        organizationPartId: adminCreateUserForm.partId || null,
      },
    })

    if (error || !data?.user) {
      setSettingsMessage(
        data?.message ??
          error?.message ??
          '계정 생성에 실패했습니다. Edge Function 배포 상태를 확인해주세요.',
      )
      return
    }

    setAdminCreateUserForm(initialAdminCreateUserForm)
    setIsAdminCreateUserModalOpen(false)
    setSettingsMessage(
      `${data.user.name} 계정을 생성했습니다. 메일 인증 없이 바로 로그인할 수 있습니다.`,
    )
    await loadAdminUsers()
  }

  async function loadMonthlyHolidaySettings(
    targetYear = selectedYear,
    targetMonth = selectedMonth,
  ) {
    const nativeHolidayNames = await getKoreanPaidHolidayNames(
      targetYear,
      targetMonth,
    )
    const { start, end } = getMonthRange(targetYear, targetMonth)
    const { data, error } = await supabase
      .from('monthly_holidays')
      .select(customHolidaySelect)
      .gte('holiday_date', start)
      .lte('holiday_date', end)
      .order('holiday_date', { ascending: true })

    if (error) {
      setCustomHolidays([])
      return nativeHolidayNames
    }

    const holidayNames = new Map(nativeHolidayNames)
    const holidays = (data ?? []) as CustomHoliday[]
    holidays.forEach((holiday) => {
      holidayNames.set(holiday.holiday_date, getCustomHolidayDisplayName(holiday))
    })
    setCustomHolidays(holidays)

    return holidayNames
  }

  async function getConfiguredHolidayName(date: string) {
    const publicHolidayName = await getKoreanPublicHolidayName(date)
    const { data, error } = await supabase
      .from('monthly_holidays')
      .select(customHolidaySelect)
      .eq('holiday_date', date)
      .maybeSingle()

    if (error || !data) {
      return publicHolidayName
    }

    return getCustomHolidayDisplayName(data as CustomHoliday)
  }

  async function loadProfile(user: User) {
    const { data, error } = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', user.id)
      .maybeSingle()

    if (!error && data) {
      setProfile(data)
      applyProfileDefaults(data)
      return
    }

    const fallbackName =
      typeof user.user_metadata.name === 'string'
        ? user.user_metadata.name
        : user.email?.split('@')[0]

    const { data: createdProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email ?? '',
        name: fallbackName ?? '사용자',
        role: 'user',
        position: initialSettingsForm.position,
        hire_date: null,
        organization_division_id: null,
        organization_team_id: null,
        organization_part_id: null,
        annual_salary: Number(initialSettingsForm.annualSalary),
        standard_hourly_wage: 0,
        dependent_count: Number(initialSettingsForm.dependentCount),
        child_count: Number(initialSettingsForm.childCount),
      })
      .select(profileSelect)
      .maybeSingle()

    if (!upsertError && createdProfile) {
      setProfile(createdProfile)
      applyProfileDefaults(createdProfile)
    }
  }

  function applyProfileDefaults(nextProfile: Profile) {
    const fallbackAnnualSalary = nextProfile.standard_hourly_wage
      ? calculateAnnualSalaryFromHourlyWage(
          nextProfile.standard_hourly_wage,
          initialSettingsForm.monthlyInclusiveOvertimeHours,
          initialSettingsForm.monthlyInclusiveHolidayHours,
        )
      : Number(initialSettingsForm.annualSalary)
    const annualSalary = nextProfile.annual_salary ?? fallbackAnnualSalary

    setSettingsForm((currentForm) => ({
      ...currentForm,
      position: nextProfile.position ?? initialSettingsForm.position,
      hireDate: nextProfile.hire_date ?? initialSettingsForm.hireDate,
      organizationDivisionId:
        nextProfile.organization_division_id ??
        initialSettingsForm.organizationDivisionId,
      organizationTeamId:
        nextProfile.organization_team_id ?? initialSettingsForm.organizationTeamId,
      organizationPartId:
        nextProfile.organization_part_id ?? initialSettingsForm.organizationPartId,
      annualSalary: String(annualSalary),
      dependentCount: String(
        nextProfile.dependent_count ?? Number(initialSettingsForm.dependentCount),
      ),
      childCount: String(
        nextProfile.child_count ?? Number(initialSettingsForm.childCount),
      ),
    }))
  }

  async function loadSystemSettings() {
    const { data, error } = await supabase
      .from('system_settings')
      .select(systemSettingsSelect)
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) {
      applySystemSettings(null)
      return
    }

    applySystemSettings(data)
  }

  function applySystemSettings(nextSettings: SystemSettings | null) {
    const defaultRegularMinutes =
      nextSettings?.default_regular_minutes ?? DEFAULT_REGULAR_LIMIT_MINUTES
    const defaultRegularStart = normalizeStoredTime(
      nextSettings?.default_regular_start_time,
      initialSettingsForm.defaultRegularStart,
    )
    const defaultRegularEnd = normalizeStoredTime(
      nextSettings?.default_regular_end_time,
      minutesToTime(timeToMinutes(defaultRegularStart) + defaultRegularMinutes),
    )

    setSettingsForm((currentForm) => ({
      ...currentForm,
      defaultRegularStart,
      defaultRegularEnd,
      defaultBreakMinutes: String(
        nextSettings?.default_break_minutes ??
          Number(initialSettingsForm.defaultBreakMinutes),
      ),
      monthlyNonTaxablePay: String(
        nextSettings?.monthly_non_taxable_pay ??
          Number(initialSettingsForm.monthlyNonTaxablePay),
      ),
      weeklyHolidayDay: String(
        nextSettings?.weekly_holiday_day ??
          Number(initialSettingsForm.weeklyHolidayDay),
      ),
      saturdayPolicy:
        nextSettings?.saturday_policy ?? initialSettingsForm.saturdayPolicy,
      monthlyInclusiveOvertimeHours: String(
        nextSettings?.monthly_inclusive_overtime_hours ??
          Number(initialSettingsForm.monthlyInclusiveOvertimeHours),
      ),
      monthlyInclusiveHolidayHours: String(
        nextSettings?.monthly_inclusive_holiday_hours ??
          Number(initialSettingsForm.monthlyInclusiveHolidayHours),
      ),
      pensionRate: String(
        nextSettings?.pension_rate ?? Number(initialSettingsForm.pensionRate),
      ),
      healthInsuranceRate: String(
        nextSettings?.health_insurance_rate ??
          Number(initialSettingsForm.healthInsuranceRate),
      ),
      longTermCareRate: String(
        nextSettings?.long_term_care_rate ??
          Number(initialSettingsForm.longTermCareRate),
      ),
      employmentInsuranceRate: String(
        nextSettings?.employment_insurance_rate ??
          Number(initialSettingsForm.employmentInsuranceRate),
      ),
      localIncomeTaxRate: String(
        nextSettings?.local_income_tax_rate ??
          Number(initialSettingsForm.localIncomeTaxRate),
      ),
    }))
    setForm((currentForm) => ({
      ...currentForm,
      workStart: defaultRegularStart,
      workEnd: defaultRegularEnd,
    }))
  }

  async function loadLogs() {
    const targetUserId = selectedAdminUser?.id ?? session?.user.id

    if (!targetUserId) {
      setLogs([])
      return
    }

    const { start, end } = getMonthRange(selectedYear, selectedMonth)
    const { data, error } = await supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })

    if (error) {
      setSaveMessage(error.message)
      return
    }

    setLogs(data ?? [])
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage('')

    if (!email.trim() || !password) {
      setAuthMessage('이메일과 비밀번호를 입력해주세요.')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (authMode === 'signup') {
      if (!name.trim()) {
        setAuthMessage('이름을 입력해주세요.')
        return
      }

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      })
      if (error) {
        setAuthMessage(error?.message ?? '회원가입에 실패했습니다.')
        return
      }

      setAuthMode('login')
      setPassword('')
      setName('')
      setAuthMessage(
        `${normalizedEmail}로 인증 메일을 보냈습니다. 메일 확인 후 로그인해주세요.`,
      )
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      setAuthMessage(error.message)
    }
  }

  async function handlePasswordResetRequest(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setAuthMessage('')

    if (!email.trim()) {
      setAuthMessage('비밀번호를 재설정할 이메일을 입력해주세요.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: window.location.origin,
      },
    )

    if (error) {
      setAuthMessage(error.message)
      return
    }

    setAuthMessage('비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 확인해주세요.')
    setAuthMode('login')
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage('')

    if (!newPassword || !confirmPassword) {
      setAuthMessage('새 비밀번호를 입력해주세요.')
      return
    }

    if (newPassword !== confirmPassword) {
      setAuthMessage('새 비밀번호가 서로 다릅니다.')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      setAuthMessage(error.message)
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setAuthMode('login')
    setAuthMessage('비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.')
    await supabase.auth.signOut()
  }

  function clearWorkLogEditState() {
    setEditingWorkLogId(null)
    setSaveMessage('')
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveMessage('')

    if (!workTargetUserId) {
      setSaveMessage('로그인이 필요합니다.')
      return
    }

    if (isDateBeforeHireDate(form.workDate, workTargetHireDate)) {
      setSaveMessage('입사일자 이전 근무는 저장할 수 없습니다.')
      return
    }

    let duplicateQuery = supabase
      .from('work_logs')
      .select('id')
      .eq('user_id', workTargetUserId)
      .eq('work_date', form.workDate)

    if (editingWorkLogId) {
      duplicateQuery = duplicateQuery.neq('id', editingWorkLogId)
    }

    const { data: existingLog, error: duplicateCheckError } =
      await duplicateQuery.maybeSingle()

    if (duplicateCheckError) {
      setSaveMessage(duplicateCheckError.message)
      return
    }

    if (existingLog) {
      setSaveMessage('이미 입력된 근무일입니다.')
      return
    }

    const payload = buildWorkLogPayload(
      workTargetUserId,
      form,
      calculation,
      standardHourlyWage,
      commuteMinutes,
      breakMinutes,
      leaveMinutes,
      leavePay,
    )

    if (editingWorkLogId) {
      const { error } = await supabase
        .from('work_logs')
        .update(payload)
        .eq('id', editingWorkLogId)
        .eq('user_id', workTargetUserId)
        .select('id')
        .single()

      if (error) {
        setSaveMessage(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('work_logs').insert(payload)

      if (error) {
        setSaveMessage(error.message)
        return
      }
    }

    setToastMessage(
      editingWorkLogId ? '근무기록을 수정했습니다.' : '근무기록을 저장했습니다.',
    )
    setEditingWorkLogId(null)
    setForm({
      ...initialForm,
      workDate: form.workDate,
      workStart: settingsForm.defaultRegularStart,
      workEnd: settingsForm.defaultRegularEnd,
      noCommute: true,
      leaveType: 'none',
      overtimeReason: '',
    })
    await loadLogs()
  }

  function handleEditLog(log: WorkLog) {
    setEditingWorkLogId(log.id)
    setSelectedHolidayName(null)
    setSaveMessage('')
    setForm(buildWorkFormFromLog(log))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelWorkLogEdit() {
    setEditingWorkLogId(null)
    setSaveMessage('')
    setForm({
      ...initialForm,
      workDate: form.workDate,
      workStart: settingsForm.defaultRegularStart,
      workEnd: settingsForm.defaultRegularEnd,
      noCommute: true,
      leaveType: 'none',
      overtimeReason: '',
    })
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSettingsMessage('')

    if (!session?.user.id) {
      setSettingsMessage('로그인이 필요합니다.')
      return
    }

    const annualSalary = Number(settingsForm.annualSalary) || 0
    const dependentCount = Math.max(1, Number(settingsForm.dependentCount) || 1)
    const childCount = Math.max(0, Number(settingsForm.childCount) || 0)
    if (annualSalary <= 0 || profileHourlyWage <= 0) {
      setSettingsMessage('연봉을 확인해주세요.')
      return
    }

    const fallbackName =
      profile?.name ??
      (typeof session.user.user_metadata.name === 'string'
        ? session.user.user_metadata.name
        : session.user.email?.split('@')[0]) ??
      '사용자'

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        email: session.user.email ?? profile?.email ?? '',
        name: fallbackName,
        role: profile?.role ?? 'user',
        position: settingsForm.position,
        hire_date: settingsForm.hireDate || null,
        organization_division_id: settingsForm.organizationDivisionId || null,
        organization_team_id: settingsForm.organizationTeamId || null,
        organization_part_id: settingsForm.organizationPartId || null,
        annual_salary: annualSalary,
        standard_hourly_wage: profileHourlyWage,
        dependent_count: dependentCount,
        child_count: childCount,
      })
      .select(profileSelect)
      .maybeSingle()

    if (error || !data) {
      setSettingsMessage(error?.message ?? '프로필 저장에 실패했습니다.')
      return
    }

    setProfile(data)
    window.alert('저장되었습니다.')
    window.location.reload()
  }

  async function handleChangeProfilePassword(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setProfilePasswordMessage('')

    const currentPassword = profilePasswordForm.currentPassword.trim()
    const nextPassword = profilePasswordForm.newPassword
    const nextPasswordConfirm = profilePasswordForm.confirmPassword

    if (!session?.user.email) {
      setProfilePasswordMessage('로그인이 필요합니다.')
      return
    }

    if (!currentPassword || !nextPassword || !nextPasswordConfirm) {
      setProfilePasswordMessage('현재 비밀번호와 새 비밀번호를 입력해주세요.')
      return
    }

    if (nextPassword.length < 6) {
      setProfilePasswordMessage('새 비밀번호는 6자 이상 입력해주세요.')
      return
    }

    if (nextPassword !== nextPasswordConfirm) {
      setProfilePasswordMessage('새 비밀번호가 서로 다릅니다.')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })

    if (signInError) {
      setProfilePasswordMessage('현재 비밀번호가 올바르지 않습니다.')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: nextPassword,
    })

    if (error) {
      setProfilePasswordMessage(error.message)
      return
    }

    setProfilePasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setProfilePasswordMessage('비밀번호가 변경되었습니다.')
  }

  function closeProfilePasswordModal() {
    setIsProfilePasswordModalOpen(false)
    setProfilePasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setProfilePasswordMessage('')
  }

  async function handleSaveSystemSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const defaultBreakMinutes = Number(settingsForm.defaultBreakMinutes) || 0
    const weeklyHolidayDay = Number(settingsForm.weeklyHolidayDay) || 0
    if (defaultRegularMinutes <= 0) {
      setSettingsMessage('기본근무시간을 확인해주세요.')
      return
    }

    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        id: 1,
        default_regular_minutes: defaultRegularMinutes,
        default_regular_start_time: settingsForm.defaultRegularStart,
        default_regular_end_time: settingsForm.defaultRegularEnd,
        default_break_minutes: defaultBreakMinutes,
        monthly_non_taxable_pay: Number(settingsForm.monthlyNonTaxablePay) || 0,
        weekly_holiday_day: weeklyHolidayDay,
        saturday_policy: settingsForm.saturdayPolicy,
        monthly_inclusive_overtime_hours:
          Number(settingsForm.monthlyInclusiveOvertimeHours) || 0,
        monthly_inclusive_holiday_hours:
          Number(settingsForm.monthlyInclusiveHolidayHours) || 0,
        pension_rate: Number(settingsForm.pensionRate) || 0,
        health_insurance_rate: Number(settingsForm.healthInsuranceRate) || 0,
        long_term_care_rate: Number(settingsForm.longTermCareRate) || 0,
        employment_insurance_rate:
          Number(settingsForm.employmentInsuranceRate) || 0,
        local_income_tax_rate: Number(settingsForm.localIncomeTaxRate) || 0,
        updated_at: new Date().toISOString(),
      })
      .select(systemSettingsSelect)
      .maybeSingle()

    if (error || !data) {
      setSettingsMessage(error?.message ?? '시스템 설정 저장에 실패했습니다.')
      return
    }

    applySystemSettings(data)
    window.alert('저장되었습니다.')
    window.location.reload()
  }

  async function handleSaveMonthlyHoliday(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    if (!holidayForm.date || !holidayForm.name.trim()) {
      setSettingsMessage('휴일 일자와 명칭을 입력해주세요.')
      return
    }

    const { error } = await supabase.from('monthly_holidays').upsert(
      {
        holiday_date: holidayForm.date,
        name: holidayForm.name.trim(),
        is_substitute: holidayForm.isSubstitute,
      },
      { onConflict: 'holiday_date' },
    )

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    const nextYear = holidayForm.date.slice(0, 4)
    const nextMonth = holidayForm.date.slice(5, 7)
    clearWorkLogEditState()
    setSelectedYear(nextYear)
    setSelectedMonth(nextMonth)
    const holidayNames = await loadMonthlyHolidaySettings(nextYear, nextMonth)
    setPaidHolidayNames(holidayNames)
    setHolidayForm({
      date: `${nextYear}-${nextMonth}-01`,
      name: '',
      isSubstitute: false,
    })
    window.alert('저장되었습니다.')
  }

  async function handleCreateDivision() {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    if (!organizationForm.divisionName.trim()) {
      setSettingsMessage('본부명을 입력해주세요.')
      return
    }

    const { error } = await supabase.from('organization_divisions').insert({
      name: organizationForm.divisionName.trim(),
    })

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    setOrganizationForm((currentForm) => ({
      ...currentForm,
      divisionName: '',
    }))
    await loadOrganizationUnits()
  }

  async function handleCreateTeam(
    divisionId = organizationForm.teamDivisionId,
    teamName = organizationForm.teamName,
  ) {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const trimmedTeamName = teamName.trim()

    if (!divisionId || !trimmedTeamName) {
      setSettingsMessage('본부와 팀명을 입력해주세요.')
      return
    }

    const { error } = await supabase.from('organization_teams').insert({
      division_id: divisionId,
      name: trimmedTeamName,
    })

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    setOrganizationForm((currentForm) => ({
      ...currentForm,
      teamName: '',
    }))
    await loadOrganizationUnits()
  }

  async function handleCreatePart(
    teamId = organizationForm.partTeamId,
    partName = organizationForm.partName,
  ) {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const trimmedPartName = partName.trim()

    if (!teamId || !trimmedPartName) {
      setSettingsMessage('팀과 파트명을 입력해주세요.')
      return
    }

    const { error } = await supabase.from('organization_parts').insert({
      team_id: teamId,
      name: trimmedPartName,
    })

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    setOrganizationForm((currentForm) => ({
      ...currentForm,
      partName: '',
    }))
    await loadOrganizationUnits()
  }

  async function handleDeleteOrganizationUnit(
    tableName:
      | 'organization_divisions'
      | 'organization_teams'
      | 'organization_parts',
    id: string,
  ) {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const { error } = await supabase.from(tableName).delete().eq('id', id)

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    await loadOrganizationUnits()
    await loadAdminUsers()
  }

  async function handleUpdateOrganizationHead(
    tableName:
      | 'organization_divisions'
      | 'organization_teams'
      | 'organization_parts',
    id: string,
    headUserId: string,
  ) {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const { error } = await supabase
      .from(tableName)
      .update({ head_user_id: headUserId || null })
      .eq('id', id)

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    await loadOrganizationUnits()
    setOrganizationHeadEditor(null)
    setToastMessage('조직장을 저장했습니다.')
  }

  async function handleSaveAdminUserOrganization(targetUser: AdminUser) {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const draft = getAdminOrgDraft(targetUser)
    const profileDraft = getAdminProfileDraft(targetUser)
    const annualSalary = Number(profileDraft.annualSalary) || 0
    const dependentCount = Math.max(1, Number(profileDraft.dependentCount) || 1)
    const childCount = Math.max(0, Number(profileDraft.childCount) || 0)
    const standardHourlyWage = calculateStandardHourlyWageFromAnnualSalary(
      annualSalary,
      settingsForm.monthlyInclusiveOvertimeHours,
      settingsForm.monthlyInclusiveHolidayHours,
    )

    if (annualSalary <= 0 || standardHourlyWage <= 0) {
      setSettingsMessage('연봉을 확인해주세요.')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        position: profileDraft.position,
        hire_date: profileDraft.hireDate || null,
        organization_division_id: draft.divisionId || null,
        organization_team_id: draft.teamId || null,
        organization_part_id: draft.partId || null,
        annual_salary: annualSalary,
        standard_hourly_wage: standardHourlyWage,
        dependent_count: dependentCount,
        child_count: childCount,
      })
      .eq('id', targetUser.id)
      .select(profileSelect)
      .maybeSingle()

    if (error || !data) {
      setSettingsMessage(error?.message ?? '사용자 조직 저장에 실패했습니다.')
      return
    }

    const updatedUser = data as AdminUser
    setAdminUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    )
    setAdminUserOrgDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[updatedUser.id]
      return nextDrafts
    })
    setAdminUserProfileDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[updatedUser.id]
      return nextDrafts
    })
    if (selectedAdminUser?.id === updatedUser.id) {
      setSelectedAdminUser(updatedUser)
    }
    if (profile?.id === updatedUser.id) {
      setProfile(updatedUser)
      applyProfileDefaults(updatedUser)
    }
    if (organizationUserEditor?.id === updatedUser.id) {
      setOrganizationUserEditor(null)
    }
    if (adminUserEditor?.id === updatedUser.id) {
      setAdminUserEditor(null)
    }
    setToastMessage('사용자 조직을 저장했습니다.')
  }

  function toggleWorkLogUserSelection(userId: string) {
    setSelectedWorkLogUserIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((currentId) => currentId !== userId)
        : [...currentIds, userId],
    )
  }

  function toggleAllFilteredWorkLogUsers() {
    setSelectedWorkLogUserIds((currentIds) => {
      if (isAllFilteredUsersSelected) {
        return currentIds.filter((userId) => !filteredAdminUserIds.includes(userId))
      }

      return Array.from(new Set([...currentIds, ...filteredAdminUserIds]))
    })
  }

  async function downloadWorkLogWorkbook(
    selectedUsers: Profile[],
    workLogs: WorkLog[],
    year: string,
    month: string,
    fileName: string,
  ) {
    if (selectedUsers.length > 20) {
      throw new Error(
        'STL 근태 기록 템플릿은 최대 20명까지만 다운로드할 수 있습니다.',
      )
    }

    const logsByUser = new Map<string, WorkLog[]>()
    workLogs.forEach((log) => {
      logsByUser.set(log.user_id, [...(logsByUser.get(log.user_id) ?? []), log])
    })

    const templateBuffer = await loadWorkLogTemplateBuffer()
    const zip = await JSZip.loadAsync(templateBuffer)
    const workbookXmlFile = zip.file('xl/workbook.xml')
    const workbookRelsFile = zip.file('xl/_rels/workbook.xml.rels')

    if (!workbookXmlFile || !workbookRelsFile) {
      throw new Error('근태 기록 템플릿 구조를 확인할 수 없습니다.')
    }

    const workbookDocument = parseSpreadsheetXml(
      await workbookXmlFile.async('text'),
    )
    const workbookRelsDocument = parseSpreadsheetXml(
      await workbookRelsFile.async('text'),
    )
    const sheetTargets = getWorkbookSheetTargets(
      workbookDocument,
      workbookRelsDocument,
    )
    const dashboardTarget = sheetTargets.get('DashBoard')
    const dashboardDocument = dashboardTarget
      ? parseSpreadsheetXml(
          (await zip.file(dashboardTarget.path)?.async('text')) ?? '',
        )
      : null
    const lastDay = Number(getMonthRange(year, month).end.slice(8, 10))
    const regularEndMinutes = timeToMinutes(settingsForm.defaultRegularEnd)
    const usedSheetNames = new Set(Array.from(sheetTargets.keys()))

    for (let sheetIndex = 1; sheetIndex <= 20; sheetIndex += 1) {
      const originalSheetName = String(sheetIndex)
      const sheetTarget = sheetTargets.get(originalSheetName)

      if (!sheetTarget) {
        continue
      }

      const sheetXmlFile = zip.file(sheetTarget.path)
      if (!sheetXmlFile) {
        continue
      }

      const sheetDocument = parseSpreadsheetXml(await sheetXmlFile.async('text'))
      const sheetData = sheetDocument.getElementsByTagNameNS(
        spreadsheetNamespace,
        'sheetData',
      )[0]

      if (!sheetData) {
        continue
      }

      normalizeWeekdayFormula(sheetDocument)

      const sheetContext = {
        document: sheetDocument,
        sheetData,
      }
      const user = selectedUsers[sheetIndex - 1]
      const userLogs = user ? logsByUser.get(user.id) ?? [] : []
      const logsByDate = new Map(userLogs.map((log) => [log.work_date, log]))

      if (user) {
        usedSheetNames.delete(originalSheetName)
        const nextSheetName = getSafeSheetName(user.name, usedSheetNames)
        sheetTarget.element.setAttribute('name', nextSheetName)
        replaceSheetReference(dashboardDocument, originalSheetName, nextSheetName)
      }

      setXmlTimeCellValue(
        sheetContext,
        'B3',
        timeToMinutes(settingsForm.defaultRegularStart),
      )
      setXmlTimeCellValue(
        sheetContext,
        'B5',
        timeToMinutes(settingsForm.defaultRegularEnd),
      )
      setXmlCellValue(sheetContext, 'B7', user?.name ?? null)
      setXmlCellValue(
        sheetContext,
        'B9',
        user?.hire_date ? new Date(`${user.hire_date}T00:00:00`) : null,
      )
      setXmlCellValue(
        sheetContext,
        'F3',
        new Date(`${year}-${month}-01T00:00:00`),
      )

      for (let day = 1; day <= 31; day += 1) {
        const row = day + 2
        const date = `${year}-${month}-${String(day).padStart(2, '0')}`

        ;['G', 'H', 'I', 'J', 'K', 'L'].forEach((column) => {
          setXmlCellValue(sheetContext, `${column}${row}`, null)
        })

        if (day > lastDay) {
          continue
        }

        const log = logsByDate.get(date)

        if (!log) {
          continue
        }

        const scheduleLabel =
          log.leave_type && log.leave_type !== 'none'
            ? '휴가'
            : log.is_holiday || isMonthlyHolidayDate(log.work_date, log)
              ? getKoreanWeekday(log.work_date) === 0
                ? '주휴일'
                : '공휴일'
              : getKoreanWeekday(log.work_date) === 6 &&
                  settingsForm.saturdayPolicy === 'offday'
                ? '휴무'
                : ''

        if (scheduleLabel) {
          setXmlCellValue(sheetContext, `D${row}`, scheduleLabel)
        }
        setXmlCellValue(
          sheetContext,
          `G${row}`,
          formatClockMinutes(
            getWorkLogClockMinutes(log.work_date, log.office_clock_in),
          ),
        )
        setXmlCellValue(
          sheetContext,
          `H${row}`,
          formatClockMinutes(
            getWorkLogClockMinutes(log.work_date, log.office_clock_out),
          ),
        )
        const isAfterRegularEnd =
          getWorkLogClockMinutes(log.work_date, log.office_clock_out) >
          regularEndMinutes

        setXmlCellValue(sheetContext, `I${row}`, 'X')
        setXmlCellValue(sheetContext, `J${row}`, isAfterRegularEnd ? 'O' : null)
        setXmlCellValue(sheetContext, `K${row}`, isAfterRegularEnd ? 'O' : null)
        setXmlCellValue(sheetContext, `L${row}`, log.overtime_reason ?? null)
      }

      zip.file(sheetTarget.path, serializeSpreadsheetXml(sheetDocument))
    }

    zip.file('xl/workbook.xml', serializeSpreadsheetXml(workbookDocument))
    if (dashboardTarget && dashboardDocument) {
      zip.file(dashboardTarget.path, serializeSpreadsheetXml(dashboardDocument))
    }

    downloadWorkbookBlob(
      await zip.generateAsync({
        type: 'blob',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      fileName,
    )
  }

  async function handleDownloadWorkLogs() {
    setSettingsMessage('')

    if (!isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    if (selectedWorkLogUserIds.length === 0) {
      setSettingsMessage('근무일지를 다운로드할 사용자를 선택해주세요.')
      return
    }

    try {
      const { start, end } = getMonthRange(
        workLogDownloadYear,
        workLogDownloadMonth,
      )
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .in('user_id', selectedWorkLogUserIds)
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date', { ascending: true })

      if (error) {
        setSettingsMessage(error.message)
        return
      }

      const selectedUsers = sortOrganizationUsers(
        adminUsers.filter((user) => selectedWorkLogUserIds.includes(user.id)),
      )

      await downloadWorkLogWorkbook(
        selectedUsers,
        (data ?? []) as WorkLog[],
        workLogDownloadYear,
        workLogDownloadMonth,
        `근무일지_${workLogDownloadYear}-${workLogDownloadMonth}.xlsx`,
      )
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : '알 수 없는 오류'
      console.error(downloadError)
      setSettingsMessage(`근무일지 다운로드에 실패했습니다: ${message}`)
    }
  }

  async function handleDownloadMyWorkLog() {
    setCalendarMessage('')

    if (!profile?.id) {
      setCalendarMessage('로그인이 필요합니다.')
      return
    }

    try {
      await downloadWorkLogWorkbook(
        [profile],
        payrollLogs,
        selectedYear,
        selectedMonth,
        `근무일지_${profile.name}_${selectedYear}-${selectedMonth}.xlsx`,
      )
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : '알 수 없는 오류'
      console.error(downloadError)
      setCalendarMessage(`근무일지 다운로드에 실패했습니다: ${message}`)
    }
  }

  async function handleDeleteMonthlyHoliday(id: string) {
    setSettingsMessage('')

    if (!session?.user.id || !isAdmin) {
      setSettingsMessage('관리자 권한이 필요합니다.')
      return
    }

    const { error } = await supabase
      .from('monthly_holidays')
      .delete()
      .eq('id', id)

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    const holidayNames = await loadMonthlyHolidaySettings()
    setPaidHolidayNames(holidayNames)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('work_logs').delete().eq('id', id)

    if (error) {
      setSaveMessage(error.message)
      return
    }

    if (editingWorkLogId === id) {
      setEditingWorkLogId(null)
    }

    await loadLogs()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (authMode === 'reset') {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <AuthHeader />
          <form className="stack-form" onSubmit={handleUpdatePassword}>
            <label>
              새 비밀번호
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              새 비밀번호 확인
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            <button type="submit" className="primary-button">
              <KeyRound size={18} />
              비밀번호 변경
            </button>
          </form>
          {authMessage && <p className="message">{authMessage}</p>}
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <AuthHeader />

          <div className="mode-tabs" aria-label="인증 모드">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => {
                setAuthMode('login')
                setAuthMessage('')
              }}
            >
              로그인
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signup')
                setAuthMessage('')
              }}
            >
              회원가입
            </button>
          </div>

          {authMessage && <p className="message status-message">{authMessage}</p>}

          <form
            className="stack-form"
            onSubmit={
              authMode === 'forgot' ? handlePasswordResetRequest : handleAuth
            }
          >
            <label>
              이메일
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {authMode !== 'forgot' && (
              <label>
                비밀번호
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            {authMode === 'signup' && (
              <label>
                이름
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="이름"
                />
              </label>
            )}
            <button type="submit" className="primary-button">
              {authMode === 'forgot' ? <Mail size={18} /> : <UserRound size={18} />}
              {authMode === 'login'
                ? '로그인'
                : authMode === 'signup'
                  ? '가입하기'
                  : '재설정 메일 보내기'}
            </button>
          </form>
          {authMode === 'login' && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode('forgot')
                setAuthMessage('')
              }}
            >
              비밀번호 찾기
            </button>
          )}
          {authMode === 'forgot' && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode('login')
                setAuthMessage('')
              }}
            >
              로그인으로 돌아가기
            </button>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Salary calculator</p>
          <h1>WorkSalaryCalculator</h1>
        </div>
        <div className="user-actions">
          <span className="user-display-name">{userDisplayName}님</span>
          <button
            type="button"
            className={activePage === 'work' ? 'nav-button active' : 'nav-button'}
            onClick={() => {
              setActivePage('work')
              setIsUserMenuOpen(false)
              setIsAdminMenuOpen(false)
            }}
          >
            <Clock size={17} />
            근무입력
          </button>
          <button
            type="button"
            className={
              activePage === 'calendar' ? 'nav-button active' : 'nav-button'
            }
            onClick={() => {
              setActivePage('calendar')
              setIsUserMenuOpen(false)
              setIsAdminMenuOpen(false)
            }}
          >
            <Grid3X3 size={17} />
            워킹캘린더
          </button>
          {isAdmin && (
            <div className="user-menu admin-menu">
              <button
                type="button"
                className={
                  activePage === 'users' ||
                  activePage === 'system' ||
                  activePage === 'organization'
                    ? 'nav-button active'
                    : 'nav-button'
                }
                aria-expanded={isAdminMenuOpen}
                onClick={() => {
                  setIsAdminMenuOpen((isOpen) => !isOpen)
                  setIsUserMenuOpen(false)
                }}
              >
                <Users size={17} />
                관리자메뉴
              </button>
              {isAdminMenuOpen && (
                <div className="user-menu-panel admin-menu-panel">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('users')
                      setIsAdminMenuOpen(false)
                    }}
                  >
                    <Users size={16} />
                    사용자관리
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('organization')
                      setIsAdminMenuOpen(false)
                    }}
                  >
                    <Users size={16} />
                    조직관리
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('system')
                      setIsAdminMenuOpen(false)
                    }}
                  >
                    <Settings size={16} />
                    시스템관리
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="user-menu">
            <button
              type="button"
              className={activePage === 'profile' ? 'icon-button active' : 'icon-button'}
              aria-label="사용자 메뉴"
              aria-expanded={isUserMenuOpen}
              onClick={() => {
                setIsUserMenuOpen((isOpen) => !isOpen)
                setIsAdminMenuOpen(false)
              }}
            >
              <Settings size={18} />
            </button>
            {isUserMenuOpen && (
              <div className="user-menu-panel">
                <button
                  type="button"
                  onClick={() => {
                    setActivePage('profile')
                    setIsUserMenuOpen(false)
                  }}
                >
                  <UserRound size={16} />
                  마이페이지
                </button>
                <button type="button" onClick={handleLogout}>
                  <LogOut size={16} />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {toastMessage && (
        <div className="toast-message" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {activePage === 'profile' ? (
        <section className="settings-section">
          <form className="settings-form" onSubmit={handleSaveProfile}>
            <div className="section-title">
              <UserRound size={20} />
              <h2>마이페이지</h2>
            </div>
            <div className="readonly-field profile-hourly-summary">
              산정 통상시급
              <strong>{formatCurrency(profileHourlyWage)}</strong>
            </div>
            <div className="form-grid settings-grid">
              <label className="settings-half">
                직급
                <select
                  value={settingsForm.position}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      position: event.target.value,
                    })
                  }
                >
                  {positionOptions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-half">
                입사일자
                <input
                  type="date"
                  value={settingsForm.hireDate}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      hireDate: event.target.value,
                    })
                  }
                />
              </label>
              <label className="settings-half">
                본부
                <select
                  value={settingsForm.organizationDivisionId}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      organizationDivisionId: event.target.value,
                      organizationTeamId: '',
                      organizationPartId: '',
                    })
                  }
                >
                  <option value="">본부 미지정</option>
                  {organizationDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-half">
                팀
                <select
                  value={settingsForm.organizationTeamId}
                  disabled={!settingsForm.organizationDivisionId}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      organizationTeamId: event.target.value,
                      organizationPartId: '',
                    })
                  }
                >
                  <option value="">팀 미지정</option>
                  {profileTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-half">
                파트
                <select
                  value={settingsForm.organizationPartId}
                  disabled={!settingsForm.organizationTeamId}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      organizationPartId: event.target.value,
                    })
                  }
                >
                  <option value="">파트 미지정</option>
                  {profileParts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-half">
                연봉
                <div className="money-input">
                  <span>₩</span>
                  <input
                    inputMode="numeric"
                    value={formatNumber(settingsForm.annualSalary)}
                    onChange={(event) =>
                      setSettingsForm({
                        ...settingsForm,
                        annualSalary: digitsOnly(event.target.value),
                      })
                    }
                  />
                </div>
              </label>
              <label className="settings-half">
                부양가족수
                <input
                  inputMode="numeric"
                  value={settingsForm.dependentCount}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      dependentCount: digitsOnly(event.target.value),
                    })
                  }
                />
              </label>
              <label className="settings-half">
                8세 이상 20세 이하 자녀 수
                <input
                  inputMode="numeric"
                  value={settingsForm.childCount}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      childCount: digitsOnly(event.target.value),
                    })
                  }
                />
              </label>
              <button type="submit" className="primary-button">
                <Save size={18} />
                설정 저장
              </button>
              <button
                type="button"
                className="secondary-button settings-half"
                onClick={() => {
                  setProfilePasswordMessage('')
                  setIsProfilePasswordModalOpen(true)
                }}
              >
                <KeyRound size={18} />
                비밀번호 변경
              </button>
            </div>
            {settingsMessage && <p className="message">{settingsMessage}</p>}
          </form>
          {isProfilePasswordModalOpen && (
            <div className="modal-backdrop" onClick={closeProfilePasswordModal}>
              <section
                className="holiday-modal password-change-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="section-title">
                    <KeyRound size={20} />
                    <h3>비밀번호 변경</h3>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={closeProfilePasswordModal}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>
                <form
                  className="settings-form"
                  onSubmit={handleChangeProfilePassword}
                >
                  <div className="form-grid settings-grid">
                    <label className="settings-half">
                      현재 비밀번호
                      <input
                        type="password"
                        value={profilePasswordForm.currentPassword}
                        autoComplete="current-password"
                        onChange={(event) =>
                          setProfilePasswordForm({
                            ...profilePasswordForm,
                            currentPassword: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="settings-half">
                      새 비밀번호
                      <input
                        type="password"
                        value={profilePasswordForm.newPassword}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setProfilePasswordForm({
                            ...profilePasswordForm,
                            newPassword: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="settings-half">
                      새 비밀번호 확인
                      <input
                        type="password"
                        value={profilePasswordForm.confirmPassword}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setProfilePasswordForm({
                            ...profilePasswordForm,
                            confirmPassword: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button type="submit" className="primary-button settings-half">
                      <KeyRound size={18} />
                      비밀번호 변경
                    </button>
                  </div>
                  {profilePasswordMessage && (
                    <p className="message">{profilePasswordMessage}</p>
                  )}
                </form>
              </section>
            </div>
          )}
        </section>
      ) : activePage === 'users' && isAdmin ? (
        <section className="settings-section">
          <div className="settings-form">
            <div className="section-header-row">
              <div className="section-title">
                <Users size={20} />
                <h2>사용자관리</h2>
              </div>
            </div>
            {settingsMessage && <p className="message">{settingsMessage}</p>}
            <div className="admin-user-filter">
              <label>
                본부
                <select
                  value={adminUserFilters.divisionId}
                  onChange={(event) =>
                    setAdminUserFilters({
                      ...adminUserFilters,
                      divisionId: event.target.value,
                      teamId: '',
                      partId: '',
                    })
                  }
                >
                  <option value="">전체 본부</option>
                  {organizationDivisions.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                팀
                <select
                  value={adminUserFilters.teamId}
                  disabled={!adminUserFilters.divisionId}
                  onChange={(event) =>
                    setAdminUserFilters({
                      ...adminUserFilters,
                      teamId: event.target.value,
                      partId: '',
                    })
                  }
                >
                  <option value="">전체 팀</option>
                  {adminFilterTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                파트
                <select
                  value={adminUserFilters.partId}
                  disabled={!adminUserFilters.teamId}
                  onChange={(event) =>
                    setAdminUserFilters({
                      ...adminUserFilters,
                      partId: event.target.value,
                    })
                  }
                >
                  <option value="">전체 파트</option>
                  {adminFilterParts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                이름 검색
                <input
                  value={adminUserFilters.name}
                  onChange={(event) =>
                    setAdminUserFilters({
                      ...adminUserFilters,
                      name: event.target.value,
                    })
                  }
                  placeholder="이름 일부 입력"
                />
              </label>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() =>
                  setAdminUserFilters({
                    divisionId: '',
                    teamId: '',
                    partId: '',
                    name: '',
                  })
                }
              >
                초기화
              </button>
            </div>
            <div className="admin-user-toolbar">
              <span>
                표시 사용자 <strong>{filteredAdminUsers.length}</strong>명 · 선택{' '}
                <strong>{selectedWorkLogUserIds.length}</strong>명
              </span>
              <div className="admin-user-toolbar-actions">
                <select
                  value={workLogDownloadYear}
                  onChange={(event) => setWorkLogDownloadYear(event.target.value)}
                  aria-label="근무일지 다운로드 연도"
                >
                  {yearOptions.map((year) => (
                    <option
                      key={year}
                      value={year}
                      disabled={year > Number(currentYear)}
                    >
                      {year}년
                    </option>
                  ))}
                </select>
                <select
                  value={workLogDownloadMonth}
                  onChange={(event) => setWorkLogDownloadMonth(event.target.value)}
                  aria-label="근무일지 다운로드 월"
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const month = String(index + 1).padStart(2, '0')
                    const isFutureMonth =
                      Number(workLogDownloadYear) === Number(currentYear) &&
                      Number(month) > Number(currentMonth)

                    return (
                      <option key={month} value={month} disabled={isFutureMonth}>
                        {Number(month)}월
                      </option>
                    )
                  })}
                </select>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={handleDownloadWorkLogs}
                >
                  <Download size={18} />
                  근무일지 다운로드
                </button>
                <button
                  type="button"
                  className="primary-button compact-button"
                  onClick={() => {
                    setSettingsMessage('')
                    setIsAdminCreateUserModalOpen(true)
                  }}
                >
                  <UserRound size={18} />
                  계정 생성
                </button>
              </div>
            </div>
            {isAdminCreateUserModalOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setIsAdminCreateUserModalOpen(false)}
              >
                <section
                  className="holiday-modal admin-create-user-modal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="modal-header">
                    <div className="section-title">
                      <UserRound size={20} />
                      <h3>사용자 계정 생성</h3>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setIsAdminCreateUserModalOpen(false)}
                      aria-label="닫기"
                    >
                      ×
                    </button>
                  </div>
                  <form className="admin-create-user" onSubmit={handleCreateAdminUser}>
                    <div className="admin-create-user-grid">
                      <label>
                        이름
                        <input
                          value={adminCreateUserForm.name}
                          onChange={(event) =>
                            setAdminCreateUserForm({
                              ...adminCreateUserForm,
                              name: event.target.value,
                            })
                          }
                          placeholder="이름"
                        />
                      </label>
                      <label>
                        메일주소
                        <input
                          type="email"
                          value={adminCreateUserForm.email}
                          onChange={(event) =>
                            setAdminCreateUserForm({
                              ...adminCreateUserForm,
                              email: event.target.value,
                            })
                          }
                          placeholder="name@company.com"
                        />
                      </label>
                      <label>
                        직급
                        <select
                          value={adminCreateUserForm.position}
                          onChange={(event) =>
                            setAdminCreateUserForm({
                              ...adminCreateUserForm,
                              position: event.target.value,
                            })
                          }
                        >
                          {positionOptions.map((position) => (
                            <option key={position} value={position}>
                              {position}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        본부
                        <select
                          value={adminCreateUserForm.divisionId}
                          onChange={(event) =>
                            setAdminCreateUserForm({
                              ...adminCreateUserForm,
                              divisionId: event.target.value,
                              teamId: '',
                              partId: '',
                            })
                          }
                        >
                          <option value="">본부 미지정</option>
                          {organizationDivisions.map((division) => (
                            <option key={division.id} value={division.id}>
                              {division.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        팀
                        <select
                          value={adminCreateUserForm.teamId}
                          disabled={!adminCreateUserForm.divisionId}
                          onChange={(event) =>
                            setAdminCreateUserForm({
                              ...adminCreateUserForm,
                              teamId: event.target.value,
                              partId: '',
                            })
                          }
                        >
                          <option value="">팀 미지정</option>
                          {adminCreateUserTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        파트
                        <select
                          value={adminCreateUserForm.partId}
                          disabled={!adminCreateUserForm.teamId}
                          onChange={(event) =>
                            setAdminCreateUserForm({
                              ...adminCreateUserForm,
                              partId: event.target.value,
                            })
                          }
                        >
                          <option value="">파트 미지정</option>
                          {adminCreateUserParts.map((part) => (
                            <option key={part.id} value={part.id}>
                              {part.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="primary-button">
                        <Save size={18} />
                        계정 생성
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
            <div className="admin-user-table-wrap">
              {filteredAdminUsers.length === 0 ? (
                <p className="empty-state">표시할 사용자가 없습니다.</p>
              ) : (
                <table className="admin-user-table">
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={isAllFilteredUsersSelected}
                          onChange={toggleAllFilteredWorkLogUsers}
                          aria-label="표시 사용자 전체 선택"
                        />
                      </th>
                      <th>사용자</th>
                      <th>메일</th>
                      <th>직급</th>
                      <th>현재 소속</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="clickable-user-row"
                        onClick={() => setAdminUserEditor(user)}
                      >
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selectedWorkLogUserIds.includes(user.id)}
                            onChange={() => toggleWorkLogUserSelection(user.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`${user.name} 근무일지 선택`}
                          />
                        </td>
                        <td>
                          <strong>{user.name}</strong>
                          {getUserHeadRoles(user) && (
                            <small className="user-head-role">
                              {getUserHeadRoles(user)}
                            </small>
                          )}
                        </td>
                        <td>
                          <span>{user.email}</span>
                        </td>
                        <td>{user.position ?? '직급 없음'}</td>
                        <td>
                          <small>{getOrganizationPath(user)}</small>
                        </td>
                        <td>
                          <div className="admin-user-actions">
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                clearWorkLogEditState()
                                setSelectedAdminUser(user)
                                setActivePage('work')
                              }}
                            >
                              근무보기
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {adminUserEditor && (
              <div
                className="modal-backdrop"
                onClick={() => setAdminUserEditor(null)}
              >
                <section
                  className="holiday-modal user-organization-modal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="modal-header">
                    <div className="section-title">
                      <UserRound size={20} />
                      <h3>사용자 수정</h3>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setAdminUserEditor(null)}
                      aria-label="닫기"
                    >
                      ×
                    </button>
                  </div>
                  <div className="selected-user-summary">
                    <strong>
                      {adminUserEditor.name} · {adminUserEditor.position ?? '직급 없음'}
                    </strong>
                    <span>{adminUserEditor.email}</span>
                  </div>
                  <div className="user-edit-grid">
                    <div className="readonly-field user-edit-hourly">
                      산정 통상시급
                      <strong>{formatCurrency(adminProfileEditorHourlyWage)}</strong>
                    </div>
                    <label>
                      직급
                      <select
                        value={adminProfileEditorDraft.position}
                        onChange={(event) =>
                          setAdminUserProfileDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              ...adminProfileEditorDraft,
                              position: event.target.value,
                            },
                          }))
                        }
                      >
                        {positionOptions.map((position) => (
                          <option key={position} value={position}>
                            {position}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      입사일자
                      <input
                        type="date"
                        value={adminProfileEditorDraft.hireDate}
                        onChange={(event) =>
                          setAdminUserProfileDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              ...adminProfileEditorDraft,
                              hireDate: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      연봉
                      <div className="money-input">
                        <span>₩</span>
                        <input
                          inputMode="numeric"
                          value={formatNumber(adminProfileEditorDraft.annualSalary)}
                          onChange={(event) =>
                            setAdminUserProfileDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [adminUserEditor.id]: {
                                ...adminProfileEditorDraft,
                                annualSalary: digitsOnly(event.target.value),
                              },
                            }))
                          }
                        />
                      </div>
                    </label>
                    <label>
                      부양가족수
                      <input
                        inputMode="numeric"
                        value={adminProfileEditorDraft.dependentCount}
                        onChange={(event) =>
                          setAdminUserProfileDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              ...adminProfileEditorDraft,
                              dependentCount: digitsOnly(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      8세 이상 20세 이하 자녀 수
                      <input
                        inputMode="numeric"
                        value={adminProfileEditorDraft.childCount}
                        onChange={(event) =>
                          setAdminUserProfileDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              ...adminProfileEditorDraft,
                              childCount: digitsOnly(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      본부
                      <select
                        value={adminEditorDraft.divisionId}
                        onChange={(event) =>
                          setAdminUserOrgDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              divisionId: event.target.value,
                              teamId: '',
                              partId: '',
                            },
                          }))
                        }
                      >
                        <option value="">본부 미지정</option>
                        {organizationDivisions.map((division) => (
                          <option key={division.id} value={division.id}>
                            {division.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      팀
                      <select
                        value={adminEditorDraft.teamId}
                        disabled={!adminEditorDraft.divisionId}
                        onChange={(event) =>
                          setAdminUserOrgDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              ...adminEditorDraft,
                              teamId: event.target.value,
                              partId: '',
                            },
                          }))
                        }
                      >
                        <option value="">팀 미지정</option>
                        {adminEditorTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      파트
                      <select
                        value={adminEditorDraft.partId}
                        disabled={!adminEditorDraft.teamId}
                        onChange={(event) =>
                          setAdminUserOrgDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [adminUserEditor.id]: {
                              ...adminEditorDraft,
                              partId: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">파트 미지정</option>
                        {adminEditorParts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="primary-button user-edit-save"
                      onClick={() => handleSaveAdminUserOrganization(adminUserEditor)}
                    >
                      <Save size={18} />
                      저장
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      ) : activePage === 'system' && isAdmin ? (
        <section className="settings-section">
          <form className="settings-form" onSubmit={handleSaveSystemSettings}>
            <div className="section-title">
              <Settings size={20} />
              <h2>시스템 설정</h2>
            </div>
            <section className="organization-manager system-hidden-org">
              <div className="section-title compact-title">
                <Users size={18} />
                <h3>조직 설정</h3>
              </div>
              <div className="organization-create-grid">
                <label>
                  본부 추가
                  <input
                    value={organizationForm.divisionName}
                    onChange={(event) =>
                      setOrganizationForm({
                        ...organizationForm,
                        divisionName: event.target.value,
                      })
                    }
                    placeholder="예: 개발본부"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCreateDivision}
                >
                  본부 추가
                </button>
                <label>
                  팀 추가
                  <select
                    value={organizationForm.teamDivisionId}
                    onChange={(event) =>
                      setOrganizationForm({
                        ...organizationForm,
                        teamDivisionId: event.target.value,
                      })
                    }
                  >
                    <option value="">본부 선택</option>
                    {organizationDivisions.map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={organizationForm.teamName}
                    onChange={(event) =>
                      setOrganizationForm({
                        ...organizationForm,
                        teamName: event.target.value,
                      })
                    }
                    placeholder="예: 플랫폼팀"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleCreateTeam()}
                >
                  팀 추가
                </button>
                <label>
                  파트 추가
                  <select
                    value={organizationForm.partTeamId}
                    onChange={(event) =>
                      setOrganizationForm({
                        ...organizationForm,
                        partTeamId: event.target.value,
                      })
                    }
                  >
                    <option value="">팀 선택</option>
                    {organizationTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {getDivisionName(team.division_id)} / {team.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={organizationForm.partName}
                    onChange={(event) =>
                      setOrganizationForm({
                        ...organizationForm,
                        partName: event.target.value,
                      })
                    }
                    placeholder="예: 프론트파트"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleCreatePart()}
                >
                  파트 추가
                </button>
              </div>
              <div className="organization-list">
                {organizationDivisions.length === 0 ? (
                  <p className="empty-state">등록된 조직이 없습니다.</p>
                ) : (
                  organizationDivisions.map((division) => (
                    <article className="organization-card" key={division.id}>
                      <div className="organization-card-title">
                        <div>
                          <strong>{division.name}</strong>
                          <small>
                            본부장 {getUserName(division.head_user_id) || '미지정'}
                          </small>
                        </div>
                        <label className="organization-head-select">
                          본부장
                          <select
                            value={division.head_user_id ?? ''}
                            onChange={(event) =>
                              handleUpdateOrganizationHead(
                                'organization_divisions',
                                division.id,
                                event.target.value,
                              )
                            }
                          >
                            <option value="">미지정</option>
                            {adminUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} · {user.position ?? '직급 없음'}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() =>
                            handleDeleteOrganizationUnit(
                              'organization_divisions',
                              division.id,
                            )
                          }
                          aria-label="본부 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {getTeamsForDivision(division.id).length === 0 ? (
                        <span className="organization-empty">팀 없음</span>
                      ) : (
                        getTeamsForDivision(division.id).map((team) => (
                          <div className="organization-team" key={team.id}>
                            <div className="organization-team-title">
                              <div>
                                <span>{team.name}</span>
                                <small>
                                  팀장 {getUserName(team.head_user_id) || '미지정'}
                                </small>
                              </div>
                              <label className="organization-head-select">
                                팀장
                                <select
                                  value={team.head_user_id ?? ''}
                                  onChange={(event) =>
                                    handleUpdateOrganizationHead(
                                      'organization_teams',
                                      team.id,
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="">미지정</option>
                                  {adminUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.name} · {user.position ?? '직급 없음'}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="icon-button danger"
                                onClick={() =>
                                  handleDeleteOrganizationUnit(
                                    'organization_teams',
                                    team.id,
                                  )
                                }
                                aria-label="팀 삭제"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                            <div className="organization-part-list">
                              {getPartsForTeam(team.id).length === 0 ? (
                                <small>파트 없음</small>
                              ) : (
                                getPartsForTeam(team.id).map((part) => (
                                  <span key={part.id}>
                                    <strong>{part.name}</strong>
                                    <em>
                                      파트장 {getUserName(part.head_user_id) || '미지정'}
                                    </em>
                                    <select
                                      value={part.head_user_id ?? ''}
                                      onChange={(event) =>
                                        handleUpdateOrganizationHead(
                                          'organization_parts',
                                          part.id,
                                          event.target.value,
                                        )
                                      }
                                      aria-label={`${part.name} 파트장`}
                                    >
                                      <option value="">미지정</option>
                                      {adminUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {user.name} · {user.position ?? '직급 없음'}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="icon-button danger"
                                      onClick={() =>
                                        handleDeleteOrganizationUnit(
                                          'organization_parts',
                                          part.id,
                                        )
                                      }
                                      aria-label="파트 삭제"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
            <div className="form-grid settings-grid">
              <div className="range-line settings-work-range">
                <span className="range-title">기본근무</span>
                <TimeBox
                  value={settingsForm.defaultRegularStart}
                  onChange={(value) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultRegularStart: value,
                    })
                  }
                />
                <span>부터</span>
                <TimeBox
                  value={settingsForm.defaultRegularEnd}
                  onChange={(value) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultRegularEnd: value,
                    })
                  }
                />
                <span>까지</span>
                <strong>{formatMinutes(defaultRegularMinutes)}</strong>
              </div>
              <label className="settings-break-field">
                반차 기준 휴게시간(분)
                <input
                  inputMode="numeric"
                  value={settingsForm.defaultBreakMinutes}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultBreakMinutes: digitsOnly(event.target.value),
                    })
                  }
                />
              </label>
              <label className="settings-half">
                고정 연장근로시간
                <input
                  inputMode="decimal"
                  value={settingsForm.monthlyInclusiveOvertimeHours}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      monthlyInclusiveOvertimeHours: decimalNumberOnly(
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="52.14"
                />
              </label>
              <label className="settings-half">
                고정 휴일근로시간
                <input
                  inputMode="decimal"
                  value={settingsForm.monthlyInclusiveHolidayHours}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      monthlyInclusiveHolidayHours: decimalNumberOnly(
                        event.target.value,
                      ),
                    })
                  }
                  placeholder="13.33"
                />
              </label>
              <label className="settings-half">
                주휴일
                <select
                  value={settingsForm.weeklyHolidayDay}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      weeklyHolidayDay: event.target.value,
                    })
                  }
                >
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-half">
                토요일 처리
                <select
                  value={settingsForm.saturdayPolicy}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      saturdayPolicy: event.target.value,
                    })
                  }
                >
                  <option value="offday">휴무일</option>
                  <option value="holiday">휴일</option>
                </select>
              </label>
              <label className="settings-half">
                월 비과세 급여
                <div className="money-input">
                  <span>₩</span>
                  <input
                    inputMode="numeric"
                    value={formatNumber(settingsForm.monthlyNonTaxablePay)}
                    onChange={(event) =>
                      setSettingsForm({
                        ...settingsForm,
                        monthlyNonTaxablePay: digitsOnly(event.target.value),
                      })
                    }
                  />
                </div>
              </label>
              <label className="settings-half">
                국민연금 요율(%)
                <input
                  inputMode="decimal"
                  value={settingsForm.pensionRate}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      pensionRate: decimalNumberOnly(event.target.value),
                    })
                  }
                />
              </label>
              <label className="settings-half">
                건강보험 요율(%)
                <input
                  inputMode="decimal"
                  value={settingsForm.healthInsuranceRate}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      healthInsuranceRate: decimalNumberOnly(event.target.value),
                    })
                  }
                />
              </label>
              <label className="settings-half">
                장기요양 요율(%)
                <input
                  inputMode="decimal"
                  value={settingsForm.longTermCareRate}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      longTermCareRate: decimalNumberOnly(event.target.value),
                    })
                  }
                />
              </label>
              <label className="settings-half">
                고용보험 요율(%)
                <input
                  inputMode="decimal"
                  value={settingsForm.employmentInsuranceRate}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      employmentInsuranceRate: decimalNumberOnly(
                        event.target.value,
                      ),
                    })
                  }
                />
              </label>
              <label className="settings-half">
                지방소득세율(%)
                <input
                  inputMode="decimal"
                  value={settingsForm.localIncomeTaxRate}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      localIncomeTaxRate: decimalNumberOnly(event.target.value),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="secondary-button settings-half"
                onClick={() => {
                  setHolidayForm({
                    date: `${selectedYear}-${selectedMonth}-01`,
                    name: '',
                    isSubstitute: false,
                  })
                  setIsHolidayModalOpen(true)
                }}
              >
                <CalendarDays size={18} />
                월별 휴일설정
              </button>
              <button type="submit" className="primary-button">
                <Save size={18} />
                설정 저장
              </button>
            </div>
            {settingsMessage && <p className="message">{settingsMessage}</p>}
          </form>
          {isHolidayModalOpen && (
            <div
              className="modal-backdrop"
              onClick={() => setIsHolidayModalOpen(false)}
            >
              <section
                className="holiday-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="section-title">
                    <CalendarDays size={20} />
                    <h3>월별 휴일설정</h3>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setIsHolidayModalOpen(false)}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>
                <form
                  className="holiday-form"
                  onSubmit={handleSaveMonthlyHoliday}
                >
                  <label>
                    일자
                    <input
                      type="date"
                      value={holidayForm.date}
                      onChange={(event) =>
                        setHolidayForm({
                          ...holidayForm,
                          date: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    휴일명
                    <input
                      value={holidayForm.name}
                      onChange={(event) =>
                        setHolidayForm({
                          ...holidayForm,
                          name: event.target.value,
                        })
                      }
                      placeholder="부처님오신날"
                    />
                  </label>
                  <label className="inline-check holiday-substitute-check">
                    <input
                      type="checkbox"
                      checked={holidayForm.isSubstitute}
                      onChange={(event) =>
                        setHolidayForm({
                          ...holidayForm,
                          isSubstitute: event.target.checked,
                        })
                      }
                    />
                    대체공휴일
                  </label>
                  <button type="submit" className="primary-button">
                    <Save size={18} />
                    휴일 저장
                  </button>
                </form>
                <div className="holiday-list">
                  {customHolidays.length === 0 ? (
                    <p>등록된 월별 휴일이 없습니다.</p>
                  ) : (
                    customHolidays.map((holiday) => (
                      <article className="holiday-item" key={holiday.id}>
                        <div>
                          <strong>
                            {formatWorkDateWithWeekday(holiday.holiday_date)}
                          </strong>
                          <span>{getCustomHolidayDisplayName(holiday)}</span>
                        </div>
                        <button
                          type="button"
                          className="icon-button danger-button"
                          onClick={() => handleDeleteMonthlyHoliday(holiday.id)}
                          aria-label="휴일 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </section>
      ) : activePage === 'organization' ? (
        <section className="organization-chart-section">
          <div className="history-top">
            <div className="section-title">
              <Users size={20} />
              <h2>조직 관리</h2>
            </div>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setIsOrganizationModalOpen(true)}
            >
              <Settings size={16} />
              조직 설정
            </button>
          </div>
          {isOrganizationModalOpen && (
            <div
              className="modal-backdrop"
              onClick={() => setIsOrganizationModalOpen(false)}
            >
              <section
                className="holiday-modal organization-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="section-title">
                    <Users size={20} />
                    <h3>조직 설정</h3>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setIsOrganizationModalOpen(false)}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>
                <section className="organization-manager in-modal">
                  <div className="organization-create-tabs">
                    {[
                      { mode: 'division' as const, label: '본부 추가' },
                      { mode: 'team' as const, label: '팀 추가' },
                      { mode: 'part' as const, label: '파트 추가' },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        className={
                          organizationCreateMode === item.mode
                            ? 'primary-button compact-button'
                            : 'secondary-button compact-button'
                        }
                        onClick={() =>
                          setOrganizationCreateMode((currentMode) =>
                            currentMode === item.mode ? null : item.mode,
                          )
                        }
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {organizationCreateMode && (
                    <div className="organization-create-grid">
                      {organizationCreateMode === 'division' && (
                        <div className="organization-create-row">
                          <strong>본부</strong>
                          <input
                            value={organizationForm.divisionName}
                            onChange={(event) =>
                              setOrganizationForm({
                                ...organizationForm,
                                divisionName: event.target.value,
                              })
                            }
                            placeholder="예: 개발본부"
                          />
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={handleCreateDivision}
                          >
                            추가
                          </button>
                        </div>
                      )}
                      {organizationCreateMode === 'team' && (
                        <div className="organization-create-row has-select">
                          <strong>팀</strong>
                          <select
                            value={organizationForm.teamDivisionId}
                            onChange={(event) =>
                              setOrganizationForm({
                                ...organizationForm,
                                teamDivisionId: event.target.value,
                              })
                            }
                          >
                            <option value="">본부 선택</option>
                            {organizationDivisions.map((division) => (
                              <option key={division.id} value={division.id}>
                                {division.name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={organizationForm.teamName}
                            onChange={(event) =>
                              setOrganizationForm({
                                ...organizationForm,
                                teamName: event.target.value,
                              })
                            }
                            placeholder="예: 플랫폼팀"
                          />
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => handleCreateTeam()}
                          >
                            추가
                          </button>
                        </div>
                      )}
                      {organizationCreateMode === 'part' && (
                        <div className="organization-create-row has-select">
                          <strong>파트</strong>
                          <select
                            value={organizationForm.partTeamId}
                            onChange={(event) =>
                              setOrganizationForm({
                                ...organizationForm,
                                partTeamId: event.target.value,
                              })
                            }
                          >
                            <option value="">팀 선택</option>
                            {organizationTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {getDivisionName(team.division_id)} / {team.name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={organizationForm.partName}
                            onChange={(event) =>
                              setOrganizationForm({
                                ...organizationForm,
                                partName: event.target.value,
                              })
                            }
                            placeholder="예: 프론트파트"
                          />
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => handleCreatePart()}
                          >
                            추가
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="organization-list">
                    {organizationDivisions.length === 0 ? (
                      <p className="empty-state">등록된 조직이 없습니다.</p>
                    ) : (
                      organizationDivisions.map((division) => (
                        <details className="organization-tree-item" key={division.id}>
                          <summary>
                            <span>{division.name}</span>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={(event) => {
                                event.preventDefault()
                                handleDeleteOrganizationUnit(
                                  'organization_divisions',
                                  division.id,
                                )
                              }}
                              aria-label="본부 삭제"
                            >
                              <Trash2 size={15} />
                            </button>
                          </summary>
                          <div className="organization-tree-children">
                            {getTeamsForDivision(division.id).length === 0 ? (
                              <small>팀 없음</small>
                            ) : (
                              getTeamsForDivision(division.id).map((team) => (
                                <details className="organization-tree-item team" key={team.id}>
                                  <summary>
                                    <span>{team.name}</span>
                                    <button
                                      type="button"
                                      className="icon-button danger"
                                      onClick={(event) => {
                                        event.preventDefault()
                                        handleDeleteOrganizationUnit(
                                          'organization_teams',
                                          team.id,
                                        )
                                      }}
                                      aria-label="팀 삭제"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </summary>
                                  <div className="organization-tree-children part">
                                    {getPartsForTeam(team.id).length === 0 ? (
                                      <small>파트 없음</small>
                                    ) : (
                                      getPartsForTeam(team.id).map((part) => (
                                        <div className="organization-tree-leaf" key={part.id}>
                                          <span>{part.name}</span>
                                          <button
                                            type="button"
                                            className="icon-button danger"
                                            onClick={() =>
                                              handleDeleteOrganizationUnit(
                                                'organization_parts',
                                                part.id,
                                              )
                                            }
                                            aria-label="파트 삭제"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </details>
                              ))
                            )}
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                </section>
              </section>
            </div>
          )}
          {organizationUserEditor && (
            <div
              className="modal-backdrop"
              onClick={() => setOrganizationUserEditor(null)}
            >
              <section
                className="holiday-modal user-organization-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="section-title">
                    <UserRound size={20} />
                    <h3>소속 변경</h3>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setOrganizationUserEditor(null)}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>
                <div className="selected-user-summary">
                  <strong>
                    {organizationUserEditor.name} ·{' '}
                    {organizationUserEditor.position ?? '직급 없음'}
                  </strong>
                  <span>{organizationUserEditor.email}</span>
                </div>
                <div className="form-grid settings-grid">
                  <label className="settings-half">
                    본부
                    <select
                      value={organizationEditorDraft.divisionId}
                      onChange={(event) =>
                        setAdminUserOrgDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [organizationUserEditor.id]: {
                            divisionId: event.target.value,
                            teamId: '',
                            partId: '',
                          },
                        }))
                      }
                    >
                      <option value="">본부 미지정</option>
                      {organizationDivisions.map((division) => (
                        <option key={division.id} value={division.id}>
                          {division.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-half">
                    팀
                    <select
                      value={organizationEditorDraft.teamId}
                      disabled={!organizationEditorDraft.divisionId}
                      onChange={(event) =>
                        setAdminUserOrgDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [organizationUserEditor.id]: {
                            ...organizationEditorDraft,
                            teamId: event.target.value,
                            partId: '',
                          },
                        }))
                      }
                    >
                      <option value="">팀 미지정</option>
                      {organizationEditorTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-half">
                    파트
                    <select
                      value={organizationEditorDraft.partId}
                      disabled={!organizationEditorDraft.teamId}
                      onChange={(event) =>
                        setAdminUserOrgDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [organizationUserEditor.id]: {
                            ...organizationEditorDraft,
                            partId: event.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">파트 미지정</option>
                      {organizationEditorParts.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="primary-button settings-half"
                    onClick={() =>
                      handleSaveAdminUserOrganization(organizationUserEditor)
                    }
                  >
                    <Save size={18} />
                    소속 저장
                  </button>
                </div>
              </section>
            </div>
          )}
          {organizationHeadEditor && (
            <div
              className="modal-backdrop"
              onClick={() => setOrganizationHeadEditor(null)}
            >
              <section
                className="holiday-modal user-organization-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="section-title">
                    <Users size={20} />
                    <h3>{organizationHeadEditor.roleLabel} 지정</h3>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setOrganizationHeadEditor(null)}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>
                <div className="selected-user-summary">
                  <strong>{organizationHeadEditor.title}</strong>
                  <span>
                    현재 {organizationHeadEditor.roleLabel}{' '}
                    {getUserName(organizationHeadEditor.headUserId) || '미지정'}
                  </span>
                </div>
                <label>
                  {organizationHeadEditor.roleLabel}
                  <select
                    value={organizationHeadEditor.headUserId ?? ''}
                    onChange={(event) =>
                      setOrganizationHeadEditor({
                        ...organizationHeadEditor,
                        headUserId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">미지정</option>
                    {adminUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} · {user.position ?? '직급 없음'}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    handleUpdateOrganizationHead(
                      organizationHeadEditor.tableName,
                      organizationHeadEditor.id,
                      organizationHeadEditor.headUserId ?? '',
                    )
                  }
                >
                  <Save size={18} />
                  저장
                </button>
              </section>
            </div>
          )}
          {organizationDivisions.length === 0 ? (
            <p className="empty-state">등록된 조직이 없습니다.</p>
          ) : (
            <div className="organization-chart">
              <article className="org-tree company-tree">
                <div className="org-tree-level root-level">
                  <div className="org-node ceo-node">
                    <span>CEOㆍ대표이사</span>
                    <strong>강태영</strong>
                  </div>
                </div>
                <div className="org-exec-row">
                  {[
                    { role: 'CTOㆍ이사', name: '백상민' },
                    { role: 'CSOㆍ전무이사', name: '정의민' },
                    { role: 'CIOㆍ이사', name: '박도형' },
                  ].map((executive) => (
                    <div className="org-node executive-node" key={executive.role}>
                      <span>{executive.role}</span>
                      <strong>{executive.name}</strong>
                    </div>
                  ))}
                </div>
                <div className="org-tree-branches division-branches">
                  {organizationDivisions.map((division) => (
                    <section className="org-tree-division" key={division.id}>
                      <button
                        type="button"
                        className="org-node division-node"
                        onClick={() =>
                          setOrganizationHeadEditor({
                            tableName: 'organization_divisions',
                            id: division.id,
                            title: division.name,
                            roleLabel: '본부장',
                            headUserId: division.head_user_id,
                          })
                        }
                      >
                        <span>본부</span>
                        <strong>{division.name}</strong>
                        <em>{getUserName(division.head_user_id) || '본부장 미지정'}</em>
                      </button>
                      {getDivisionUsers(division).length > 0 && (
                        <div className="org-member-row division-members">
                          {getDivisionUsers(division).map((user) => (
                            <button
                              type="button"
                              key={user.id}
                              onClick={() => setOrganizationUserEditor(user)}
                            >
                              {renderUserLabel(user)}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="org-tree-branches team-branches">
                        {getTeamsForDivision(division.id).length === 0 ? (
                          <p className="organization-empty">등록된 팀이 없습니다.</p>
                        ) : (
                          getTeamsForDivision(division.id).map((team) => (
                            <section className="org-tree-team" key={team.id}>
                              <button
                                type="button"
                                className="org-node team-node"
                                onClick={() =>
                                  setOrganizationHeadEditor({
                                    tableName: 'organization_teams',
                                    id: team.id,
                                    title: `${division.name} / ${team.name}`,
                                    roleLabel: '팀장',
                                    headUserId: team.head_user_id,
                                  })
                                }
                              >
                                <span>팀</span>
                                <strong>{team.name}</strong>
                                <em>{getUserName(team.head_user_id) || '팀장 미지정'}</em>
                              </button>
                              {getTeamUsers(team).length > 0 && (
                                <div className="org-member-row">
                                  {getTeamUsers(team).map((user) => (
                                    <button
                                      type="button"
                                      key={user.id}
                                      onClick={() => setOrganizationUserEditor(user)}
                                    >
                                      {renderUserLabel(user)}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="org-tree-parts">
                                {getPartsForTeam(team.id).map((part) => (
                                  <section className="org-tree-part" key={part.id}>
                                    <button
                                      type="button"
                                      className="org-node part-node"
                                      onClick={() =>
                                        setOrganizationHeadEditor({
                                          tableName: 'organization_parts',
                                          id: part.id,
                                          title: `${division.name} / ${team.name} / ${part.name}`,
                                          roleLabel: '파트장',
                                          headUserId: part.head_user_id,
                                        })
                                      }
                                    >
                                      <span>파트</span>
                                      <strong>{part.name}</strong>
                                      <em>
                                        {getUserName(part.head_user_id) || '파트장 미지정'}
                                      </em>
                                    </button>
                                    {getPartUsers(part).length > 0 ? (
                                      <div className="org-member-column">
                                        {getPartUsers(part).map((user) => (
                                          <button
                                            type="button"
                                            key={user.id}
                                            onClick={() => setOrganizationUserEditor(user)}
                                          >
                                            {renderUserLabel(user)}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                  </section>
                                ))}
                              </div>
                            </section>
                          ))
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
              {unassignedOrganizationUsers.length > 0 && (
                <article className="org-tree unassigned">
                  <div className="org-node unassigned-node">
                    <span>미지정</span>
                    <strong>조직 미지정</strong>
                  </div>
                  <div className="org-member-row">
                    {unassignedOrganizationUsers.map((user) => (
                      <button
                        type="button"
                        key={user.id}
                        onClick={() => setOrganizationUserEditor(user)}
                      >
                        {renderUserLabel(user)}
                      </button>
                    ))}
                  </div>
                </article>
              )}
            </div>
          )}
        </section>
      ) : activePage === 'calendar' ? (
        <section className="calendar-section">
          <div className="history-top">
            <div className="section-title">
              <Grid3X3 size={20} />
              <h2>워킹캘린더</h2>
            </div>
            <div className="month-picker" aria-label="워킹캘린더 조회 월">
              <select
                value={selectedYear}
                onChange={(event) => {
                  clearWorkLogEditState()
                  setSelectedYear(event.target.value)
                }}
              >
                {yearOptions.map((year) => (
                  <option
                    key={year}
                    value={year}
                    disabled={year > Number(currentYear)}
                  >
                    {year}년
                  </option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(event) => {
                  clearWorkLogEditState()
                  setSelectedMonth(event.target.value)
                }}
              >
                {Array.from({ length: 12 }, (_, index) => {
                  const month = String(index + 1).padStart(2, '0')
                  const isFutureMonth =
                    Number(selectedYear) === Number(currentYear) &&
                    Number(month) > Number(currentMonth)

                  return (
                    <option key={month} value={month} disabled={isFutureMonth}>
                      {Number(month)}월
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                className="secondary-button compact-download-button"
                onClick={handleDownloadMyWorkLog}
              >
                <Download size={16} />
                엑셀 다운로드
              </button>
            </div>
          </div>
          {calendarMessage && <p className="message">{calendarMessage}</p>}
          <div className="calendar-total">
            <span>
              {Number(selectedYear)}년 {Number(selectedMonth)}월 총급여(세전)
            </span>
            <strong>{formatCurrency(monthlyTotal)}</strong>
          </div>
          <div className="working-calendar">
            {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
              <div className="calendar-weekday" key={weekday}>
                {weekday}
              </div>
            ))}
            {Array.from({ length: calendarLeadingBlankCount }, (_, index) => (
              <div
                className="calendar-day blank"
                key={`blank-${selectedYear}-${selectedMonth}-${index}`}
              />
            ))}
            {calendarDays.map((day) => {
              const isBeforeHire = isDateBeforeHireDate(
                day.date,
                workTargetHireDate,
              )
              const isHireDate = workTargetHireDate === day.date
              const log = isBeforeHire ? undefined : logsByDate.get(day.date)
              const paidHoliday = isBeforeHire
                ? undefined
                : paidHolidaysByDate.get(day.date)
              const hasLeave = Boolean(
                log?.leave_type && log.leave_type !== 'none',
              )
              const isHolidayDate = Boolean(
                log?.is_holiday || paidHoliday || paidHolidayNames.has(day.date),
              )
              const weekdayClass =
                day.weekday === 0
                  ? 'sunday'
                  : day.weekday === 6
                    ? 'saturday'
                    : ''

              return (
                <div
                  className={`calendar-day ${weekdayClass} ${
                    isHolidayDate ? 'holiday-date' : ''
                  } ${isBeforeHire ? 'pre-hire-date' : ''} ${
                    isHireDate ? 'hire-date' : ''
                  } ${
                    hasLeave
                      ? 'has-leave'
                      : log
                        ? 'has-log'
                        : paidHoliday
                          ? 'paid-holiday'
                          : ''
                  }`}
                  key={day.date}
                >
                  <div className="calendar-date-row">
                    <strong>{day.day}</strong>
                    {isBeforeHire && <span>입사 전</span>}
                    {isHireDate && <span>입사일</span>}
                    {log?.is_holiday && <span>휴일</span>}
                    {log?.leave_type && log.leave_type !== 'none' && (
                      <span>{getLeaveLabel(log.leave_type)}</span>
                    )}
                    {paidHoliday && <span>유급휴일</span>}
                  </div>
                  {isBeforeHire ? (
                    <p>산정 제외</p>
                  ) : log ? (
                    <div className="calendar-work-card">
                      <span>
                        {log.leave_type === 'full'
                          ? getLeaveLabel(log.leave_type)
                          : `${formatCalendarTime(
                              log,
                              log.office_clock_in,
                            )} ~ ${formatCalendarTime(log, log.office_clock_out)}`}
                      </span>
                      <small className={getCalendarPayClass(log.total_pay)}>
                        {formatCurrency(log.total_pay)}
                      </small>
                    </div>
                  ) : paidHoliday ? (
                    <div className="calendar-work-card">
                      <span>{paidHoliday.name}</span>
                      <small className={getCalendarPayClass(paidHoliday.totalPay)}>
                        {formatCurrency(paidHoliday.totalPay)}
                      </small>
                    </div>
                  ) : isHireDate ? (
                    <p>입사일</p>
                  ) : (
                    <p>기록 없음</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <>
        <section className="workbench">
        <form className="input-panel" onSubmit={handleSave}>
          <div className="section-title work-title">
            <div>
              <Clock size={20} />
              <h2>
                근무 입력
                {selectedAdminUser && (
                  <span className="title-user-name">
                    ({selectedAdminUser.name} {selectedAdminUser.position ?? '직급 없음'})
                  </span>
                )}
              </h2>
            </div>
            {isAdmin && selectedAdminUser && (
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => {
                  setActivePage('users')
                }}
              >
                <Users size={16} />
                사용자목록
              </button>
            )}
          </div>

          <div className="form-grid">
            <label className="date-field">
              근무일
              <input
                type="date"
                value={form.workDate}
                min={workTargetHireDate || undefined}
                onChange={(event) => {
                  const nextWorkDate = event.target.value

                  setSelectedHolidayName(null)
                  setForm({
                    ...form,
                    workDate: nextWorkDate,
                    isHoliday: false,
                  })
                }}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.isHoliday}
                onChange={(event) =>
                  setForm({ ...form, isHoliday: event.target.checked })
                }
              />
              휴일 근무
              {selectedHolidayName && (
                <span className="holiday-chip">{selectedHolidayName}</span>
              )}
              <span className="tooltip-wrap">
                <Info size={15} />
                <span className="tooltip-box" role="tooltip">
                  휴일은 주휴일, 공휴일·대체공휴일, 근로자의 날, 회사 취업규칙이나
                  근로계약에서 정한 휴일에 일한 경우를 기준으로 체크합니다.
                </span>
              </span>
            </label>
            <label className="leave-field">
              휴가
              <select
                value={form.leaveType}
                onChange={(event) => {
                  const leaveType = event.target.value as LeaveType
                  const nextRange = getWorkRangeForLeaveType(
                    leaveType,
                    settingsForm.defaultRegularStart,
                    settingsForm.defaultRegularEnd,
                    Number(settingsForm.defaultBreakMinutes) || 0,
                  )

                  setForm({
                    ...form,
                    leaveType,
                    ...(nextRange ?? {}),
                    noCommute: leaveType === 'full' ? true : form.noCommute,
                  })
                }}
              >
                {leaveOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="range-line work-range">
              <span className="range-title">근무시간</span>
              <TimeBox
                value={form.workStart}
                onChange={(value) => setForm({ ...form, workStart: value })}
                disabled={form.leaveType === 'full'}
              />
              <span>부터</span>
              <TimeBox
                value={form.workEnd}
                onChange={(value) => setForm({ ...form, workEnd: value })}
                disabled={form.leaveType === 'full'}
              />
              <span>까지</span>
              {isNextDayWorkEnd && <span className="next-day-chip">다음날</span>}
              <strong>{formatMinutes(grossWorkMinutes)}</strong>
            </div>
            <div className="range-line commute-range">
              <span className="range-title">이동시간</span>
              <TimeBox
                value={form.commuteStart}
                onChange={(value) => setForm({ ...form, commuteStart: value })}
                disabled={form.noCommute || form.leaveType === 'full'}
              />
              <span>부터</span>
              <TimeBox
                value={form.commuteEnd}
                onChange={(value) => setForm({ ...form, commuteEnd: value })}
                disabled={form.noCommute || form.leaveType === 'full'}
              />
              <span>까지</span>
              {isNextDayCommuteEnd && <span className="next-day-chip">다음날</span>}
              <strong>{formatMinutes(commuteMinutes)}</strong>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={form.noCommute}
                  onChange={(event) =>
                    setForm({ ...form, noCommute: event.target.checked })
                  }
                  disabled={form.leaveType === 'full'}
                />
                이동시간 없음
              </label>
            </div>
            <label className="overtime-reason-field">
              연장근무 사유
              <textarea
                value={form.overtimeReason}
                onChange={(event) =>
                  setForm({ ...form, overtimeReason: event.target.value })
                }
                placeholder="연장근무가 발생한 경우 사유를 입력하세요."
                rows={3}
              />
            </label>
          </div>

          {editingWorkLog && (
            <p className="edit-mode-message">
              <Pencil size={16} />
              {formatWorkDateWithWeekday(editingWorkLog.work_date)} 근무기록 수정 중
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={
                hasSavedWorkLogForSelectedDate || isSelectedWorkDateBeforeHire
              }
            >
              <Save size={18} />
              {isSelectedWorkDateBeforeHire
                ? '입사 전 날짜'
                : hasSavedWorkLogForSelectedDate
                  ? '이미 저장된 근무일'
                  : editingWorkLogId
                    ? '근무기록 수정'
                    : '근무기록 저장'}
            </button>
            {editingWorkLogId && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancelWorkLogEdit}
              >
                <X size={17} />
                수정 취소
              </button>
            )}
          </div>
          {isSelectedWorkDateBeforeHire && (
            <p className="message warning-message">
              입사일자 이전 날짜는 급여 산정과 근무 저장에서 제외됩니다.
            </p>
          )}
          {hasSavedWorkLogForSelectedDate && (
            <p className="message warning-message">
              이미 입력된 근무일입니다. 다른 날짜를 선택해주세요.
            </p>
          )}
          {saveMessage && <p className="message">{saveMessage}</p>}
        </form>

        <aside className="result-panel">
          <div className="section-title">
            <Calculator size={20} />
            <h2>계산 결과</h2>
          </div>
          <div className="result-rate">
            <span>통상시급</span>
            <strong>{formatCurrency(standardHourlyWage)}</strong>
          </div>
          <ResultRows
            calculation={calculation}
            commuteMinutes={commuteMinutes}
            breakMinutes={breakMinutes}
            leaveMinutes={leaveMinutes}
          />
          <div className="total-box">
            <span className="total-label">
              예상 일급
              <span className="tooltip-wrap" tabIndex={0}>
                <Info size={15} />
                <span className="tooltip-box" role="tooltip">
                  하루 기준 세전 예상액입니다. 사업장 조건, 취업규칙, 세금 및
                  4대보험은 포함하지 않았습니다.
                </span>
              </span>
            </span>
            <strong>{formatCurrency(dailyTotalPay)}</strong>
          </div>
        </aside>
      </section>

      <section className="history-section">
        <div className="history-top">
          <div className="section-title">
            <CalendarDays size={20} />
            <h2>월별 근무기록</h2>
          </div>
          <div className="month-picker" aria-label="근무기록 조회 월">
            <select
              value={selectedYear}
              onChange={(event) => {
                clearWorkLogEditState()
                setSelectedYear(event.target.value)
              }}
            >
              {yearOptions.map((year) => (
                <option
                  key={year}
                  value={year}
                  disabled={year > Number(currentYear)}
                >
                  {year}년
                </option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(event) => {
                clearWorkLogEditState()
                setSelectedMonth(event.target.value)
              }}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, '0')
                const isFutureMonth =
                  Number(selectedYear) === Number(currentYear) &&
                  Number(month) > Number(currentMonth)

                return (
                  <option key={month} value={month} disabled={isFutureMonth}>
                    {Number(month)}월
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        <div className="month-summary-grid">
          <div className="month-total">
            <span>{selectedYear}년 {Number(selectedMonth)}월 예상 임금</span>
            <strong>{formatCurrency(monthlyTotal)}</strong>
          </div>
          <div className="month-total compact">
            <span>기본급 추정</span>
            <strong>{formatCurrency(contractBasePay)}</strong>
          </div>
        </div>
        <div className="allowance-grid">
          <article className="allowance-card">
            <div className="summary-card-header">
              <span>고정 연장 수당</span>
              <strong>{formatCurrency(fixedAllowancePayTotal)}</strong>
            </div>
            <dl className="summary-lines">
              <div>
                <dt>고정 연장 · {formatAllowanceHours(fixedOvertimeMinutes)}</dt>
                <dd>{formatCurrency(fixedOvertimePay)}</dd>
              </div>
              <div>
                <dt>고정 휴일 · {formatAllowanceHours(fixedHolidayMinutes)}</dt>
                <dd>{formatCurrency(fixedHolidayPay)}</dd>
              </div>
            </dl>
          </article>
          <article className="allowance-card additional">
            <div className="summary-card-header">
              <span>추가 수당</span>
              <strong>{formatCurrency(additionalPayTotal)}</strong>
            </div>
            <dl className="summary-lines">
              <div>
                <dt>추가 연장 · {formatAllowanceHours(additionalOvertimeMinutes)}</dt>
                <dd>{formatCurrency(additionalOvertimePay)}</dd>
              </div>
              <div>
                <dt>추가 야간 · {formatAllowanceHours(additionalNightMinutes)}</dt>
                <dd>{formatCurrency(additionalNightPay)}</dd>
              </div>
              <div>
                <dt>추가 휴일 · {formatAllowanceHours(additionalHolidayMinutes)}</dt>
                <dd>{formatCurrency(additionalHolidayPay)}</dd>
              </div>
              <div>
                <dt>
                  추가 휴일연장 · {formatAllowanceHours(
                    additionalHolidayOvertimeMinutes,
                  )}
                </dt>
                <dd>{formatCurrency(additionalHolidayOvertimePay)}</dd>
              </div>
            </dl>
          </article>
        </div>
        <article className="tax-summary-card">
          <div className="summary-card-header">
            <span>세금·공제</span>
            <strong>{formatCurrency(monthlyDeductions)}</strong>
          </div>
          <dl className="summary-lines tax-lines">
            <div>
              <dt>공제 계산 기준액</dt>
              <dd>{formatCurrency(monthlyTaxablePay)}</dd>
            </div>
            <div>
              <dt>4대보험 합계</dt>
              <dd>{formatCurrency(monthlyInsurance.total)}</dd>
            </div>
            <div>
              <dt>소득세·지방소득세</dt>
              <dd>{formatCurrency(monthlyTaxTotal)}</dd>
            </div>
            <div className="net-line">
              <dt>예상 실수령</dt>
              <dd>{formatCurrency(monthlyNetPay)}</dd>
            </div>
          </dl>
          <p className="summary-note">
            4대보험은 근로자 부담분, 세금은 1인 기준 추정치입니다. 산재보험은
            사업주 부담이며, 부양가족·자녀·비과세 급여에 따라 실제 공제액은
            달라질 수 있습니다.
          </p>
        </article>
        <div className="history-list">
          {monthlyRows.length === 0 ? (
            <p className="empty-state">선택한 월에 저장된 근무기록이 없습니다.</p>
          ) : (
            <>
              <div className="history-head">
                <span>근무일</span>
                <span>일일 근무시간</span>
                <span>연장근로</span>
                <span>야간근로</span>
                <span>휴일근로</span>
                <span>예상 일급</span>
                <span>메모</span>
                <span></span>
              </div>
              {monthlyRows.map(({ date, log, holiday }) => {
                if (holiday) {
                  return (
                    <article className="log-row paid-holiday-row" key={date}>
                      <div className="history-date">
                        <strong className="holiday-date-text">
                          {formatWorkDateWithWeekday(date)}
                        </strong>
                        <span className="status-chip">
                          {getMonthlyDayStatus(date)}
                        </span>
                      </div>
                      <span>{formatMinutes(holiday.paidMinutes)}</span>
                      <span>0분</span>
                      <span>0분</span>
                      <span>유급휴일 · {holiday.name}</span>
                      <strong>{formatCurrency(holiday.totalPay)}</strong>
                      <p className="log-memo muted">메모 없음</p>
                      <span></span>
                    </article>
                  )
                }

                if (!log) {
                  return null
                }

                return (
                  <article
                    className={`log-row ${
                      editingWorkLogId === log.id ? 'is-editing' : ''
                    }`}
                    key={log.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleEditLog(log)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleEditLog(log)
                      }
                    }}
                    aria-label={`${formatWorkDateWithWeekday(
                      log.work_date,
                    )} 근무기록 수정`}
                  >
                    <div className="history-date">
                      <strong
                        className={
                          isMonthlyHolidayDate(log.work_date, log)
                            ? 'holiday-date-text'
                            : ''
                        }
                      >
                        {formatWorkDateWithWeekday(log.work_date)}
                      </strong>
                      <span
                        className={
                          isMonthlyHolidayDate(log.work_date, log)
                            ? 'status-chip holiday-status-chip'
                            : 'status-chip'
                        }
                      >
                        {getMonthlyDayStatus(log.work_date, log)}
                      </span>
                    </div>
                    <span>{formatMinutes(log.regular_minutes + log.overtime_minutes + log.holiday_minutes + (log.leave_minutes || 0))}</span>
                    <span>{formatMinutes(log.overtime_minutes)}</span>
                    <span>{formatMinutes(log.night_minutes)}</span>
                    <span>
                      {log.leave_type && log.leave_type !== 'none'
                        ? getLeaveLabel(log.leave_type)
                        : formatMinutes(log.holiday_minutes)}
                    </span>
                    <strong>{formatCurrency(log.total_pay)}</strong>
                    <p
                      className={`log-memo ${log.overtime_reason ? '' : 'muted'}`}
                      title={log.overtime_reason ?? '메모 없음'}
                    >
                      {log.overtime_reason ?? '메모 없음'}
                    </p>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDelete(log.id)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label={`${formatWorkDateWithWeekday(
                        log.work_date,
                      )} 근무기록 삭제`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                )
              })}
            </>
          )}
        </div>
      </section>
      </>
      )}
    </main>
  )
}

function AuthHeader() {
  return (
    <div className="auth-header">
      <div className="brand-mark">
        <Calculator size={28} />
      </div>
      <h1>WorkSalaryCalculator</h1>
    </div>
  )
}

function TimeBox({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <input
      className="time-box"
      type="time"
      disabled={disabled}
      step="60"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function ResultRows({
  calculation,
  commuteMinutes,
  breakMinutes,
  leaveMinutes,
}: {
  calculation: PayCalculationResult
  commuteMinutes: number
  breakMinutes: number
  leaveMinutes: number
}) {
  return (
    <dl className="result-list">
      <div className="result-row-neutral">
        <dt>총 실근로</dt>
        <dd>{formatMinutes(calculation.totalMinutes)}</dd>
      </div>
      <div className="result-row-deduct">
        <dt>이동시간 제외</dt>
        <dd>
          <Home size={16} />
          {formatMinutes(commuteMinutes)}
        </dd>
      </div>
      <div className="result-row-deduct">
        <dt>휴게시간 제외</dt>
        <dd>{formatMinutes(breakMinutes)}</dd>
      </div>
      <div className="result-row-add">
        <dt>기본근로</dt>
        <dd>{formatMinutes(calculation.regularMinutes)}</dd>
      </div>
      <div className="result-row-add">
        <dt>연장근로</dt>
        <dd>{formatMinutes(calculation.overtimeMinutes)}</dd>
      </div>
      <div className="result-row-add">
        <dt>야간근로</dt>
        <dd>{formatMinutes(calculation.nightMinutes)}</dd>
      </div>
      <div className="result-row-add">
        <dt>휴일근로</dt>
        <dd>{formatMinutes(calculation.holidayMinutes)}</dd>
      </div>
      {leaveMinutes > 0 && (
        <div className="result-row-add">
          <dt>휴가 유급시간</dt>
          <dd>{formatMinutes(leaveMinutes)}</dd>
        </div>
      )}
    </dl>
  )
}

function buildWorkLogPayload(
  userId: string,
  form: WorkForm,
  calculation: PayCalculationResult,
  hourlyWage: number,
  commuteMinutes: number,
  breakMinutes: number,
  leaveMinutes: number,
  leavePay: number,
) {
  return {
    user_id: userId,
    work_date: form.workDate,
    hourly_wage: hourlyWage,
    office_clock_in: toDateTimeLocal(form.workDate, form.workStart),
    office_clock_out: toDateTimeLocal(
      form.workDate,
      form.workEnd,
      form.workStart,
    ),
    remote_clock_in: null,
    remote_clock_out: null,
    commute_minutes: commuteMinutes,
    break_minutes: breakMinutes,
    is_holiday: form.isHoliday,
    regular_minutes: calculation.regularMinutes,
    overtime_minutes: calculation.overtimeMinutes,
    night_minutes: calculation.nightMinutes,
    holiday_minutes: calculation.holidayMinutes,
    leave_type: form.leaveType,
    leave_minutes: leaveMinutes,
    overtime_reason: form.overtimeReason.trim() || null,
    regular_pay: calculation.regularPay,
    overtime_pay: calculation.overtimePay,
    night_pay: calculation.nightPay,
    holiday_pay: calculation.holidayPay,
    leave_pay: leavePay,
    total_pay: calculation.totalPay + leavePay,
  }
}

export default App
