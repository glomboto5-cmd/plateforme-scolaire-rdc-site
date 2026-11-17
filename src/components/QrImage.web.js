import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import QRCode from 'qrcode';

// QR code affiché sur l'ordinateur (version web)
export default function QrImage({ value, size = 220 }) {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }).then(setUri).catch(() => setUri(null));
  }, [value, size]);
  return <View style={{ width: size, height: size, backgroundColor: '#fff', padding: 8, borderRadius: 12 }}>{uri ? <Image source={{ uri }} style={{ width: size - 16, height: size - 16 }} /> : null}</View>;
}
