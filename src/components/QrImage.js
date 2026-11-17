import React, { useMemo } from 'react';
import { View } from 'react-native';
import QRCode from 'qrcode';

// QR code dessiné en carrés (aucun module natif nécessaire)
export default function QrImage({ value, size = 220, children }) {
  const rows = useMemo(() => {
    try {
      const qr = QRCode.create(String(value || ''), { errorCorrectionLevel: 'M' });
      const n = qr.modules.size;
      const d = qr.modules.data;
      const out = [];
      for (let y = 0; y < n; y++) {
        const r = [];
        for (let x = 0; x < n; x++) r.push(!!d[y * n + x]);
        out.push(r);
      }
      return out;
    } catch (e) {
      return [];
    }
  }, [value]);
  const n = rows.length || 1;
  const inner = size - 16;
  const cell = Math.floor(inner / n);
  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
      <View>
        {rows.map((r, y) => (
          <View key={y} style={{ flexDirection: 'row' }}>
            {r.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? '#000' : '#fff' }} />)}
          </View>
        ))}
      </View>
      {children ? <View style={{ position: 'absolute' }}>{children}</View> : null}
    </View>
  );
}
