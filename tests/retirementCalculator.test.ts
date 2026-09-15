import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateRetirement,
  estimateAdditionalAllowance,
  getKoreanToday,
  getRetirementPeriods,
} from '../src/retirementCalculator.ts'

test('고용노동부 예제: 직전 3개월은 4개 월에 걸친 92일, 기준일 제외', () => {
  const periods = getRetirementPeriods('2017-09-16')
  assert.deepEqual(
    periods.map(({ start, end, days }) => ({ start, end, days })),
    [
      { start: '2017-06-16', end: '2017-06-30', days: 15 },
      { start: '2017-07-01', end: '2017-07-31', days: 31 },
      { start: '2017-08-01', end: '2017-08-31', days: 31 },
      { start: '2017-09-01', end: '2017-09-15', days: 15 },
    ],
  )
  const result = calculateRetirement({
    hireDate: '2014-10-02',
    referenceDate: '2017-09-16',
    wages: [1180000, 2360000, 2360000, 1180000],
    annualBonus: 4000000,
    annualLeaveAllowance: 300000,
    ordinaryDailyWage: 60000,
  })!
  assert.equal(result.serviceDays, 1080)
  assert.equal(result.periodDays, 92)
  assert.equal(result.averageDailyWage, 8155000 / 92)
  assert.equal(result.bonusAllocation, 1000000)
  assert.equal(result.leaveAllocation, 75000)
  assert.equal(result.grossPay, ((8155000 / 92) * 30 * 1080) / 365)
})

test('월초·연도 경계·말일·윤년의 달력 월 계산', () => {
  assert.equal(getRetirementPeriods('2026-09-01').length, 3)
  assert.equal(getRetirementPeriods('2026-01-15')[0].start, '2025-10-15')
  assert.equal(getRetirementPeriods('2026-05-31')[0].start, '2026-02-28')
  assert.equal(getRetirementPeriods('2024-05-31')[0].start, '2024-02-29')
  assert.equal(
    getRetirementPeriods('2024-04-01').reduce((sum, row) => sum + row.days, 0),
    91,
  )
  assert.deepEqual(getRetirementPeriods('2026-02-30'), [])
  assert.deepEqual(getRetirementPeriods(''), [])
})

test('1일 통상임금 하한 및 재직 1년 경계', () => {
  const input = {
    hireDate: '2025-09-16',
    referenceDate: '2026-09-16',
    wages: [500000, 1000000, 1000000, 500000],
    annualBonus: 0,
    annualLeaveAllowance: 0,
    ordinaryDailyWage: 130000,
  }
  const result = calculateRetirement(input)!
  assert.equal(result.eligible, true)
  assert.equal(result.usesOrdinaryWage, true)
  assert.equal(result.grossPay, 3900000)
  assert.equal(
    calculateRetirement({ ...input, hireDate: '2025-09-17' })!.grossPay,
    0,
  )
  assert.equal(calculateRetirement({ ...input, hireDate: '2026-09-16' }), null)
  assert.equal(calculateRetirement({ ...input, hireDate: '' }), null)
  assert.equal(calculateRetirement({ ...input, annualBonus: -1 }), null)
  assert.equal(calculateRetirement({ ...input, wages: [NaN, 0, 0, 0] }), null)
  assert.equal(calculateRetirement({ ...input, wages: [] }), null)
})

test('추가수당만 합산: 기본급 이중 가산 없이 연장·야간·휴일·연차중근무 반영', () => {
  const log = {
    overtime_minutes: 120,
    night_minutes: 60,
    holiday_minutes: 600,
    regular_minutes: 480,
    leave_type: null,
  }
  assert.equal(
    estimateAdditionalAllowance(log, 10000, 480),
    30000 + 5000 + 120000 + 40000,
  )
  assert.equal(
    estimateAdditionalAllowance(
      { ...log, leave_type: 'full_work' },
      10000,
      480,
    ),
    275000,
  )
})

test('한국 시간 기준 접속일: UTC 자정 전에도 한국 날짜 사용', () => {
  assert.equal(getKoreanToday(new Date('2026-09-15T16:00:00Z')), '2026-09-16')
})
