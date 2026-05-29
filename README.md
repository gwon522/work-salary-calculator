# WorkSalaryCalculator

한국 기준 근무시간, 이동시간, 휴게시간, 연장/야간/휴일근로, 월별 예상 임금, 근무일지 엑셀 다운로드를 처리하는 Vite 기반 급여 계산기입니다.

## 아키텍처

- Frontend: `React`, `TypeScript`, `Vite`
- Backend: `Supabase Auth`, `Postgres`, `Storage`, `Edge Functions`
- 배포: `GitHub` main 브랜치 → `Vercel` 자동 배포
- 인증: Supabase Email Auth
- 데이터 권한: Supabase RLS 정책으로 본인 데이터와 관리자 권한 분리
- 엑셀 템플릿: GitHub/Vercel에 포함하지 않고 Supabase Storage 비공개 버킷에서 런타임 다운로드

## 주요 화면

- 근무입력: 근무일, 휴일근무, 휴가, 근무시간, 이동시간, 연장근무 사유를 입력하고 일급을 계산합니다.
- 워킹캘린더: 월별 근무 현황과 총급여를 캘린더로 확인하고 본인 근무일지를 엑셀로 다운로드합니다.
- 마이페이지: 직급, 입사일자, 조직, 연봉, 부양가족수, 자녀 수를 관리합니다. 비밀번호 변경은 모달에서 처리합니다.
- 사용자관리: 관리자가 사용자 목록을 검색/수정하고 대상자를 선택해 월별 근무일지를 다운로드합니다.
- 조직관리: 본부, 팀, 파트와 조직장을 관리하고 조직도를 확인합니다.
- 시스템관리: 기본근무시간, 휴게시간, 주휴일, 토요일 처리, 포괄근로시간, 세율, 월별 휴일을 관리합니다.

## Supabase 구성

1. Supabase 대시보드에서 프로젝트를 엽니다.
2. `SQL Editor` → `New query`를 엽니다.
3. `supabase/schema.sql` 내용을 실행합니다.
4. `Storage`의 `worklog-templates` 버킷에 `stl-monthly-worklog-template.xlsx` 파일을 업로드합니다.
5. `worklog-templates` 버킷은 public으로 열지 않습니다.
6. `Authentication` → `Providers`에서 Email 로그인을 활성화합니다.
7. `Authentication` → `URL Configuration`에 로컬/배포 URL을 등록합니다.

로컬 개발 URL 예시:

```text
http://127.0.0.1:5173
http://localhost:5173
```

Vercel 배포 후에는 배포 URL도 추가합니다.

```text
https://your-project.vercel.app
https://your-project.vercel.app/**
```

## 환경변수

로컬에서는 `.env.local`을 직접 만들고 GitHub에 올리지 않습니다.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Vercel에도 동일한 키를 등록합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`service_role` 키는 프론트엔드나 Vercel 환경변수에 넣지 않습니다. 관리자 계정 생성 Edge Function에 필요한 관리자 키는 Supabase Function Secret에만 저장합니다.

## 로컬 실행

```bash
pnpm install
pnpm run dev
```

검증:

```bash
pnpm run lint
pnpm run build
```

## 배포

GitHub main 브랜치에 push하면 Vercel이 자동 배포합니다.

```bash
pnpm run lint
pnpm run build
git add .
git commit -m "feat: 작업내용"
git push
```

DB 스키마가 바뀌면 `supabase/schema.sql`도 수정하고 Supabase SQL Editor에서 실행해야 합니다.

## 계산 기준

- 근무 시작부터 근무 종료까지를 총 근무시간으로 계산합니다.
- 종료시간이 시작시간보다 빠르면 다음날 퇴근으로 보고 24시간 초과 표기를 지원합니다.
- 이동시간은 급여 산정에서 차감합니다.
- 휴게시간은 설정값과 근무시간 기준 자동 휴게 계산에 따라 차감합니다.
- 기본근로, 연장근로, 야간근로, 휴일근로, 휴일연장근로를 분리합니다.
- 휴가와 평일 유급휴일은 설정된 기본근무시간 기준으로 월별 산정에 반영합니다.
- 월별 예상 임금은 기본급, 고정 포괄수당, 추가 수당, 4대보험, 소득세/지방소득세 추정치를 함께 표시합니다.

## 보안 주의

- `.env.local`, `dist`, `node_modules`, Supabase 임시 파일, 엑셀 템플릿은 커밋하지 않습니다.
- 엑셀 템플릿은 `public/templates`에 두지 않고 Supabase Storage 비공개 버킷에 둡니다.
- anon key는 프론트에서 사용할 수 있지만 service role key는 절대 브라우저에 노출하지 않습니다.
