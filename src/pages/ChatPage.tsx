import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { sanitizeUserText } from '../lib/sanitize'
import { uploadPublicFile } from '../lib/upload'
import { ContentReportDialog } from '../components/ContentReportDialog'
import { useToast } from '../lib/toast'

type ConvRow = {
  id: string
  created_at: string
  peer_name: string
  peer_id: string
}

type MsgRow = {
  id: string
  body: string | null
  sender_id: string
  created_at: string
  attachment_url: string | null
  attachment_name: string | null
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(iso: string, locale: string) {
  try {
    const d = new Date(iso)
    const tag = locale.startsWith('en') ? 'en-US' : locale.startsWith('kk') ? 'kk-KZ' : 'ru-RU'
    return d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const AVATAR_COLORS = [
  'from-[#0052CC] to-[#2684FF]',
  'from-[#00875A] to-[#36B37E]',
  'from-[#6554C0] to-[#8777D9]',
  'from-[#FF5630] to-[#FF8B00]',
  'from-[#00B8D9] to-[#79E2F2]',
]

function colorFor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ChatPage() {
  const { t, i18n } = useTranslation()
  const { conversationId } = useParams<{ conversationId?: string }>()
  const { userId } = useAuth()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [reportMessageId, setReportMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const conversationsQuery = useQuery({
    queryKey: ['conversations', userId, i18n.language],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ConvRow[]> => {
      const { data: parts, error: e1 } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId!)
      if (e1) throw e1
      const convIds = [...new Set((parts ?? []).map((p) => p.conversation_id))]
      if (!convIds.length) return []

      const { data: allParts, error: e2 } = await supabase
        .from('conversation_participants')
        .select('conversation_id,user_id')
        .in('conversation_id', convIds)
      if (e2) throw e2

      const peerByConv = new Map<string, string>()
      for (const row of allParts ?? []) {
        if (row.user_id === userId) continue
        peerByConv.set(row.conversation_id, row.user_id)
      }

      const peerIds = [...new Set(peerByConv.values())]
      const { data: profs, error: e3 } = await supabase
        .from('profiles')
        .select('id,display_name')
        .in('id', peerIds)
      if (e3) throw e3
      const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]))

      return convIds.map((id) => {
        const peer = peerByConv.get(id)!
        return {
          id,
          created_at: '',
          peer_id: peer,
          peer_name: names.get(peer) ?? t('chat.unknownPeer'),
        }
      })
    },
  })

  const activeConv = useMemo(() => {
    return (conversationsQuery.data ?? []).find((c) => c.id === conversationId)
  }, [conversationsQuery.data, conversationId])

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    enabled: Boolean(userId && conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id,body,sender_id,created_at,attachment_url,attachment_name')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MsgRow[]
    },
  })

  const peerReadQuery = useQuery({
    queryKey: ['conv-peer-read', conversationId, activeConv?.peer_id],
    enabled: Boolean(conversationId && userId && activeConv?.peer_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('last_read_at')
        .eq('conversation_id', conversationId!)
        .eq('user_id', activeConv!.peer_id)
        .maybeSingle()
      if (error) throw error
      return data?.last_read_at ?? null
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesQuery.data])

  useEffect(() => {
    if (!conversationId || !userId || !(messagesQuery.data?.length)) return
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
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['messages', conversationId] })
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
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['conv-peer-read', conversationId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, qc])

  const { toast } = useToast()

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
      })
      if (error) throw error
    },
    onSuccess: () => {
      setBody('')
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      void qc.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    onError: () => {
      toast(t('chat.sendFailed'), 'error')
    },
  })

  const peerReadAt = peerReadQuery.data ? new Date(peerReadQuery.data).getTime() : null

  return (
    <div className="grid gap-4 lg:grid-cols-3" style={{ height: 'calc(100vh - 6rem)' }}>
      <ContentReportDialog
        open={Boolean(reportMessageId)}
        onClose={() => setReportMessageId(null)}
        targetType="message"
        targetId={reportMessageId ?? ''}
      />
      {/* Sidebar */}
      <aside className="ushqn-card flex flex-col overflow-hidden lg:col-span-1">
        <div className="border-b border-[#eef1f4] px-4 py-3.5">
          <h2 className="text-base font-bold text-[#172B4D]">{t('chat.sidebarTitle')}</h2>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-[#f4f5f7]">
          {(conversationsQuery.data ?? []).length === 0 ? (
            <li className="flex flex-col items-center justify-center py-10 text-center px-4">
              <span className="text-3xl">💬</span>
              <p className="mt-2 text-sm font-medium text-[#172B4D]">{t('chat.noThreadsTitle')}</p>
              <p className="mt-1 text-xs text-[#6B778C]">{t('chat.noThreadsHint')}</p>
            </li>
          ) : (
            (conversationsQuery.data ?? []).map((c) => {
              const isActive = c.id === conversationId
              const grad = colorFor(c.peer_id)
              return (
                <li key={c.id}>
                  <Link
                    to={`/chat/${c.id}`}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isActive ? 'bg-[#DEEBFF]' : 'hover:bg-[#f4f5f7]'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-sm font-bold text-white`}
                    >
                      {getInitials(c.peer_name)}
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isActive ? 'text-[#0052CC]' : 'text-[#172B4D]'}`}>
                        {c.peer_name}
                      </p>
                      <p className="truncate text-xs text-[#6B778C]">{t('chat.openThreadHint')}</p>
                    </div>
                    {isActive ? <div className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#0052CC]" /> : null}
                  </Link>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      {/* Chat area */}
      <section className="ushqn-card flex flex-col overflow-hidden lg:col-span-2">
        {!conversationId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#DEEBFF] text-3xl">
              💬
            </div>
            <p className="text-base font-semibold text-[#172B4D]">{t('chat.selectConversation')}</p>
            <p className="text-sm text-[#6B778C]">{t('chat.selectThreadHint')}</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[#eef1f4] px-5 py-3.5">
              {activeConv ? (
                <>
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(activeConv.peer_id)} text-sm font-bold text-white`}
                  >
                    {getInitials(activeConv.peer_name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#172B4D]">{activeConv.peer_name}</p>
                    <p className="text-xs text-[#36B37E]">{t('chat.onlineStatus')}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm font-bold text-[#172B4D]">{t('chat.chatHeader')}</p>
              )}
            </header>

            <div
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
              style={{ background: 'linear-gradient(180deg, #f8f9fc 0%, #fff 100%)' }}
            >
              {(messagesQuery.data ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                  <span className="text-3xl">👋</span>
                  <p className="mt-2 text-sm text-[#6B778C]">{t('chat.startChat')}</p>
                </div>
              ) : null}
              {(messagesQuery.data ?? []).map((m) => {
                const isMe = m.sender_id === userId
                const showRead =
                  isMe &&
                  peerReadAt != null &&
                  !Number.isNaN(peerReadAt) &&
                  peerReadAt >= new Date(m.created_at).getTime()
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isMe && activeConv ? (
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(activeConv.peer_id)} text-xs font-bold text-white`}
                      >
                        {getInitials(activeConv.peer_name)}
                      </div>
                    ) : null}
                    <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                          isMe
                            ? 'rounded-br-sm bg-[#0052CC] text-white'
                            : 'rounded-bl-sm bg-white text-[#172B4D] border border-[#eef1f4]'
                        }`}
                      >
                        {m.attachment_url ? (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`mb-1 block font-semibold underline ${isMe ? 'text-white' : 'text-[#0052CC]'}`}
                          >
                            📎 {sanitizeUserText(m.attachment_name ?? t('chat.attachment'))}
                          </a>
                        ) : null}
                        {m.body ? <span className="whitespace-pre-wrap break-words">{sanitizeUserText(m.body)}</span> : null}
                      </div>
                      <span className="flex flex-wrap items-center gap-2 text-[10px] text-[#97a0af]">
                        {formatTime(m.created_at, i18n.language)}
                        {showRead ? <span className="font-semibold text-[#36B37E]">{t('chat.readReceipt')}</span> : null}
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

            <footer className="border-t border-[#eef1f4] bg-white px-4 py-3">
              {pendingFile ? (
                <p className="mb-2 text-xs text-[#6B778C]">
                  {t('chat.pendingFile')}: <span className="font-semibold text-[#172B4D]">{pendingFile.name}</span>
                  <button type="button" className="ml-2 font-bold text-red-600" onClick={() => setPendingFile(null)}>
                    {t('common.cancel')}
                  </button>
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DFE1E6] text-lg text-[#6B778C] hover:bg-[#f4f5f7]"
                  title={t('chat.attachFile')}
                >
                  📎
                </button>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send.mutate()
                    }
                  }}
                  placeholder={t('chat.messagePlaceholder')}
                  autoComplete="off"
                  enterKeyHint="send"
                  className="min-w-0 flex-1 rounded-full border border-[#DFE1E6] bg-[#f4f5f7] px-4 py-2.5 text-sm outline-none transition focus:border-[#0052CC] focus:bg-white focus:ring-2 focus:ring-[#0052CC]/20"
                />
                <button
                  type="button"
                  onClick={() => send.mutate()}
                  disabled={send.isPending || (!body.trim() && !pendingFile)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0052CC] text-white shadow-sm transition hover:bg-[#0747A6] active:scale-95 disabled:opacity-50"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 translate-x-0.5">
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
