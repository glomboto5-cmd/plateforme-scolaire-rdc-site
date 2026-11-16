import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';
import { supabase } from './supabase';

function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function extOf(name, mime) {
  const m = /\.([a-zA-Z0-9]{1,6})$/.exec(name || '');
  if (m) return m[1].toLowerCase();
  if (mime && mime.includes('/')) return mime.split('/')[1].split('+')[0];
  return 'bin';
}

// Envoie un fichier local dans un bucket, sous le dossier <userId>/
export async function uploadFile({ bucket, userId, uri, mimeType, fileName }) {
  const ext = extOf(fileName || uri, mimeType);
  const path = `${userId}/${randomId()}.${ext}`;
  let body;
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    body = await res.blob();
  } else {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    body = decode(b64);
  }
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: mimeType || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

const signedCache = {};
export async function signedUrl(bucket, path) {
  const key = bucket + '/' + path;
  const hit = signedCache[key];
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return null;
  signedCache[key] = { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
  return data.signedUrl;
}

export function publicUrl(bucket, path) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
