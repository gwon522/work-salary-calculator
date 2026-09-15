export type WorkLog = {
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
  overtime_submitted_at: string | null
  regular_pay: number
  overtime_pay: number
  night_pay: number
  holiday_pay: number
  leave_pay: number
  total_pay: number
}
