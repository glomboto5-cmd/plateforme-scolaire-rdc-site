import React, { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } from 'react-native-webrtc';
import { supabase } from '../lib/supabase';
import { L } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Avatar } from '../components/ui';

// Serveurs de connexion. Un serveur relais (TURN) peut être ajouté dans app.json → extra.turn
function iceServers() {
  const extra = (Constants.expoConfig && Constants.expoConfig.extra) || {};
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  if (extra.turn && extra.turn.urls) list.push(extra.turn);
  return list;
}

const RING_TIMEOUT = 45000;

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export default function CallScreen({ route, navigation }) {
  const { callId, media, incoming, peerName, peerAvatar } = route.params;
  const { userId } = useApp();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState(incoming ? 'incoming' : 'calling'); // incoming | calling | connecting | ongoing | ended
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [endReason, setEndReason] = useState('');

  const pc = useRef(null);
  const channel = useRef(null);
  const local = useRef(null);
  const pending = useRef([]);
  const ended = useRef(false);
  const ringTimer = useRef(null);
  const tick = useRef(null);
  const video = media === 'video';

  const send = (event, payload) => channel.current && channel.current.send({ type: 'broadcast', event, payload: payload || {} });

  const askPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (video) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    const res = await PermissionsAndroid.requestMultiple(perms);
    return perms.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  };

  const getLocal = async () => {
    if (local.current) return local.current;
    const ok = await askPermissions();
    if (!ok) throw new Error(L('Autorisez le micro (et la caméra) pour appeler.', 'Allow microphone (and camera) to call.'));
    const s = await mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false });
    local.current = s;
    setLocalStream(s);
    return s;
  };

  const makePeer = async () => {
    const p = new RTCPeerConnection({ iceServers: iceServers() });
    pc.current = p;
    const s = await getLocal();
    s.getTracks().forEach((tr) => p.addTrack(tr, s));
    p.addEventListener('icecandidate', (e) => { if (e.candidate) send('ice', { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); });
    p.addEventListener('track', (e) => { if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]); });
    p.addEventListener('connectionstatechange', () => {
      const st = p.connectionState;
      if (st === 'connected') startTimer();
      if (st === 'failed') finish(L('Connexion impossible avec ce réseau', 'Could not connect on this network'), 'failed');
    });
    return p;
  };

  const flush = async () => {
    const list = pending.current;
    pending.current = [];
    for (const c of list) {
      try { await pc.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
    }
  };

  const startTimer = () => {
    if (tick.current) return;
    setPhase('ongoing');
    clearTimeout(ringTimer.current);
    tick.current = setInterval(() => setSeconds((x) => x + 1), 1000);
  };

  const cleanup = () => {
    clearTimeout(ringTimer.current);
    clearInterval(tick.current);
    try { local.current && local.current.getTracks().forEach((tr) => tr.stop()); } catch (e) {}
    try { pc.current && pc.current.close(); } catch (e) {}
    if (channel.current) supabase.removeChannel(channel.current);
    channel.current = null;
  };

  const finish = async (reason, status, notify = true) => {
    if (ended.current) return;
    ended.current = true;
    if (notify) send(status === 'declined' ? 'decline' : 'hangup');
    setEndReason(reason || '');
    setPhase('ended');
    const patch = { status: status || 'ended', ended_at: new Date().toISOString() };
    await supabase.from('calls').update(patch).eq('id', callId);
    supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('call_id', callId).eq('user_id', userId).then(() => {});
    cleanup();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500);
  };

  useEffect(() => {
    const ch = supabase.channel('call-' + callId, { config: { broadcast: { self: false } } });
    channel.current = ch;

    ch.on('broadcast', { event: 'accept' }, async () => {
      if (incoming || ended.current) return;
      try {
        setPhase('connecting');
        const p = await makePeer();
        const offer = await p.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
        await p.setLocalDescription(offer);
        send('offer', { sdp: offer.sdp, type: offer.type });
      } catch (e) {
        finish(e.message, 'failed');
      }
    });

    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (!incoming || !pc.current) return;
      await pc.current.setRemoteDescription(new RTCSessionDescription(payload));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      send('answer', { sdp: answer.sdp, type: answer.type });
      flush();
    });

    ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (incoming || !pc.current) return;
      await pc.current.setRemoteDescription(new RTCSessionDescription(payload));
      flush();
    });

    ch.on('broadcast', { event: 'ice' }, async ({ payload }) => {
      if (!payload || !payload.candidate) return;
      if (pc.current && pc.current.remoteDescription) {
        try { await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (e) {}
      } else {
        pending.current.push(payload.candidate);
      }
    });

    ch.on('broadcast', { event: 'hangup' }, () => finish(L('Appel terminé', 'Call ended'), 'ended', false));
    ch.on('broadcast', { event: 'decline' }, () => finish(L('Appel refusé', 'Call declined'), 'declined', false));

    ch.subscribe();

    if (!incoming) {
      getLocal().catch((e) => finish(e.message, 'failed'));
      ringTimer.current = setTimeout(() => finish(L('Pas de réponse', 'No answer'), 'missed'), RING_TIMEOUT);
    } else {
      ringTimer.current = setTimeout(() => finish(L('Appel manqué', 'Missed call'), 'missed', false), RING_TIMEOUT);
    }

    return () => {
      if (!ended.current) {
        ended.current = true;
        send('hangup');
        supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId).then(() => {});
      }
      cleanup();
    };
  }, []);

  const accept = async () => {
    try {
      clearTimeout(ringTimer.current);
      setPhase('connecting');
      await makePeer();
      await supabase.from('calls').update({ status: 'ongoing', answered_at: new Date().toISOString() }).eq('id', callId);
      await supabase.from('call_participants').upsert({ call_id: callId, user_id: userId, joined_at: new Date().toISOString() }, { onConflict: 'call_id,user_id' });
      send('accept');
    } catch (e) {
      Alert.alert(L('Appel', 'Call'), e.message);
      finish(e.message, 'failed');
    }
  };

  const toggleMute = () => {
    const tr = local.current && local.current.getAudioTracks()[0];
    if (tr) { tr.enabled = muted; setMuted(!muted); }
  };
  const toggleCam = () => {
    const tr = local.current && local.current.getVideoTracks()[0];
    if (tr) { tr.enabled = camOff; setCamOff(!camOff); }
  };
  const switchCam = () => {
    const tr = local.current && local.current.getVideoTracks()[0];
    if (tr && tr._switchCamera) tr._switchCamera();
  };

  const label =
    phase === 'incoming' ? (video ? L('Appel vidéo entrant', 'Incoming video call') : L('Appel vocal entrant', 'Incoming voice call'))
    : phase === 'calling' ? L('Appel en cours…', 'Calling…')
    : phase === 'connecting' ? L('Connexion…', 'Connecting…')
    : phase === 'ongoing' ? fmt(seconds)
    : endReason || L('Appel terminé', 'Call ended');

  const Btn = ({ icon, onPress, bg = 'rgba(255,255,255,0.18)', size = 60 }) => (
    <Pressable onPress={onPress} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42 }}>{icon}</Text>
    </Pressable>
  );

  const showRemoteVideo = video && remoteStream && phase === 'ongoing';

  return (
    <View style={{ flex: 1, backgroundColor: '#0B141A' }}>
      {showRemoteVideo ? (
        <RTCView streamURL={remoteStream.toURL()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} objectFit="cover" />
      ) : null}
      {video && localStream && !camOff && phase !== 'ended' ? (
        <RTCView
          streamURL={localStream.toURL()}
          mirror
          zOrder={1}
          objectFit="cover"
          style={showRemoteVideo
            ? { position: 'absolute', width: 110, height: 160, right: 16, top: insets.top + 16, borderRadius: 12, overflow: 'hidden' }
            : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 }}
        />
      ) : null}

      <View style={{ alignItems: 'center', paddingTop: insets.top + 60 }}>
        {!showRemoteVideo ? <Avatar uri={peerAvatar} name={peerName} size={110} /> : null}
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 18 }}>{peerName}</Text>
        <Text style={{ color: '#D1D7DB', fontSize: 16, marginTop: 6 }}>🔒 {label}</Text>
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 40, alignItems: 'center' }}>
        {phase === 'incoming' ? (
          <View style={{ flexDirection: 'row', gap: 70 }}>
            <Btn icon="📵" bg="#D93025" size={70} onPress={() => finish(L('Appel refusé', 'Declined'), 'declined')} />
            <Btn icon={video ? '📹' : '📞'} bg="#1DAA61" size={70} onPress={accept} />
          </View>
        ) : phase !== 'ended' ? (
          <View style={{ flexDirection: 'row', gap: 22, alignItems: 'center' }}>
            <Btn icon={muted ? '🔇' : '🎙'} onPress={toggleMute} />
            {video ? <Btn icon={camOff ? '🚫' : '📷'} onPress={toggleCam} /> : null}
            {video ? <Btn icon="🔄" onPress={switchCam} /> : null}
            <Btn icon="📵" bg="#D93025" size={70} onPress={() => finish(L('Appel terminé', 'Call ended'), phase === 'ongoing' ? 'ended' : 'missed')} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
