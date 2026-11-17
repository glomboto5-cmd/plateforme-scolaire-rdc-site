import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } from 'react-native-webrtc';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar } from '../components/ui';
import { avatarUri } from '../lib/chat';
import { MEETING_MAX } from '../lib/meeting';

// Réunion internationale (points 17 à 21) : chaque participant est relié directement aux autres (maillage WebRTC).
function iceServers() {
  const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  if (extra.turn && extra.turn.urls) list.push(extra.turn);
  return list;
}

function fmt(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export default function MeetingScreen({ route, navigation }) {
  const { callId, media, organizerId, title, incoming, organizerName } = route.params;
  const { userId, profile } = useApp();
  const insets = useSafeAreaInsets();
  const isOrganizer = organizerId === userId;
  const [joined, setJoined] = useState(!incoming);
  const [members, setMembers] = useState({}); // id -> { name, avatar, mic, cam, role }
  const [streams, setStreams] = useState({}); // id -> MediaStream
  const [localStream, setLocalStream] = useState(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(media === 'video');
  const [seconds, setSeconds] = useState(0);
  const [showList, setShowList] = useState(false);
  const [ended, setEnded] = useState('');

  const pcs = useRef({});
  const pending = useRef({});
  const channel = useRef(null);
  const local = useRef(null);
  const left = useRef(false);
  const timer = useRef(null);
  const me = useRef({ mic: true, cam: media === 'video' });
  const membersRef = useRef({});

  const send = (payload) => channel.current && channel.current.send({ type: 'broadcast', event: 'signal', payload: { ...payload, from: userId } });
  const control = (payload) => channel.current && channel.current.send({ type: 'broadcast', event: 'control', payload: { ...payload, from: userId } });

  const myInfo = () => ({
    id: userId,
    name: (profile && profile.display_name) || '?',
    avatar: avatarUri(profile),
    mic: me.current.mic,
    cam: me.current.cam,
    role: isOrganizer ? 'organizer' : 'participant',
  });

  const askPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (media === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    const res = await PermissionsAndroid.requestMultiple(perms);
    return perms.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  };

  const getLocal = async () => {
    if (local.current) return local.current;
    if (!(await askPermissions())) throw new Error(L('Autorisez le micro (et la caméra) pour participer.', 'Allow microphone (and camera).'));
    const s = await mediaDevices.getUserMedia({ audio: true, video: media === 'video' ? { facingMode: 'user', width: 480, height: 360, frameRate: 20 } : false });
    local.current = s;
    setLocalStream(s);
    return s;
  };

  const closePeer = (id) => {
    try { pcs.current[id] && pcs.current[id].close(); } catch (e) {}
    delete pcs.current[id];
    delete pending.current[id];
    setStreams((x) => { const n = { ...x }; delete n[id]; return n; });
  };

  const makePeer = async (id) => {
    if (pcs.current[id]) return pcs.current[id];
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    pcs.current[id] = pc;
    const s = await getLocal();
    s.getTracks().forEach((tr) => pc.addTrack(tr, s));
    pc.addEventListener('icecandidate', (e) => { if (e.candidate) send({ to: id, kind: 'ice', data: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); });
    pc.addEventListener('track', (e) => { if (e.streams && e.streams[0]) setStreams((x) => ({ ...x, [id]: e.streams[0] })); });
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') closePeer(id); });
    return pc;
  };

  const flush = async (id) => {
    const list = pending.current[id] || [];
    pending.current[id] = [];
    for (const c of list) { try { await pcs.current[id].addIceCandidate(new RTCIceCandidate(c)); } catch (e) {} }
  };

  // Le participant dont l'identifiant est le plus petit lance la connexion (évite les doublons)
  const connectTo = async (id) => {
    if (id === userId || pcs.current[id] || !(userId < id)) return;
    const pc = await makePeer(id);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    send({ to: id, kind: 'offer', data: { sdp: offer.sdp, type: offer.type } });
  };

  const leave = async (reason, endForAll) => {
    if (left.current) return;
    left.current = true;
    if (endForAll) control({ action: 'end' });
    try { channel.current && (await channel.current.untrack()); } catch (e) {}
    Object.keys(pcs.current).forEach(closePeer);
    try { local.current && local.current.getTracks().forEach((tr) => tr.stop()); } catch (e) {}
    if (channel.current) supabase.removeChannel(channel.current);
    channel.current = null;
    clearInterval(timer.current);
    supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('call_id', callId).eq('user_id', userId).then(() => {});
    if (endForAll || Object.keys(membersRef.current).filter((k) => k !== userId).length === 0) {
      supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId).then(() => {});
    }
    setEnded(reason || L('Vous avez quitté la réunion', 'You left the meeting'));
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200);
  };

  useEffect(() => {
    if (!joined) return;
    let alive = true;
    (async () => {
      try {
        await getLocal();
      } catch (e) {
        Alert.alert(L('Réunion', 'Meeting'), e.message);
        return navigation.goBack();
      }
      if (!alive) return;
      const ch = supabase.channel('meet-' + callId, { config: { broadcast: { self: false }, presence: { key: userId } } });
      channel.current = ch;

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        const next = {};
        Object.keys(state).forEach((id) => { const meta = state[id] && state[id][0]; if (meta) next[id] = meta; });
        setMembers(next);
        membersRef.current = next;
        Object.keys(next).forEach((id) => connectTo(id));
        Object.keys(pcs.current).forEach((id) => { if (!next[id]) closePeer(id); });
        if (Object.keys(next).length > MEETING_MAX && !next[userId]) leave(L('La réunion est complète', 'Meeting is full'));
      });

      ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || payload.to !== userId) return;
        const id = payload.from;
        try {
          if (payload.kind === 'offer') {
            const pc = await makePeer(id);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ to: id, kind: 'answer', data: { sdp: answer.sdp, type: answer.type } });
            flush(id);
          } else if (payload.kind === 'answer' && pcs.current[id]) {
            await pcs.current[id].setRemoteDescription(new RTCSessionDescription(payload.data));
            flush(id);
          } else if (payload.kind === 'ice') {
            const pc = pcs.current[id];
            if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(new RTCIceCandidate(payload.data)); } catch (e) {} }
            else (pending.current[id] = pending.current[id] || []).push(payload.data);
          }
        } catch (e) {}
      });

      ch.on('broadcast', { event: 'control' }, ({ payload }) => {
        if (!payload || payload.from !== organizerId) return; // seul l'organisateur commande
        if (payload.action === 'end') leave(L("L'organisateur a terminé la réunion", 'The organizer ended the meeting'));
        if (payload.action === 'mute' && (!payload.to || payload.to === userId)) {
          const tr = local.current && local.current.getAudioTracks()[0];
          if (tr) tr.enabled = false;
          me.current.mic = false;
          setMic(false);
          ch.track(myInfo());
        }
        if (payload.action === 'remove' && payload.to === userId) leave(L("L'organisateur vous a retiré de la réunion", 'You were removed'));
      });

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track(myInfo());
          supabase.from('call_participants').upsert({ call_id: callId, user_id: userId, joined_at: new Date().toISOString(), left_at: null }, { onConflict: 'call_id,user_id' }).then(() => {});
          supabase.from('calls').update({ status: 'ongoing' }).eq('id', callId).eq('status', 'ringing').then(() => {});
        }
      });
      timer.current = setInterval(() => setSeconds((x) => x + 1), 1000);
    })();
    return () => {
      alive = false;
      if (!left.current) leave();
    };
  }, [joined]);

  const toggleMic = () => {
    const tr = local.current && local.current.getAudioTracks()[0];
    if (!tr) return;
    tr.enabled = !mic;
    me.current.mic = !mic;
    setMic(!mic);
    channel.current && channel.current.track(myInfo());
  };
  const toggleCam = () => {
    const tr = local.current && local.current.getVideoTracks()[0];
    if (!tr) return;
    tr.enabled = !cam;
    me.current.cam = !cam;
    setCam(!cam);
    channel.current && channel.current.track(myInfo());
  };
  const switchCam = () => {
    const tr = local.current && local.current.getVideoTracks()[0];
    if (tr && tr._switchCamera) tr._switchCamera();
  };

  const memberActions = (m) => {
    if (!isOrganizer || m.id === userId) return;
    Alert.alert(m.name, '', [
      { text: L('Couper son micro', 'Mute'), onPress: () => control({ action: 'mute', to: m.id }) },
      { text: L('Retirer de la réunion', 'Remove'), style: 'destructive', onPress: () => control({ action: 'remove', to: m.id }) },
      { text: L('Annuler', 'Cancel'), style: 'cancel' },
    ]);
  };

  // Écran d'invitation (réunion entrante)
  if (!joined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B141A', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Text style={{ fontSize: 60 }}>{media === 'video' ? '📹' : '📞'}</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>{title || L('Réunion', 'Meeting')}</Text>
        <Text style={{ color: '#D1D7DB', fontSize: 16, marginTop: 8, textAlign: 'center' }}>
          {L('Réunion internationale', 'International meeting')} · {L('Organisateur', 'Organizer')} : {organizerName || '—'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 50, marginTop: 50 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#D93025', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>✕</Text>
          </Pressable>
          <Pressable onPress={() => setJoined(true)} style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#1DAA61', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28 }}>{media === 'video' ? '📹' : '📞'}</Text>
          </Pressable>
        </View>
        <Text style={{ color: '#D1D7DB', marginTop: 14 }}>{L('Rejoindre', 'Join')}</Text>
      </View>
    );
  }

  const list = Object.values(members).sort((a, b) => (a.role === 'organizer' ? -1 : b.role === 'organizer' ? 1 : a.name.localeCompare(b.name)));
  const others = list.filter((m) => m.id !== userId);
  const tiles = [{ ...myInfo(), self: true }, ...others];
  const cols = tiles.length <= 2 ? 1 : 2;

  const Tile = ({ m }) => {
    const stream = m.self ? localStream : streams[m.id];
    const showVideo = media === 'video' && stream && m.cam !== false && (m.self ? cam : true);
    return (
      <Pressable onLongPress={() => memberActions(m)} style={{ flex: 1, margin: 3, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1F2C34', minHeight: tiles.length <= 2 ? 260 : 170, alignItems: 'center', justifyContent: 'center' }}>
        {showVideo ? (
          <RTCView streamURL={stream.toURL()} mirror={!!m.self} objectFit="cover" zOrder={m.self ? 1 : 0} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        ) : (
          <Avatar uri={m.avatar} name={m.name} size={tiles.length <= 2 ? 96 : 64} />
        )}
        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
            {m.mic === false ? '🔇 ' : '🎙 '}
            {m.self ? L('Vous', 'You') : m.name}
            {m.role === 'organizer' ? ' · ' + L('Organisateur', 'Organizer') : ''}
          </Text>
        </View>
        {!m.self && !stream ? <Text style={{ position: 'absolute', top: 8, right: 10, color: '#D1D7DB', fontSize: 12 }}>{L('connexion…', 'connecting…')}</Text> : null}
      </Pressable>
    );
  };

  const Btn = ({ icon, label, onPress, bg = 'rgba(255,255,255,0.15)' }) => (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: 64 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={{ color: '#D1D7DB', fontSize: 11, marginTop: 4 }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0B141A', paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{title || L('Réunion internationale', 'International meeting')}</Text>
        <Text style={{ color: '#D1D7DB', fontSize: 13 }}>
          🔒 {list.length || 1} {L('participant(s)', 'participant(s)')} · {fmt(seconds)}{isOrganizer ? ' · ' + L('Vous êtes l’organisateur', 'You are the organizer') : ''}
        </Text>
      </View>

      {ended ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18 }}>{ended}</Text>
        </View>
      ) : (
        <FlatList
          key={cols}
          data={tiles}
          numColumns={cols}
          keyExtractor={(m) => m.id + (m.self ? '-me' : '')}
          contentContainerStyle={{ padding: 4 }}
          renderItem={({ item }) => <Tile m={item} />}
        />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, paddingBottom: insets.bottom + 16, backgroundColor: '#111B21' }}>
        <Btn icon={mic ? '🎙' : '🔇'} label={mic ? L('Micro actif', 'Mic on') : L('Micro coupé', 'Muted')} onPress={toggleMic} />
        {media === 'video' ? <Btn icon={cam ? '📷' : '🚫'} label={L('Caméra', 'Camera')} onPress={toggleCam} /> : null}
        {media === 'video' ? <Btn icon="🔄" label={L('Retourner', 'Flip')} onPress={switchCam} /> : null}
        <Btn icon="👥" label={L('Participants', 'People')} onPress={() => setShowList(true)} />
        <Btn icon="📵" label={L('Quitter', 'Leave')} bg="#D93025" onPress={() => leave()} />
      </View>

      <Modal visible={showList} transparent animationType="slide" onRequestClose={() => setShowList(false)}>
        <Pressable onPress={() => setShowList(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: '#1F2C34', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: insets.bottom + 16, maxHeight: '70%' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 10 }}>{L('Participants', 'Participants')} ({list.length})</Text>
            <ScrollView>
              {list.map((m) => (
                <Pressable key={m.id} onPress={() => memberActions(m)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <Avatar uri={m.avatar} name={m.name} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 16 }}>{m.id === userId ? L('Vous', 'You') : m.name}</Text>
                    <Text style={{ color: '#8696A0', fontSize: 13 }}>{m.role === 'organizer' ? L('Organisateur', 'Organizer') : L('Participant', 'Participant')}</Text>
                  </View>
                  <Text style={{ fontSize: 18 }}>{m.mic === false ? '🔇' : '🎙'}{media === 'video' ? (m.cam === false ? ' 🚫' : ' 📷') : ''}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {isOrganizer ? (
              <View style={{ gap: 10, marginTop: 12 }}>
                <Pressable onPress={() => control({ action: 'mute' })} style={{ padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>🔇 {L('Couper le micro de tous', 'Mute everyone')}</Text>
                </Pressable>
                <Pressable onPress={() => { setShowList(false); leave(L('Réunion terminée', 'Meeting ended'), true); }} style={{ padding: 14, borderRadius: 12, backgroundColor: '#D93025', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Terminer la réunion pour tous', 'End meeting for all')}</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={{ color: '#8696A0', fontSize: 12, marginTop: 12 }}>
              {L(`Jusqu’à ${MEETING_MAX} participants. Appui long sur un participant : couper son micro ou le retirer (organisateur).`, `Up to ${MEETING_MAX} participants.`)}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
