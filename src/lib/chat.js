import { supabase } from './supabase';
import { publicUrl } from './upload';

export const PROFILE_FIELDS = 'id,display_name,avatar_url,handle,about,is_business,business_name';

export function avatarUri(p) {
  if (!p || !p.avatar_url) return null;
  return p.avatar_url.startsWith('http') ? p.avatar_url : publicUrl('avatars', p.avatar_url);
}

// Charge toutes mes discussions avec leurs participants
export async function loadConversations(userId) {
  const { data: mine, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id,is_pinned,is_archived,last_read_at,muted_until,cleared_at')
    .eq('user_id', userId);
  if (error) throw error;
  const ids = (mine || []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const { data: convs, error: e2 } = await supabase
    .from('conversations')
    .select(
      'id,type,title,description,avatar_url,ephemeral_mode,ephemeral_seconds,last_message_at,created_at,' +
        'conversation_participants(user_id,role,profiles!conversation_participants_user_id_fkey(' + PROFILE_FIELDS + '))'
    )
    .in('id', ids);
  if (e2) throw e2;
  // Dernier message de chaque discussion
  const lastById = {};
  await Promise.all(
    (convs || []).map(async (c) => {
      const { data } = await supabase
        .from('messages')
        .select('id,type,content,sender_id,created_at,deleted_for_all_at')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);
      lastById[c.id] = data && data[0];
    })
  );
  const meta = Object.fromEntries((mine || []).map((m) => [m.conversation_id, m]));
  return (convs || [])
    .map((c) => decorate(c, userId, meta[c.id], lastById[c.id]))
    .sort((a, b) => (b.pinned - a.pinned) || String(b.sortAt).localeCompare(String(a.sortAt)));
}

export function decorate(c, userId, meta, last) {
  const parts = c.conversation_participants || [];
  const other = c.type === 'direct' ? (parts.find((p) => p.user_id !== userId) || {}).profiles : null;
  const me = parts.find((p) => p.user_id === userId);
  const unread = last && last.sender_id !== userId && (!meta || !meta.last_read_at || last.created_at > meta.last_read_at);
  return {
    ...c,
    participants: parts,
    other,
    myRole: me ? me.role : null,
    name: c.type === 'direct' ? (other ? other.display_name : '?') : c.title || 'Groupe',
    avatar: c.type === 'direct' ? avatarUri(other) : c.avatar_url,
    last,
    unread: !!unread,
    pinned: meta && meta.is_pinned ? 1 : 0,
    sortAt: (last && last.created_at) || c.last_message_at || c.created_at,
  };
}

export async function loadConversation(convId, userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id,type,title,description,avatar_url,ephemeral_mode,ephemeral_seconds,last_message_at,created_at,' +
        'conversation_participants(user_id,role,joined_at,profiles!conversation_participants_user_id_fkey(' + PROFILE_FIELDS + '))'
    )
    .eq('id', convId)
    .maybeSingle();
  if (error) throw error;
  return data ? decorate(data, userId, null, null) : null;
}

export async function searchProfiles(q, userId) {
  const clean = (q || '').replace(/[,()%*]/g, ' ').trim();
  if (clean.length < 2) return [];
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .or(`display_name.ilike.%${clean}%,handle.ilike.%${clean}%,business_name.ilike.%${clean}%`)
    .neq('id', userId)
    .limit(30);
  return data || [];
}

export function formatTime(iso, t) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return hh;
  if (d.toDateString() === y.toDateString()) return t('yesterday');
  return d.toLocaleDateString();
}

export function preview(msg, t, tSystem, userId) {
  if (!msg) return '';
  if (msg.deleted_for_all_at) return t('deletedMsg');
  if (msg.type === 'system') return tSystem(msg.content);
  const prefix = msg.sender_id === userId ? t('you') + ' : ' : '';
  if (msg.type === 'image') return prefix + '📷 ' + t('photo');
  if (msg.type === 'document') return prefix + '📄 ' + (msg.content || t('document'));
  return prefix + (msg.content || '');
}
