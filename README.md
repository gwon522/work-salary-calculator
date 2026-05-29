# 근무 급여 계산기

회사 근무, 퇴근 후 재택전환, 이동시간 제외, 휴게시간 제외를 반영하는 가벼운 급여 계산기입니다.

## Supabase 설정

1. Supabase 대시보드에서 프로젝트를 엽니다.
2. 왼쪽 메뉴에서 `SQL Editor`를 누릅니다.
3. `New query`를 누릅니다.
4. 이 프로젝트의 `supabase/schema.sql` 내용을 전부 복사해서 붙여넣습니다.
5. `Run`을 누릅니다.
6. 왼쪽 메뉴 `Storage` → `worklog-templates` 버킷을 열고 `stl-monthly-worklog-template.xlsx` 파일을 업로드합니다. 이 버킷은 public으로 열지 않습니다.
7. 왼쪽 메뉴 `Authentication` → `Providers` → `Email`이 켜져 있는지 확인합니다.
8. `Authentication` → `Sign In / Providers`에서 `Confirm email`이 켜져 있으면 회원가입 후 인증 메일을 확인해야 로그인됩니다.
9. `Authentication` → `URL Configuration`에서 `Site URL`을 로컬 개발 중에는 `http://127.0.0.1:5173`으로 설정합니다.
10. 같은 화면의 `Redirect URLs`에 `http://127.0.0.1:5173`을 추가합니다.

회원가입 화면에서는 이메일, 비밀번호, 이름을 입력합니다. Supabase가 인증 메일을 보내고, 사용자가 메일 확인 링크를 누른 뒤 로그인할 수 있습니다.
비밀번호 찾기는 Supabase 재설정 메일을 사용합니다. 사용자가 메일 링크를 누르면 앱에서 새 비밀번호를 설정합니다.
마이페이지에서는 통상시급, 기본근무시간, 기본 휴게시간을 저장합니다. 저장된 통상시급은 근무 입력 화면에 노출하지 않고 계산에만 사용하며, 기본근무시간은 연장근로 계산 기준에 반영됩니다.

## 로컬 환경변수

`.env.local`을 직접 만들고 Supabase 프로젝트 URL과 anon public key를 넣습니다. 이 파일은 GitHub에 올리지 않습니다.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

근태 다운로드용 엑셀 템플릿은 GitHub와 Vercel에 포함하지 않습니다. Supabase Storage의 비공개 `worklog-templates` 버킷에 올린 파일을 관리자만 런타임에 다운로드해서 사용합니다.

## 실행

```bash
pnpm install
pnpm run dev
```

브라우저에서 Vite가 보여주는 로컬 주소를 엽니다.

## 현재 계산 기준

- 출근시간부터 총 근무 종료시간까지를 전체 시간으로 봅니다.
- 사용자가 입력한 이동시간은 급여 계산에서 제외합니다.
- 마이페이지에 저장한 기본 휴게시간은 급여 계산에서 제외합니다.
- 휴일 근무는 주휴일, 공휴일·대체공휴일, 근로자의 날, 회사 취업규칙이나 근로계약상 휴일에 근무한 경우 체크합니다.
- 1일 8시간 초과분은 연장근로로 계산합니다.
- 22:00부터 06:00까지는 야간근로 가산분으로 계산합니다.
- 휴일 근무는 8시간 이내 1.5배, 8시간 초과 2.0배로 계산합니다.
- 세금, 4대보험, 주휴수당, 사업장별 취업규칙은 아직 포함하지 않습니다.
