import { taxAtTenMillion, withholdingTable } from './withholdingTable.ts'

export function truncateToTenWon(value: number) {
  return Math.floor((Math.max(0, value) + 1e-7) / 10) * 10
}

function percentToRate(value: string | number) {
  return Math.max(0, Number(value) || 0) / 100
}

export function normalizeEmploymentInsuranceRate(value: number) {
  // Correct the legacy employee rate accidentally saved as 0.93%.
  return Math.abs(value - 0.93) < 1e-9 ? 0.9 : value
}

export function calculateInsurance(
  monthlyPay: number,
  monthlyPensionBasePay: number,
  rates: {
    pensionRate: string
    healthInsuranceRate: string
    longTermCareRate: string
    employmentInsuranceRate: string
  },
) {
  const pension = truncateToTenWon(
    monthlyPensionBasePay * percentToRate(rates.pensionRate),
  )
  const health = truncateToTenWon(
    monthlyPay * percentToRate(rates.healthInsuranceRate),
  )
  const longTermCare = truncateToTenWon(
    health * percentToRate(rates.longTermCareRate),
  )
  const employment = truncateToTenWon(
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

function taxForFamily(taxes: number[], familyCount: number) {
  if (familyCount <= 11) return taxes[familyCount - 1]

  // 별표 2 제4호: use the difference between columns 10 and 11 for each extra person.
  return Math.max(0, taxes[10] - (taxes[9] - taxes[10]) * (familyCount - 11))
}

function taxAboveTenMillion(monthlyPay: number) {
  if (monthlyPay <= 10_000_000) return 0
  if (monthlyPay <= 14_000_000) {
    return 25_000 + (monthlyPay - 10_000_000) * 0.98 * 0.35
  }
  if (monthlyPay <= 28_000_000) {
    return 1_397_000 + (monthlyPay - 14_000_000) * 0.98 * 0.38
  }
  if (monthlyPay <= 30_000_000) {
    return 6_610_600 + (monthlyPay - 28_000_000) * 0.98 * 0.4
  }
  if (monthlyPay <= 45_000_000) {
    return 7_394_600 + (monthlyPay - 30_000_000) * 0.4
  }
  if (monthlyPay <= 87_000_000) {
    return 13_394_600 + (monthlyPay - 45_000_000) * 0.42
  }
  return 31_034_600 + (monthlyPay - 87_000_000) * 0.45
}

// 2026-02-27 revision of 소득세법 시행령 별표 2, withholding at 100%.
// monthlyPay excludes non-taxable salary. familyCount includes the employee.
// childCount counts only eligible children aged 8 to 20, already included in familyCount.
export function calculatePayrollTax(
  monthlyPay: number,
  dependentCount: number,
  childCount: number,
  localIncomeTaxRate: string,
) {
  const pay = Math.max(0, Number.isFinite(monthlyPay) ? monthlyPay : 0)
  const family = Math.max(1, Math.floor(dependentCount) || 1)
  const children = Math.min(family - 1, Math.max(0, Math.floor(childCount) || 0))
  let tableTax = 0

  if (pay >= 10_000_000) {
    // Apply the extra-family adjustment to the whole tax, including the excess-pay tax.
    tableTax = Math.max(
      0,
      taxAtTenMillion[Math.min(family, 11) - 1] +
        taxAboveTenMillion(pay) -
        Math.max(0, family - 11) * (taxAtTenMillion[9] - taxAtTenMillion[10]),
    )
  } else {
    const row = withholdingTable.find(
      ([from, to]) => pay >= from * 1000 && pay < to * 1000,
    )
    if (row) tableTax = taxForFamily(row.slice(2), family)
  }

  const childDeduction = children === 0
    ? 0
    : children === 1
      ? 20_830
      : 45_830 + (children - 2) * 33_330
  const incomeTax = truncateToTenWon(tableTax - childDeduction)
  const localIncomeTax = truncateToTenWon(
    incomeTax * percentToRate(localIncomeTaxRate),
  )

  return { incomeTax, localIncomeTax, total: incomeTax + localIncomeTax }
}
