import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw, Wallet } from 'lucide-react'
import { formatCurrency } from './payCalculator'
import {
  calculateRetirement,
  estimateAdditionalAllowance,
  getKoreanToday,
  getRetirementPeriods,
} from './retirementCalculator'
import type { WorkLog } from './workLogTypes'
import './RetirementPage.css'

type Props = {
  userId: string
  hireDate: string
  monthlySalary: number
  hourlyWage: number
  regularMinutes: number
  paidDailyMinutes: number
  loadLogs: (userId: string, start: string, end: string) => Promise<WorkLog[]>
  normalizeLog: (log: WorkLog, regularMinutes: number) => WorkLog
}

export function RetirementPage(props: Props) {
  const [today] = useState(getKoreanToday)
  const [referenceDate, setReferenceDate] = useState(today)
  const [hireDateOverride, setHireDate] = useState<string | null>(null)
  const hireDate = hireDateOverride ?? props.hireDate
  const [overrides, setOverrides] = useState<
    Record<string, { base?: string; extra?: string }>
  >({})
  const [annualBonus, setAnnualBonus] = useState('0')
  const [annualLeaveAllowance, setAnnualLeaveAllowance] = useState('0')
  const [ordinaryDailyWage, setOrdinaryDailyWage] = useState<string | null>(
    null,
  )
  const [weeklyHoursEligible, setWeeklyHoursEligible] = useState(true)
  const [hasExcludedPeriods, setHasExcludedPeriods] = useState(false)
  const [retry, setRetry] = useState(0)
  const [data, setData] = useState<{
    key: string
    logs: WorkLog[]
    error: boolean
  } | null>(null)
  const periods = useMemo(
    () => getRetirementPeriods(referenceDate),
    [referenceDate],
  )
  const start = periods[0]?.start ?? ''
  const end = periods.at(-1)?.end ?? ''
  const requestKey = `${props.userId}:${start}:${end}:${retry}`
  const { loadLogs } = props

  useEffect(() => {
    let cancelled = false
    if (start && end && props.userId) {
      loadLogs(props.userId, start, end).then(
        (logs) => {
          if (!cancelled) setData({ key: requestKey, logs, error: false })
        },
        () => {
          if (!cancelled) setData({ key: requestKey, logs: [], error: true })
        },
      )
    }
    return () => {
      cancelled = true
    }
  }, [start, end, props.userId, requestKey, loadLogs])

  const loading = Boolean(start && data?.key !== requestKey)
  const failed = data?.key === requestKey && data.error
  const rows = useMemo(() => {
    const logs =
      data?.key === requestKey && !data.error
        ? data.logs
            .filter((log) => !hireDate || log.work_date >= hireDate)
            .map((log) => props.normalizeLog(log, props.regularMinutes))
        : []
    return periods.map((period) => {
      const records = logs.filter(
        (log) => log.work_date >= period.start && log.work_date <= period.end,
      )
      const employedDays =
        !hireDate || hireDate <= period.start
          ? period.days
          : hireDate > period.end
            ? 0
            : (Date.parse(`${period.end}T00:00:00Z`) -
                Date.parse(`${hireDate}T00:00:00Z`)) /
                86_400_000 +
              1
      const base = Math.round(
        (props.monthlySalary * employedDays) / period.monthDays,
      )
      const extra = Math.round(
        records.reduce(
          (sum, log) =>
            sum +
            estimateAdditionalAllowance(
              log,
              props.hourlyWage,
              props.paidDailyMinutes,
            ),
          0,
        ),
      )
      return { ...period, base, extra, recordCount: records.length }
    })
  }, [data, requestKey, periods, hireDate, props])

  const ordinaryDefault = (props.hourlyWage * props.paidDailyMinutes) / 60
  const ordinaryValue = ordinaryDailyWage ?? String(Math.round(ordinaryDefault))
  const wages = rows.map(
    (row) =>
      Number(overrides[row.start]?.base ?? row.base) +
      Number(overrides[row.start]?.extra ?? row.extra),
  )
  const invalidAmounts =
    rows.some((row) => {
      const override = overrides[row.start]
      return [
        override?.base ?? String(row.base),
        override?.extra ?? String(row.extra),
      ].some(
        (value) =>
          value.trim() === '' ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0,
      )
    }) ||
    [annualBonus, annualLeaveAllowance, ordinaryValue].some(
      (value) =>
        value.trim() === '' ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0,
    )
  const fullyManual =
    rows.length > 0 &&
    rows.every(
      (row) =>
        overrides[row.start]?.base !== undefined &&
        overrides[row.start]?.extra !== undefined,
    )
  const calculation = invalidAmounts
    ? null
    : calculateRetirement({
        hireDate,
        referenceDate,
        wages,
        annualBonus: Number(annualBonus),
        annualLeaveAllowance: Number(annualLeaveAllowance),
        ordinaryDailyWage: Number(ordinaryValue),
      })
  const ready =
    calculation &&
    ((!loading && !failed) || fullyManual) &&
    !hasExcludedPeriods &&
    referenceDate <= today
  const eligible = calculation?.eligible && weeklyHoursEligible
  const updateWage = (key: string, field: 'base' | 'extra', value: string) => {
    setOverrides((previous) => ({
      ...previous,
      [key]: { ...previous[key], [field]: value },
    }))
  }

  return (
    <section className="retirement-page">
      <header className="retirement-heading">
        <div>
          <h2>
            <Wallet size={22} aria-hidden="true" />
            퇴직금 예상 정산
          </h2>
          <p>
            접속일 기준 직전 3개월의 임금으로, 오늘 기준 예상 퇴직금을
            확인하세요.
          </p>
        </div>
        <span className="retirement-estimate-label">세전 · 예상액</span>
      </header>

      <div className="retirement-fields">
        <label>
          입사일
          <input
            type="date"
            value={hireDate}
            max={referenceDate || today}
            onChange={(event) => {
              setHireDate(event.target.value)
              setOverrides({})
            }}
          />
          <small>저장된 입사일 기본값 · 변경은 이 계산에만 적용</small>
        </label>
        <label>
          산정 기준일
          <input
            type="date"
            value={referenceDate}
            max={today}
            onChange={(event) => {
              setReferenceDate(event.target.value)
              setOverrides({})
            }}
          />
          <small>퇴직일 = 마지막 근무일의 다음 날 · 당일 제외</small>
        </label>
        <label>
          1일 통상임금 (원)
          <input
            type="number"
            min="0"
            step="1"
            value={ordinaryValue}
            onChange={(event) => setOrdinaryDailyWage(event.target.value)}
          />
          <small>
            현재 통상시급 × 소정근로 {props.paidDailyMinutes / 60}시간
          </small>
        </label>
      </div>

      <div className="retirement-result" aria-live="polite">
        <div className="retirement-total">
          <span>예상 퇴직금</span>
          <strong>
            {ready ? formatCurrency(eligible ? calculation.grossPay : 0) : '—'}
          </strong>
          <small>
            {hasExcludedPeriods
              ? '제외기간이 있어 별도 산정이 필요합니다.'
              : ready && !eligible
                ? '1년 이상 계속근로 및 주 평균 15시간 이상 요건을 확인하세요.'
                : '퇴직소득세 차감 전 · 실제 지급액과 다를 수 있습니다.'}
          </small>
        </div>
        <div>
          <span>1일 평균임금</span>
          <strong>
            {ready ? formatCurrency(calculation.averageDailyWage) : '—'}
          </strong>
          <small>{calculation?.periodDays ?? 0}일의 달력일수로 계산</small>
        </div>
        <div>
          <span>재직일수</span>
          <strong>
            {calculation
              ? `${calculation.serviceDays.toLocaleString()}일`
              : '—'}
          </strong>
          <small>입사일부터 기준일 전날까지</small>
        </div>
      </div>

      {(!hireDate || !calculation || referenceDate > today) && (
        <p className="retirement-notice" role="status">
          유효한 입사일·기준일과 0 이상 금액을 입력해주세요. 기준일은 입사일
          이후, 오늘 이하여야 합니다.
        </p>
      )}
      <div className="retirement-table-heading">
        <div>
          <h3>직전 3개월 임금 내역</h3>
          <p>
            {start && end
              ? `${start} ~ ${end} · 기준일 제외`
              : '기준일을 선택해주세요.'}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setOverrides({})}
        >
          <RefreshCw size={15} aria-hidden="true" /> 자동 추정값으로
        </button>
      </div>
      <p className="retirement-notice">
        현재 연봉의 월 급여(기본급·고정수당)는 달력일수로 일할 계산하고,
        추가수당은 해당 날짜의 근무기록으로 추정합니다. 과거 급여 변동·미등록
        근무는 알 수 없으므로 급여명세서의 해당 기간 세전 금액으로 수정해주세요.
        입력값은 저장되지 않습니다.
      </p>
      {loading && (
        <p role="status" className="retirement-notice">
          해당 기간의 근무기록을 불러오는 중입니다.
        </p>
      )}
      {failed && (
        <p role="alert" className="retirement-notice">
          근무기록을 불러오지 못했습니다. 다시 시도하거나 모든 기간의 금액을
          직접 입력해주세요.{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            다시 시도
          </button>
        </p>
      )}
      <p className="retirement-scroll-hint">
        표를 좌우로 밀어 금액을 확인·수정하세요.
      </p>
      <div
        className="retirement-table-scroll"
        role="region"
        aria-label="산정기간별 세전 임금 입력 표"
        tabIndex={0}
      >
        <table className="retirement-table">
          <caption>산정기간별 세전 임금 입력</caption>
          <thead>
            <tr>
              <th scope="col">산정기간</th>
              <th scope="col">일수</th>
              <th scope="col">기본급·고정수당 (원)</th>
              <th scope="col">추가수당 (원)</th>
              <th scope="col">기간 합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.start}>
                <th scope="row">
                  <span>
                    {row.start} ~ {row.end}
                  </span>
                  <small>
                    {overrides[row.start] ? '직접 수정' : '자동 추정'} ·{' '}
                    {loading
                      ? '조회 중'
                      : failed
                        ? '조회 실패'
                        : row.recordCount
                          ? `${row.recordCount}일 근무기록`
                          : '근무기록 없음 · 추가수당 확인 필요'}
                  </small>
                </th>
                <td>{row.days}일</td>
                <td>
                  <input
                    aria-label={`${row.start} 기본급·고정수당`}
                    type="number"
                    min="0"
                    step="1"
                    value={overrides[row.start]?.base ?? row.base}
                    onChange={(event) =>
                      updateWage(row.start, 'base', event.target.value)
                    }
                    onBlur={(event) =>
                      updateWage(row.start, 'base', event.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`${row.start} 추가수당`}
                    type="number"
                    min="0"
                    step="1"
                    value={overrides[row.start]?.extra ?? row.extra}
                    onChange={(event) =>
                      updateWage(row.start, 'extra', event.target.value)
                    }
                    onBlur={(event) =>
                      updateWage(row.start, 'extra', event.target.value)
                    }
                  />
                </td>
                <td>{invalidAmounts ? '—' : formatCurrency(wages[index])}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">임금 합계</th>
              <td>{periods.reduce((sum, period) => sum + period.days, 0)}일</td>
              <td colSpan={3}>
                {invalidAmounts
                  ? '—'
                  : formatCurrency(wages.reduce((sum, wage) => sum + wage, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <details className="retirement-details">
        <summary>상여금·연차수당 및 적용 조건</summary>
        <div className="retirement-extra-fields">
          <label>
            산입 대상 연간 상여금 (원)
            <input
              type="number"
              min="0"
              step="1"
              value={annualBonus}
              onChange={(event) => setAnnualBonus(event.target.value)}
            />
            <small>퇴직 전 12개월 산입 대상 총액 × 3/12 가산</small>
          </label>
          <label>
            산입 대상 연차수당 (원)
            <input
              type="number"
              min="0"
              step="1"
              value={annualLeaveAllowance}
              onChange={(event) => setAnnualLeaveAllowance(event.target.value)}
            />
            <small>퇴직 전년도 미사용분 등 산입 대상액 × 3/12 가산</small>
          </label>
        </div>
        <p>
          위 임금 표에 이미 반영한 상여금·연차수당은 중복 입력하지 마세요.
          퇴직으로 새로 발생한 미사용 연차수당은 여기 포함하지 않습니다.
        </p>
        <label className="retirement-check">
          <input
            type="checkbox"
            checked={weeklyHoursEligible}
            onChange={(event) => setWeeklyHoursEligible(event.target.checked)}
          />
          4주 평균 1주 소정근로시간 15시간 이상에 해당합니다.
        </label>
        <label className="retirement-check">
          <input
            type="checkbox"
            checked={hasExcludedPeriods}
            onChange={(event) => setHasExcludedPeriods(event.target.checked)}
          />
          휴직·휴업 등 평균임금 또는 계속근로기간에서 제외할 기간이 있습니다.
        </label>
        <p>
          제외기간이 있거나 중간정산 이력이 있으면 회사 담당자와 별도
          산정해주세요. 이 계산은 퇴직금·DB형 수준의 단순 추정이며 DC형
          적립금·운용수익 계산은 아닙니다.
        </p>
      </details>

      <footer className="retirement-formula">
        <h3>이렇게 계산했어요</h3>
        <p>
          1일 평균임금 = (기간 임금 합계 + 상여금·연차수당 가산액) ÷ 해당 기간
          총일수
        </p>
        <p>예상 퇴직금 = 적용 1일 임금 × 30일 × 재직일수 ÷ 365일</p>
        {ready && (
          <p>
            가산액{' '}
            {formatCurrency(
              calculation.bonusAllocation + calculation.leaveAllocation,
            )}{' '}
            · 적용 1일 임금 {formatCurrency(calculation.appliedDailyWage)} (
            {calculation.usesOrdinaryWage
              ? '평균임금보다 높은 통상임금 적용'
              : '평균임금 적용'}
            )
          </p>
        )}
        <a
          href="https://www.moel.go.kr/retirementpayCal.do"
          target="_blank"
          rel="noopener noreferrer"
        >
          고용노동부 퇴직금 계산 기준{' '}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </footer>
    </section>
  )
}
