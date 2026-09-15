import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateInsurance,
  calculatePayrollTax,
  normalizeEmploymentInsuranceRate,
  truncateToTenWon,
} from '../src/payrollDeductions.ts'
import { withholdingTable } from '../src/withholdingTable.ts'

const rates = {
  pensionRate: '4.75', healthInsuranceRate: '3.595',
  longTermCareRate: '13.14', employmentInsuranceRate: '0.9',
}

test('공식 표: 과세월급 9,976,237원과 가족 1명일 때 명세서의 모든 공제액 재현', () => {
  const insurance = calculateInsurance(9_976_237, 5_000_000, rates)
  assert.deepEqual(insurance, {
    pension: 237_500, health: 358_640, longTermCare: 47_120,
    employment: 89_780, total: 733_040, netPay: 9_243_197,
  })
  const tax = calculatePayrollTax(9_976_237, 1, 0, '10')
  assert.deepEqual(tax, { incomeTax: 1_497_170, localIncomeTax: 149_710, total: 1_646_880 })
  assert.equal(9_976_237 - insurance.total - tax.total, 7_596_317)
})

test('본인과 8세 미만 자녀: 가족 2명, 자녀세액공제 0명', () => {
  assert.deepEqual(calculatePayrollTax(9_976_237, 2, 0, '10'), {
    incomeTax: 1_421_380, localIncomeTax: 142_130, total: 1_563_510,
  })
})

test('급여 구간은 이상/미만으로 조회하고, 비과세는 호출 전에 제외', () => {
  assert.equal(calculatePayrollTax(1_059_999, 1, 0, '10').incomeTax, 0)
  assert.equal(calculatePayrollTax(1_060_000, 1, 0, '10').incomeTax, 1040)
  assert.equal(calculatePayrollTax(9_959_999, 1, 0, '10').incomeTax, 1_490_340)
  assert.equal(calculatePayrollTax(9_960_000, 1, 0, '10').incomeTax, 1_497_170)
  assert.equal(calculatePayrollTax(3_700_000 - 200_000, 2, 0, '10').incomeTax, 102_220)
})

test('2026년 만 8~20세 자녀 공제: 20,830원, 45,830원, 이후 33,330원씩', () => {
  assert.equal(calculatePayrollTax(5_000_000, 4, 1, '10').incomeTax, 198_270)
  assert.equal(calculatePayrollTax(5_000_000, 4, 2, '10').incomeTax, 173_270)
  assert.equal(calculatePayrollTax(5_000_000, 4, 3, '10').incomeTax, 139_940)
  assert.equal(calculatePayrollTax(3_500_000, 4, 2, '10').incomeTax, 3510)
  assert.equal(calculatePayrollTax(2_000_000, 3, 2, '10').incomeTax, 0)
})

test('월 천만원 및 초과 구간 공식 산식과 경계', () => {
  const examples = [
    [10_000_000, 1_431_570], [10_000_001, 1_456_570],
    [14_000_000, 2_828_570], [14_000_001, 2_828_570],
    [28_000_000, 8_042_170], [28_000_001, 8_042_170],
    [30_000_000, 8_826_170], [45_000_000, 14_826_170],
    [87_000_000, 32_466_170], [88_000_000, 32_916_170],
  ]
  for (const [pay, tax] of examples) {
    assert.equal(calculatePayrollTax(pay, 2, 0, '10').incomeTax, tax, String(pay))
  }
})

test('11명 초과 가족 수와 과세미달 처리', () => {
  assert.equal(calculatePayrollTax(9_976_237, 12, 0, '10').incomeTax, 924_280)
  assert.equal(calculatePayrollTax(10_000_000, 12, 0, '10').incomeTax, 930_840)
  assert.equal(calculatePayrollTax(0, 1, 0, '10').total, 0)
  assert.equal(calculatePayrollTax(-1, 1, 0, '10').total, 0)
})

test('표 추출 결과: 전 구간 연속, 11개 가족 열, 646개 급여 구간', () => {
  assert.equal(withholdingTable.length, 646)
  assert.equal(withholdingTable[0][0], 770)
  assert.equal(withholdingTable.at(-1)?.[1], 10_000)
  withholdingTable.forEach((row, index) => {
    assert.equal(row.length, 13)
    if (index) assert.equal(withholdingTable[index - 1][1], row[0])
    assert.ok(row.slice(2).every((value) => value >= 0 && value % 10 === 0))
  })
})

test('10원 미만 절사 및 과거 고용보험 0.93% 보정', () => {
  assert.equal(truncateToTenWon(149_717), 149_710)
  assert.equal(truncateToTenWon(-1), 0)
  assert.equal(normalizeEmploymentInsuranceRate(0.93), 0.9)
  assert.equal(normalizeEmploymentInsuranceRate(0.9), 0.9)
})
