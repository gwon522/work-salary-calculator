import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type CreateUserPayload = {
  email?: string
  password?: string
  name?: string
  position?: string
  organizationDivisionId?: string | null
  organizationTeamId?: string | null
  organizationPartId?: string | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        { message: 'Supabase Edge Function 환경변수가 설정되지 않았습니다.' },
        500,
      )
    }

    const authorization = request.headers.get('Authorization')

    if (!authorization) {
      return jsonResponse({ message: '로그인이 필요합니다.' }, 401)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user: requester },
      error: requesterError,
    } = await userClient.auth.getUser()

    if (requesterError || !requester) {
      return jsonResponse({ message: '로그인 정보를 확인할 수 없습니다.' }, 401)
    }

    const { data: requesterProfile, error: requesterProfileError } =
      await userClient
        .from('profiles')
        .select('role')
        .eq('id', requester.id)
        .maybeSingle()

    if (requesterProfileError || requesterProfile?.role !== 'admin') {
      return jsonResponse({ message: '관리자 권한이 필요합니다.' }, 403)
    }

    const payload = (await request.json()) as CreateUserPayload
    const email = payload.email?.trim().toLowerCase()
    const password = payload.password?.trim() || email
    const name = payload.name?.trim()
    const position = payload.position?.trim() || '사원'

    if (!email || !password || !name) {
      return jsonResponse(
        { message: '이름과 메일을 입력해주세요.' },
        400,
      )
    }

    if (password.length < 6) {
      return jsonResponse(
        { message: '임시 비밀번호는 6자 이상으로 입력해주세요.' },
        400,
      )
    }

    const { data: createdUser, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      })

    if (createUserError || !createdUser.user) {
      return jsonResponse(
        { message: createUserError?.message ?? '계정 생성에 실패했습니다.' },
        400,
      )
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email,
        name,
        role: 'user',
        position,
        organization_division_id: payload.organizationDivisionId ?? null,
        organization_team_id: payload.organizationTeamId ?? null,
        organization_part_id: payload.organizationPartId ?? null,
      })
      .select(
        'id, email, name, role, position, hire_date, organization_division_id, organization_team_id, organization_part_id, annual_salary, standard_hourly_wage, dependent_count, child_count',
      )
      .single()

    if (profileError) {
      return jsonResponse(
        { message: profileError.message ?? '프로필 생성에 실패했습니다.' },
        400,
      )
    }

    return jsonResponse({ user: profile }, 200)
  } catch (error) {
    return jsonResponse(
      {
        message:
          error instanceof Error ? error.message : '계정 생성 중 오류가 발생했습니다.',
      },
      500,
    )
  }
})

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
