import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppContext';

export function Avatar({ uri, name, size = 44 }) {
  const { colors } = useApp();
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials || '?'}</Text>
    </View>
  );
}

export function Button({ title, onPress, loading, variant = 'primary', disabled, style }) {
  const { colors } = useApp();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'ghost' ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { backgroundColor: bg, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props) {
  const { colors } = useApp();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
        props.style,
      ]}
    />
  );
}

export function Row({ children, onPress, onLongPress, style }) {
  const { colors } = useApp();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? colors.bgAlt : colors.bg }, style]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children }) {
  const { colors } = useApp();
  return <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6, textTransform: 'uppercase' }}>{children}</Text>;
}

export function Muted({ children, style }) {
  const { colors } = useApp();
  return <Text style={[{ color: colors.textMuted, fontSize: 14 }, style]}>{children}</Text>;
}

export function Title({ children, style }) {
  const { colors } = useApp();
  return <Text style={[{ color: colors.text, fontSize: 16, fontWeight: '600' }, style]}>{children}</Text>;
}

// Menu d'actions (remplace Alert, limité à 3 boutons sur Android)
export function ActionSheet({ visible, title, actions, onClose }) {
  const { colors } = useApp();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
          {title ? <Text style={{ color: colors.textMuted, padding: 16, paddingBottom: 8 }}>{title}</Text> : null}
          <ScrollView style={{ maxHeight: 460 }}>
          {(actions || []).map((a, i) => (
            <Pressable
              key={i}
              onPress={() => {
                onClose();
                setTimeout(() => a.onPress && a.onPress(), 50);
              }}
              style={({ pressed }) => [{ paddingVertical: 15, paddingHorizontal: 18, backgroundColor: pressed ? colors.bgAlt : 'transparent' }]}
            >
              <Text style={{ color: a.danger ? colors.danger : colors.text, fontSize: 16 }}>{a.label}</Text>
            </Pressable>
          ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Loading() {
  const { colors } = useApp();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24, paddingTop: 6 },
});
