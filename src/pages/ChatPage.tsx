import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '../hooks/useAuth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { supabase } from '../lib/supabase'
import { sanitizeUserText } from '../lib/sanitize'
import { uploadPublicFile } from '../lib/upload'
import { ContentReportDialog } from '../components/ContentReportDialog'
import { useToast } from '../lib/toast'
import { formatSupabaseError } from '../lib/supabaseErrors'

type MsgRow = {
  id: string
  body: string | null
  sender_id: string
  created_at: string
  attachment_url: string | null
  attachment_name: string | null
  reply_to_id: string | null
}

type ChatTimelineItem =
  | { type: 'day'; label: string; key: string }
  | { type: 'msg'; msg: MsgRow; key: string }

type SidebarRpcRow = {
  conversation_id: string
  is_group: boolean
  title: string | null
  last_body: string | null
  last_at: string | null
  last_sender_id: string | null
  unread_count: number
  has_unread: boolean
  other_user_ids: string[]
}

type ConvListItem = {
  id: string
  isGroup: boolean
  title: string | null
  displayName: string
  subtitle: string
  lastAt: string | null
  unreadCount: number
  hasUnread: boolean
  otherUserIds: string[]
  avatarKey: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatClock(iso: string, locale: string) {
  try {
    const d = new Date(iso)
    const tag = locale.startsWith('en') ? 'en-US' : locale.startsWith('kk') ? 'kk-KZ' : 'ru-RU'
    return d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatRelativeListTime(iso: string, locale: string, t: TFunction, nowTs: number) {
  try {
    const d = new Date(iso)
    const ts = d.getTime()
    const diffMs = Math.max(0, nowTs - ts)
    const minutes = Math.floor(diffMs / 60_000)
    const hours = Math.floor(diffMs / 3_600_000)
    const today = new Date(nowTs)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (minutes < 1) return t('chat.justNow')
    if (minutes < 60) return t('chat.minutesAgo', { count: minutes })
    if (hours < 24 && d.toDateString() === today.toDateString()) return t('chat.hoursAgo', { count: hours })
    if (d.toDateString() === yesterday.toDateString()) return t('chat.yesterdayAt', { time: formatClock(iso, locale) })
    return formatClock(iso, locale)
  } catch {
    return ''
  }
}

function formatDayLabel(iso: string, locale: string, t: TFunction) {
  try {
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const tag = locale.startsWith('en') ? 'en-US' : locale.startsWith('kk') ? 'kk-KZ' : 'ru-RU'
    if (d.toDateString() === today.toDateString()) return t('chat.today')
    if (d.toDateString() === yesterday.toDateString()) return t('chat.yesterday')
    return d.toLocaleDateString(tag, { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function replyComposerPreview(m: MsgRow, t: TFunction) {
  if (m.attachment_url) {
    return t('chat.replyPreviewAttachment', { name: m.attachment_name ?? t('chat.attachment') })
  }
  const raw = m.body?.replace(/\s+/g, ' ').trim() ?? ''
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw || '…'
}

function previewLine(
  lastBody: string | null,
  lastSenderId: string | null,
  userId: string | undefined,
  t: TFunction,
) {
  if (!lastBody?.trim()) return t('chat.lastMessagePreview')
  const raw = lastBody.replace(/\s+/g, ' ').trim()
  const shortened = raw.length > 72 ? `${raw.slice(0, 69)}…` : raw
  if (lastSenderId && userId && lastSenderId === userId) return t('chat.youPrefix') + shortened
  return shortened
}

function ChatConvItem({
  c,
  conversationId,
  i18n,
  t,
  nowTs,
}: {
  c: ConvListItem
  conversationId: string | undefined
  i18n: { language: string }
  t: TFunction
  nowTs: number
}) {
  const isActive = c.id === conversationId
  const grad = colorFor(c.avatarKey)
  const timeStr = c.lastAt ? formatRelativeListTime(c.lastAt, i18n.language, t, nowTs) : ''
  return (
    <div className="border-b border-[var(--color-ushqn-border)]/30 last:border-0">
      <Link
        to={`/chat/${c.id}`}
        className={`flex items-center gap-3 px-3 py-2.5 transition ${
          isActive
            ? 'bg-[var(--color-ushqn-surface)] shadow-[inset_3px_0_0_#0052CC]'
            : 'hover:bg-[var(--color-ushqn-surface)]'
        }`}
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-xs font-bold text-white shadow-inner`}
        >
          {c.isGroup ? '⎔' : getInitials(c.displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className={`truncate text-sm font-bold ${isActive ? 'text-[#0052CC]' : 'text-[var(--color-ushqn-text)]'}`}>
              {c.displayName}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {c.hasUnread && !isActive ? (
                <span className="flex min-w-[1.1rem] items-center justify-center rounded-full bg-[#0052CC] px-1.5 py-[1px] text-[9px] font-extrabold text-white">
                  {c.unreadCount > 9 ? '9+' : c.unreadCount}
                </span>
              ) : null}
              {timeStr ? (
                <span className="text-[9px] text-[var(--color-ushqn-muted)]">{timeStr}</span>
              ) : null}
            </div>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[var(--color-ushqn-muted)]">{c.subtitle}</p>
        </div>
      </Link>
    </div>
  )
}

const AVATAR_COLORS = [
  'from-[#0d8abc] to-[#2eb88a]',
  'from-[#6b4dc8] to-[#9d74e8]',
  'from-[#c25400] to-[#e8912d]',
  'from-[#00838f] to-[#4dd0e1]',
  'from-[#c62828] to-[#ff7043]',
]

function colorFor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function GroupModal({
  open,
  onClose,
  userId,
}: {
  open: boolean
  onClose: () => void
  userId: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebouncedValue(q.trim(), 320)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!open) {
      setTitle('')
      setQ('')
      setPicked(new Set())
    }
  }, [open])

  const searchQuery = useQuery({
    queryKey: ['chat-group-search', debouncedQ, userId],
    enabled: open && Boolean(userId) && debouncedQ.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,display_name')
        .neq('id', userId!)
        .ilike('display_name', `%${debouncedQ}%`)
        .limit(16)
      if (error) throw error
      return data ?? []
    },
  })

  const createGroup = useMutation({
    mutationFn: async () => {
      const name = title.trim()
      if (!name) throw new Error('need-title')
      const ids = [...picked]
      if (ids.length < 1) throw new Error('need-member')
      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_title: name,
        p_member_ids: ids,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['chat-sidebar'] })
      onClose()
      void navigate(`/chat/${id}`)
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error && e.message === 'need-title' ? t('chat.groupNeedTitle') : null
      const msg2 = e instanceof Error && e.message === 'need-member' ? t('chat.groupNeedMember') : null
      toast(msg ?? msg2 ?? t('chat.groupFailed'), 'error')
    },
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="group-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col rounded-t-3xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[var(--color-ushqn-border)] px-4 py-3">
          <h2 id="group-modal-title" className="text-base font-bold text-[var(--color-ushqn-text)]">
            {t('chat.createGroupTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm font-semibold text-[var(--color-ushqn-muted)] hover:bg-[var(--color-ushqn-surface-muted)]"
          >
            {t('common.cancel')}
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-[var(--color-ushqn-muted)]">
              {t('chat.groupName')}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('chat.groupNamePlaceholder')}
              className="ushqn-input mt-1"
            />
          </div>
          <p className="text-sm text-[var(--color-ushqn-muted)]">{t('chat.groupPickHint')}</p>
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('chat.groupSearchPeople')}
              className="ushqn-input"
            />
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]/50 p-1">
              {!debouncedQ || debouncedQ.length < 2 ? (
                <li className="px-3 py-4 text-center text-xs text-[var(--color-ushqn-muted)]">{t('chat.groupSearchMin')}</li>
              ) : searchQuery.isLoading ? (
                <li className="px-3 py-3 text-sm text-[var(--color-ushqn-muted)]">…</li>
              ) : (searchQuery.data ?? []).length === 0 ? (
                <li className="px-3 py-3 text-sm text-[var(--color-ushqn-muted)]">—</li>
              ) : (
                (searchQuery.data ?? []).map((p) => {
                  const on = picked.has(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked((prev) => {
                            const next = new Set(prev)
                            if (next.has(p.id)) next.delete(p.id)
                            else next.add(p.id)
                            return next
                          })
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                          on
                            ? 'bg-[#DEEBFF] text-[#0052CC] dark:bg-blue-950/40'
                            : 'hover:bg-[var(--color-ushqn-surface)]'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(p.id)} text-xs font-bold text-white`}
                        >
                          {getInitials(p.display_name ?? '?')}
                        </span>
                        <span className="min-w-0 truncate">{sanitizeUserText(p.display_name ?? '')}</span>
                        <span className="ml-auto text-xs font-bold">{on ? '✓' : '+'}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--color-ushqn-border)] p-4">
          <button
            type="button"
            disabled={createGroup.isPending}
            onClick={() => createGroup.mutate()}
            className="w-full rounded-xl bg-[#0052CC] py-3 text-sm font-bold text-white shadow-lg shadow-[#0052CC]/25 transition hover:bg-[#0747A6] disabled:opacity-50"
          >
            {createGroup.isPending ? t('chat.groupCreating') : t('chat.groupCreate')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ChatPage() {
  const { t, i18n } = useTranslation()
  const { conversationId } = useParams<{ conversationId?: string }>()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [reportMessageId, setReportMessageId] = useState<string | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [replyDraft, setReplyDraft] = useState<MsgRow | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [chatSearch, setChatSearch] = useState('')
  const [chatSearchFocused, setChatSearchFocused] = useState(false)
  const chatSearchDebounced = useDebouncedValue(chatSearch.trim(), 300)

  const userSearchQuery = useQuery({
    queryKey: ['chat-user-search', chatSearchDebounced],
    enabled: chatSearchFocused && chatSearchDebounced.length >= 1,
    queryFn: async () => {
      const q = chatSearchDebounced
      const { data, error } = await supabase
        .from('profiles')
        .select('id,display_name,username,avatar_url')
        .neq('id', userId ?? '')
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setReplyDraft(null)
  }, [conversationId])

  const sidebarQuery = useQuery({
    queryKey: ['chat-sidebar', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<SidebarRpcRow[]> => {
      const { data, error } = await supabase.rpc('my_chat_sidebar')
      if (error) throw error
      return (data ?? []) as SidebarRpcRow[]
    },
  })

  const profileIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of sidebarQuery.data ?? []) {
      for (const id of r.other_user_ids ?? []) {
        if (id) s.add(id)
      }
    }
    return [...s]
  }, [sidebarQuery.data])

  const namesQuery = useQuery({
    queryKey: ['chat-names', [...profileIds].sort().join('|')],
    enabled: profileIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id,display_name').in('id', profileIds)
      if (error) throw error
      return new Map((data ?? []).map((p) => [p.id, p.display_name ?? '']))
    },
  })

  const convList = useMemo((): ConvListItem[] => {
    const rows = sidebarQuery.data ?? []
    const nm = namesQuery.data ?? new Map<string, string>()
    return rows.map((r) => {
      const isGroup = Boolean(r.is_group)
      let displayName: string
      if (isGroup) {
        displayName = r.title?.trim() || t('chat.groupChat')
      } else if ((r.other_user_ids?.length ?? 0) === 1) {
        const pid = r.other_user_ids[0]
        displayName = (pid && nm.get(pid)) || t('chat.unknownPeer')
      } else {
        const parts = (r.other_user_ids ?? []).map((id) => nm.get(id)).filter(Boolean) as string[]
        displayName = parts.slice(0, 3).join(', ') || t('chat.unknownPeer')
      }
      const subtitle = previewLine(r.last_body, r.last_sender_id, userId ?? undefined, t)
      const avatarKey = isGroup ? r.conversation_id : r.other_user_ids?.[0] ?? r.conversation_id
      return {
        id: r.conversation_id,
        isGroup,
        title: r.title,
        displayName,
        subtitle,
        lastAt: r.last_at,
        unreadCount: Math.max(0, Number(r.unread_count ?? 0)),
        hasUnread: Boolean(r.has_unread),
        otherUserIds: r.other_user_ids ?? [],
        avatarKey,
      }
    })
  }, [sidebarQuery.data, namesQuery.data, t, userId])

  const activeConv = useMemo(() => convList.find((c) => c.id === conversationId) ?? null, [convList, conversationId])

  const membersQuery = useQuery({
    queryKey: ['conv-members', conversationId],
    enabled: Boolean(conversationId && userId),
    queryFn: async () => {
      const { data: parts, error } = await supabase.rpc('get_conversation_members', { p_conv_id: conversationId! })
      if (error) throw error
      const ids = [...new Set((parts ?? []).map((p: { user_id: string }) => p.user_id))]
      if (ids.length === 0) return { ids: [], byId: new Map<string, string>() }
      const { data: profs, error: e2 } = await supabase.from('profiles').select('id,display_name').in('id', ids)
      if (e2) throw e2
      const byId = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? t('chat.unknownPeer')]))
      return { ids, byId }
    },
  })

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    enabled: Boolean(userId && conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id,body,sender_id,created_at,attachment_url,attachment_name,reply_to_id')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MsgRow[]
    },
  })

  const messageById = useMemo(() => {
    const list = messagesQuery.data ?? []
    return new Map(list.map((m) => [m.id, m]))
  }, [messagesQuery.data])

  const dmPeerId = activeConv && !activeConv.isGroup && activeConv.otherUserIds.length === 1 ? activeConv.otherUserIds[0] : null

  const peerReadQuery = useQuery({
    queryKey: ['conv-peer-read', conversationId, dmPeerId],
    enabled: Boolean(conversationId && userId && dmPeerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('last_read_at')
        .eq('conversation_id', conversationId!)
        .eq('user_id', dmPeerId!)
        .maybeSingle()
      if (error) throw error
      return data?.last_read_at ?? null
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesQuery.data])

  useEffect(() => {
    if (!conversationId || !userId || !messagesQuery.data?.length) return
    const tmr = window.setTimeout(() => {
      void supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .then(() => {
          void qc.invalidateQueries({ queryKey: ['conv-peer-read', conversationId] })
        })
    }, 450)
    return () => window.clearTimeout(tmr)
  }, [conversationId, userId, messagesQuery.data, qc])

  useEffect(() => {
    if (!conversationId || !userId) return
    const channel = supabase
      .channel(`msgs:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['messages', conversationId] })
          void qc.invalidateQueries({ queryKey: ['chat-sidebar'] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, userId, qc])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`partread:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['conv-peer-read', conversationId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, qc])

  useEffect(() => {
    if (!conversationId || !userId) return
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: userId } },
    })
    typingChannelRef.current = channel

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ user_id: string; typing: boolean }>()
      const ids = new Set<string>()
      for (const rows of Object.values(state)) {
        for (const row of rows) {
          if (row.user_id !== userId && row.typing) ids.add(row.user_id)
        }
      }
      setTypingUsers([...ids])
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, typing: false, at: Date.now() })
      }
    })

    return () => {
      typingChannelRef.current = null
      setTypingUsers([])
      void supabase.removeChannel(channel)
    }
  }, [conversationId, userId])

  useEffect(() => {
    if (!conversationId || !userId) return
    const tmr = window.setTimeout(() => {
      const channel = typingChannelRef.current
      if (!channel) return
      void channel.track({ user_id: userId, typing: body.trim().length > 0, at: Date.now() })
    }, 120)
    return () => window.clearTimeout(tmr)
  }, [conversationId, userId, body])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`chat-sidebar-live:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: ['chat-sidebar', userId] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: ['chat-sidebar', userId] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants' }, () => {
        void qc.invalidateQueries({ queryKey: ['chat-sidebar', userId] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, () => {
        void qc.invalidateQueries({ queryKey: ['chat-sidebar', userId] })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversation_participants' }, () => {
        void qc.invalidateQueries({ queryKey: ['chat-sidebar', userId] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, qc])

  const { toast } = useToast()

  const deleteMsg = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase.from('messages').delete().eq('id', msgId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    onError: () => toast(t('chat.deleteFailed'), 'error'),
  })

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim()
      const file = pendingFile
      if ((!text && !file) || !conversationId || !userId) return
      let attachment_url: string | null = null
      let attachment_name: string | null = null
      if (file) {
        attachment_name = file.name
        attachment_url = await uploadPublicFile(userId, `chat/${conversationId}/${Date.now()}-${file.name}`, file)
        if (!attachment_url) throw new Error('upload failed')
      }
      const bodyOut = text || (attachment_name ? `📎 ${attachment_name}` : '')
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        body: bodyOut,
        attachment_url,
        attachment_name,
        ...(replyDraft ? { reply_to_id: replyDraft.id } : {}),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setBody('')
      setPendingFile(null)
      setReplyDraft(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      void qc.invalidateQueries({ queryKey: ['messages', conversationId] })
      void qc.invalidateQueries({ queryKey: ['chat-sidebar', userId] })
    },
    onError: (err) => {
      toast(formatSupabaseError(err, t), 'error')
    },
  })

  const peerReadAt = peerReadQuery.data ? new Date(peerReadQuery.data).getTime() : null
  const nameById = membersQuery.data?.byId ?? new Map<string, string>()
  const memberCount = membersQuery.data?.ids.length ?? 0

  const messagesWithDividers = useMemo((): ChatTimelineItem[] => {
    const list = messagesQuery.data ?? []
    const out: ChatTimelineItem[] = []
    let lastDay = ''
    for (const m of list) {
      const day = new Date(m.created_at).toDateString()
      if (day !== lastDay) {
        lastDay = day
        out.push({ type: 'day', label: formatDayLabel(m.created_at, i18n.language, t), key: `d-${m.created_at}` })
      }
      out.push({ type: 'msg', msg: m, key: m.id })
    }
    return out
  }, [messagesQuery.data, i18n.language, t])

  const headerSub =
    activeConv?.isGroup && memberCount > 0
      ? t('chat.membersCount', { count: memberCount })
      : activeConv
        ? t('chat.directChat')
        : ''

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return ''
    const names = typingUsers.map((id) => nameById.get(id) || t('chat.unknownPeer')).filter(Boolean)
    if (!names.length) return t('chat.typing')
    if (names.length === 1) return t('chat.typingOne', { name: names[0] })
    return t('chat.typingMany', { count: names.length })
  }, [typingUsers, nameById, t])

  return (
    <div
      className="flex min-h-[calc(100dvh-5.5rem)] flex-col gap-0 lg:grid lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-3"
    >
      <ContentReportDialog
        open={Boolean(reportMessageId)}
        onClose={() => setReportMessageId(null)}
        targetType="message"
        targetId={reportMessageId ?? ''}
      />
      <GroupModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} userId={userId} />

      {/* Sidebar — messenger rail */}
      <aside
        className={`flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] shadow-sm lg:min-h-0 ${
          conversationId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Top bar: title + new group */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-ushqn-border)] px-3 py-2.5">
          <h2 className="text-sm font-extrabold tracking-tight text-[var(--color-ushqn-text)]">{t('chat.sidebarTitle')}</h2>
          <button
            type="button"
            onClick={() => setGroupModalOpen(true)}
            className="shrink-0 rounded-full bg-[#0052CC] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#0747A6] active:scale-95"
          >
            + {t('chat.newGroup')}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative px-3 py-2">
          <svg className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ushqn-muted)]" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" />
          </svg>
          <input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            onFocus={() => setChatSearchFocused(true)}
            onBlur={() => setTimeout(() => setChatSearchFocused(false), 200)}
            placeholder={t('chat.searchPeople')}
            className="w-full rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] py-2 pl-8 pr-3 text-xs text-[var(--color-ushqn-text)] outline-none transition focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]/20 placeholder:text-[var(--color-ushqn-muted)]"
          />
          {chatSearch ? (
            <button type="button" onClick={() => setChatSearch('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--color-ushqn-muted)] hover:text-[var(--color-ushqn-text)]">
              ×
            </button>
          ) : null}
        </div>

        {/* Search results — user list */}
        {chatSearch && chatSearchDebounced.length >= 1 ? (
          <div className="flex-1 overflow-y-auto">
            {userSearchQuery.isLoading ? (
              <p className="px-4 py-3 text-xs text-[var(--color-ushqn-muted)]">…</p>
            ) : (userSearchQuery.data ?? []).length === 0 ? (
              <p className="px-4 py-3 text-xs text-[var(--color-ushqn-muted)]">—</p>
            ) : (
              <ul>
                {(userSearchQuery.data ?? []).map((p) => (
                  <li key={p.id} className="border-b border-[var(--color-ushqn-border)]/40 last:border-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-3 transition hover:bg-[var(--color-ushqn-surface)]"
                      onClick={async () => {
                        const { data, error } = await supabase.rpc('get_or_create_dm', { other_id: p.id })
                        if (!error && data) {
                          setChatSearch('')
                          navigate(`/chat/${data as string}`)
                        }
                      }}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorFor(p.id)} text-xs font-bold text-white`}>
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                          : getInitials(p.display_name ?? '?')}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-semibold text-[var(--color-ushqn-text)]">{sanitizeUserText(p.display_name ?? '')}</p>
                        {(p as { username?: string | null }).username ? (
                          <p className="text-xs text-[var(--color-ushqn-muted)]">@{(p as { username?: string }).username}</p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {(sidebarQuery.data ?? []).length === 0 && !sidebarQuery.isLoading ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="text-4xl opacity-90">💬</span>
                <p className="mt-3 text-sm font-bold text-[var(--color-ushqn-text)]">{t('chat.noThreadsTitle')}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-ushqn-muted)]">{t('chat.noThreadsHint')}</p>
              </div>
            ) : (
              <>
                {/* Groups */}
                {convList.filter((c) => c.isGroup).length > 0 ? (
                  <>
                    <p className="px-3 pb-1 pt-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--color-ushqn-muted)]">{t('chat.groupsLabel')}</p>
                    {convList.filter((c) => c.isGroup).map((c) => (
                      <ChatConvItem key={c.id} c={c} conversationId={conversationId} i18n={i18n} t={t} nowTs={nowTs} />
                    ))}
                  </>
                ) : null}
                {/* DMs */}
                {convList.filter((c) => !c.isGroup).length > 0 ? (
                  <>
                    <p className="px-3 pb-1 pt-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--color-ushqn-muted)]">{t('chat.dmsLabel')}</p>
                    {convList.filter((c) => !c.isGroup).map((c) => (
                      <ChatConvItem key={c.id} c={c} conversationId={conversationId} i18n={i18n} t={t} nowTs={nowTs} />
                    ))}
                  </>
                ) : null}
              </>
            )}
          </div>
        )}
      </aside>

      {/* Thread */}
      <section
        className={`flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] shadow-md lg:min-h-0 ${
          !conversationId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {!conversationId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="rounded-3xl bg-[var(--color-ushqn-surface-muted)] px-6 py-5 text-4xl">📨</div>
            <p className="text-base font-bold text-[var(--color-ushqn-text)]">{t('chat.selectConversation')}</p>
            <p className="max-w-sm text-sm text-[var(--color-ushqn-muted)]">{t('chat.selectThreadHint')}</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]/60 px-3 py-3">
              <Link
                to="/chat"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] text-sm font-bold text-[var(--color-ushqn-text)] shadow-sm lg:hidden"
              >
                ←
              </Link>
              {activeConv ? (
                <>
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(activeConv.avatarKey)} text-sm font-bold text-white`}
                  >
                    {activeConv.isGroup ? '⎔' : getInitials(activeConv.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[var(--color-ushqn-text)]">{activeConv.displayName}</p>
                    <p className="text-xs font-medium text-[var(--color-ushqn-muted)]">{typingLabel || headerSub}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm font-bold text-[var(--color-ushqn-text)]">{t('chat.chatHeader')}</p>
              )}
            </header>

            <div
              className="relative flex-1 overflow-y-auto px-3 py-4"
              style={{
                backgroundColor: 'var(--color-ushqn-surface-muted)',
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)',
                backgroundSize: '16px 16px',
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 to-transparent dark:from-white/[0.03]" />
              <div className="relative mx-auto max-w-3xl space-y-1">
                {(messagesQuery.data ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <span className="text-4xl">👋</span>
                    <p className="mt-2 text-sm font-medium text-[var(--color-ushqn-muted)]">{t('chat.startChat')}</p>
                  </div>
                ) : null}
                {messagesWithDividers.map((item) => {
                  if (item.type === 'day') {
                    return (
                      <div key={item.key} className="flex justify-center py-3">
                        <span className="rounded-full bg-white/90 px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ushqn-muted)] shadow-sm dark:bg-[#243045] dark:text-[var(--color-ushqn-text)]">
                          {item.label}
                        </span>
                      </div>
                    )
                  }
                  const m = item.msg
                  const isMe = m.sender_id === userId
                  const showRead =
                    isMe &&
                    dmPeerId &&
                    peerReadAt != null &&
                    !Number.isNaN(peerReadAt) &&
                    peerReadAt >= new Date(m.created_at).getTime()
                  const showName = activeConv?.isGroup && !isMe
                  const senderName = nameById.get(m.sender_id) ?? t('chat.unknownPeer')
                  return (
                    <div key={item.key} className={`flex gap-2 py-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMe ? (
                        <div
                          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorFor(m.sender_id)} text-[10px] font-bold text-white`}
                        >
                          {getInitials(senderName)}
                        </div>
                      ) : (
                        <div className="w-8 shrink-0" aria-hidden />
                      )}
                      <div className={`max-w-[min(100%,28rem)] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {showName ? (
                          <span className="px-1 text-[11px] font-bold text-[var(--color-ushqn-muted)]">{senderName}</span>
                        ) : null}
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                            isMe
                              ? 'rounded-tr-md bg-gradient-to-br from-[#0052CC] to-[#0747A6] text-white'
                              : 'rounded-tl-md border border-[var(--color-ushqn-border)] bg-white text-[var(--color-ushqn-text)] dark:bg-[#1e293b]'
                          }`}
                        >
                          {m.reply_to_id ? (
                            (() => {
                              const parent = messageById.get(m.reply_to_id)
                              if (!parent) {
                                return (
                                  <div
                                    className={`mb-2 rounded-lg border-l-2 px-2 py-1.5 text-left text-[11px] ${
                                      isMe ? 'border-white/50 bg-black/15 text-white/90' : 'border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)]'
                                    }`}
                                  >
                                    {t('chat.originalUnavailable')}
                                  </div>
                                )
                              }
                              const pName = nameById.get(parent.sender_id) ?? t('chat.unknownPeer')
                              const line = parent.attachment_url
                                ? t('chat.replyPreviewAttachment', {
                                    name: parent.attachment_name ?? t('chat.attachment'),
                                  })
                                : (() => {
                                    const raw = parent.body?.replace(/\s+/g, ' ').trim() ?? ''
                                    return raw.length > 100 ? `${raw.slice(0, 97)}…` : raw || t('chat.lastMessagePreview')
                                  })()
                              return (
                                <div
                                  className={`mb-2 rounded-lg border-l-2 px-2 py-1.5 text-left text-[11px] leading-snug ${
                                    isMe ? 'border-white/60 bg-black/15' : 'border-[#0052CC] bg-[var(--color-ushqn-surface-muted)]'
                                  }`}
                                >
                                  <span className="font-bold">{pName}</span>
                                  <span className="mt-0.5 block line-clamp-2 opacity-90">{line}</span>
                                </div>
                              )
                            })()
                          ) : null}
                          {m.attachment_url ? (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`mb-1 block text-sm font-semibold underline ${isMe ? 'text-white' : 'text-[#0052CC]'}`}
                            >
                              📎 {sanitizeUserText(m.attachment_name ?? t('chat.attachment'))}
                            </a>
                          ) : null}
                          {m.body ? <span className="whitespace-pre-wrap break-words">{sanitizeUserText(m.body)}</span> : null}
                        </div>
                        <span className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-[var(--color-ushqn-muted)]">
                          {formatClock(m.created_at, i18n.language)}
                          {showRead ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t('chat.readReceipt')}</span> : null}
                          <button
                            type="button"
                            className="font-semibold text-[#0052CC] hover:underline"
                            onClick={() => setReplyDraft(m)}
                          >
                            {t('chat.reply')}
                          </button>
                          {isMe ? (
                            <button
                              type="button"
                              className="font-semibold text-red-400 hover:underline"
                              onClick={() => deleteMsg.mutate(m.id)}
                            >
                              {t('common.delete')}
                            </button>
                          ) : null}
                          {!isMe && userId ? (
                            <button
                              type="button"
                              className="font-semibold text-red-500 hover:underline"
                              onClick={() => setReportMessageId(m.id)}
                            >
                              {t('trust.report.open')}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="border-t border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface)] p-3">
              {pendingFile ? (
                <p className="mb-2 text-xs text-[var(--color-ushqn-muted)]">
                  {t('chat.pendingFile')}: <span className="font-semibold text-[var(--color-ushqn-text)]">{pendingFile.name}</span>
                  <button type="button" className="ml-2 font-bold text-red-600" onClick={() => setPendingFile(null)}>
                    {t('common.cancel')}
                  </button>
                </p>
              ) : null}
              {replyDraft ? (
                <div className="mx-auto mb-2 flex max-w-3xl items-stretch gap-2 rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] p-2">
                  <div className="min-w-0 flex-1 border-l-2 border-[#0052CC] pl-2">
                    <p className="text-[11px] font-bold text-[var(--color-ushqn-muted)]">
                      {t('chat.replyingTo', { name: nameById.get(replyDraft.sender_id) ?? t('chat.unknownPeer') })}
                    </p>
                    <p className="line-clamp-2 text-xs text-[var(--color-ushqn-text)]">{replyComposerPreview(replyDraft, t)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyDraft(null)}
                    className="shrink-0 rounded-lg px-2 text-lg leading-none text-[var(--color-ushqn-muted)] transition hover:bg-[var(--color-ushqn-surface)] hover:text-[var(--color-ushqn-text)]"
                    aria-label={t('chat.cancelReply')}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <div className="mx-auto flex max-w-3xl items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] text-lg transition hover:bg-[var(--color-ushqn-surface)] active:scale-95"
                  title={t('chat.attachFile')}
                >
                  📎
                </button>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={1}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send.mutate()
                    }
                  }}
                  placeholder={t('chat.messagePlaceholder')}
                  autoComplete="off"
                  className="min-h-[2.75rem] min-w-0 flex-1 resize-none rounded-2xl border border-[var(--color-ushqn-border)] bg-[var(--color-ushqn-surface-muted)] px-4 py-2.5 text-sm leading-snug text-[var(--color-ushqn-text)] outline-none transition focus:border-[#0052CC] focus:bg-[var(--color-ushqn-surface)] focus:ring-2 focus:ring-[#0052CC]/20"
                />
                <button
                  type="button"
                  onClick={() => send.mutate()}
                  disabled={send.isPending || (!body.trim() && !pendingFile)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0052CC] text-white shadow-lg shadow-[#0052CC]/25 transition hover:bg-[#0747A6] active:scale-95 disabled:opacity-50"
                  title={t('chat.send')}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 translate-x-px">
                    <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.289Z" />
                  </svg>
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
