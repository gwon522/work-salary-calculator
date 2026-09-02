import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type DeleteUserPayload = {
  userId?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ message: '지원하지 않는 요청입니다.' }, 405)
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

    const payload = (await request.json()) as DeleteUserPayload
    const userId = payload.userId?.trim()

    if (!userId) {
      return jsonResponse({ message: '삭제할 사용자를 확인해주세요.' }, 400)
    }

    if (userId === requester.id) {
      return jsonResponse(
        { message: '현재 로그인한 관리자 계정은 삭제할 수 없습니다.' },
        400,
      )
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (targetProfileError) {
      return jsonResponse({ message: targetProfileError.message }, 400)
    }

    if (!targetProfile) {
      return jsonResponse({ message: '삭제할 계정을 찾을 수 없습니다.' }, 404)
    }

    const { error: deleteUserError } =
      await adminClient.auth.admin.deleteUser(userId)

    if (deleteUserError) {
      return jsonResponse({ message: deleteUserError.message }, 400)
    }

    return jsonResponse({ deletedUserId: userId }, 200)
  } catch (error) {
    return jsonResponse(
      {
        message:
          error instanceof Error ? error.message : '계정 삭제 중 오류가 발생했습니다.',
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
