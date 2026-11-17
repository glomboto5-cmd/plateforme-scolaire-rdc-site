import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, Image } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { t, getLanguage, LANGUAGES, setLanguage } from '../lib/i18n';
import { useApp } from '../AppContext';
import { Button, Input, Muted } from '../components/ui';

export default function LoginScreen() {
  const { colors } = useApp();
  const [step, setStep] = useState('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [, force] = useState(0);

  const sendCode = async () => {
    const mail = email.trim().toLowerCase();
    if (!name.trim()) return Alert.alert(t('error'), t('nameRequired'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return Alert.alert(t('error'), t('emailInvalid'));
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'unichatplus://login',
        data: { display_name: name.trim(), language: getLanguage() },
      },
    });
    setLoading(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setEmail(mail);
    setStep('code');
  };

  const verify = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setLoading(false);
    if (error) Alert.alert(t('error'), errText(error));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Image source={require('../../assets/icon.png')} style={{ width: 88, height: 88, borderRadius: 22 }} />
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 14 }}>Unichat +</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>{t('tagline')}</Muted>
        </View>

        {step === 'form' ? (
          <View style={{ gap: 12 }}>
            <Input placeholder={t('name')} value={name} onChangeText={setName} autoCapitalize="words" />
            <Input placeholder={t('email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Muted style={{ fontSize: 13 }}>{t('loginInfo')}</Muted>
            <Button title={t('receiveCode')} onPress={sendCode} loading={loading} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Muted>{t('codeSentTo')} {email}</Muted>
            <View style={{ backgroundColor: colors.bgAlt, borderRadius: 12, padding: 14 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>📧 {t('openLink')}</Text>
              <Muted style={{ marginTop: 4 }}>{t('openLinkHint')}</Muted>
            </View>
            <Text style={{ color: colors.text, fontSize: 16 }}>{t('enterCode')}</Text>
            <Input
              placeholder="000000"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center' }}
              autoFocus
            />
            <Button title={t('verify')} onPress={verify} loading={loading} disabled={code.length < 6} />
            <Button title={t('resend')} variant="ghost" onPress={sendCode} disabled={loading} />
            <Pressable onPress={() => { setStep('form'); setCode(''); }}>
              <Text style={{ color: colors.primary, textAlign: 'center', padding: 8 }}>{t('changeEmail')}</Text>
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 28, gap: 8 }}>
          {LANGUAGES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => { setLanguage(l.code); force((x) => x + 1); }}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: getLanguage() === l.code ? colors.primary : colors.border }}
            >
              <Text style={{ color: getLanguage() === l.code ? colors.primary : colors.textMuted, fontSize: 13 }}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
