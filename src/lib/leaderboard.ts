import type { SupabaseClient } from '@supabase/supabase-js'

export type LeaderboardRow = {
  rank: number
  user_id: string
  points: number
  display_name: string
  avatar_url: string | null
}

export type LeaderboardFilters = {
  /** Substring match on profiles.location (city / орналасу) */
  citySub?: string
  /** Substring match on profiles.school_or_org (sýnyptau / сынып белгісі) */
  classSub?: string
  /** Restrict to members of this teacher-led group */
  teacherGroupId?: string
}

export async function fetchLeaderboardTotals(
  client: SupabaseClient,
  filters?: LeaderboardFilters,
): Promise<LeaderboardRow[]> {
  const { data, error } = await client.rpc('leaderboard_totals', {
    p_city_sub: filters?.citySub?.trim() || null,
    p_class_sub: filters?.classSub?.trim() || null,
    p_teacher_group_id: filters?.teacherGroupId || null,
  })
  if (error) throw error

  type RpcRow = {
    user_id: string
    total_points: number | string
    display_name: string
    avatar_url: string | null
  }

  const rows = (data ?? []) as RpcRow[]
  return rows.map((r, index) => ({
    rank: index + 1,
    user_id: r.user_id,
    points: Number(r.total_points),
    display_name: r.display_name?.trim() || '—',
    avatar_url: r.avatar_url ?? null,
  }))
}

export function findRankForUser(rows: LeaderboardRow[], userId: string | null): number | null {
  if (!userId) return null
  const row = rows.find((r) => r.user_id === userId)
  return row?.rank ?? null
}
