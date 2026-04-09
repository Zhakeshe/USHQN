import type { SupabaseClient } from '@supabase/supabase-js'

export type LeaderboardRow = {
  rank: number
  user_id: string
  points: number
  display_name: string
  avatar_url: string | null
}

export async function fetchLeaderboardTotals(client: SupabaseClient): Promise<LeaderboardRow[]> {
  const { data: scores, error: e1 } = await client.from('user_category_scores').select('user_id, points')
  if (e1) throw e1

  const totals = new Map<string, number>()
  for (const row of scores ?? []) {
    const uid = row.user_id as string
    const pts = (row.points as number) ?? 0
    totals.set(uid, (totals.get(uid) ?? 0) + pts)
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return []

  const userIds = sorted.map(([id]) => id)
  const { data: profiles, error: e2 } = await client
    .from('profiles')
    .select('id,display_name,avatar_url')
    .in('id', userIds)
  if (e2) throw e2

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { display_name: string; avatar_url: string | null }]),
  )

  return sorted.map(([user_id, points], index) => {
    const p = profileMap.get(user_id)
    return {
      rank: index + 1,
      user_id,
      points,
      display_name: p?.display_name ?? 'Участник',
      avatar_url: p?.avatar_url ?? null,
    }
  })
}

export function findRankForUser(rows: LeaderboardRow[], userId: string | null): number | null {
  if (!userId) return null
  const row = rows.find((r) => r.user_id === userId)
  return row?.rank ?? null
}
