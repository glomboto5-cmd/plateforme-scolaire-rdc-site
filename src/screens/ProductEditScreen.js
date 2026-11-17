import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Button, Input, Muted, Title } from '../components/ui';
import { uploadFile } from '../lib/upload';
import { CURRENCIES, productImage } from '../lib/shop';

export default function ProductEditScreen({ route, navigation }) {
  const id = route.params && route.params.id;
  const { colors, userId } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [kind, setKind] = useState('product');
  const [stock, setStock] = useState('');
  const [available, setAvailable] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: id ? L('Modifier le produit', 'Edit product') : L('Nouveau produit', 'New product') });
    if (!id) return;
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      setName(data.name);
      setDescription(data.description || '');
      setPrice(String(data.price));
      setCurrency(data.currency);
      setKind(data.kind);
      setStock(data.stock_quantity == null ? '' : String(data.stock_quantity));
      setAvailable(data.is_available);
      setHidden(data.is_hidden);
      setImages(data.image_paths || []);
    });
  }, [id]);

  const addPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets) return;
    try {
      setBusy(true);
      const a = res.assets[0];
      const path = await uploadFile({ bucket: 'products', userId, uri: a.uri, mimeType: a.mimeType || 'image/jpeg', fileName: a.fileName });
      setImages((x) => [...x, path].slice(0, 5));
    } catch (e) {
      Alert.alert(t('error'), errText(e));
    }
    setBusy(false);
  };

  const save = async () => {
    const p = Number(String(price).replace(',', '.').replace(/\s/g, ''));
    if (!name.trim()) return Alert.alert(t('error'), L('Le nom est obligatoire', 'Name is required'));
    if (!(p >= 0)) return Alert.alert(t('error'), L('Prix invalide', 'Invalid price'));
    setBusy(true);
    const row = {
      seller_id: userId,
      name: name.trim(),
      description: description.trim() || null,
      price: p,
      currency,
      kind,
      stock_quantity: stock === '' ? null : Math.max(0, parseInt(stock, 10) || 0),
      is_available: available,
      is_hidden: hidden,
      image_paths: images,
    };
    const { error } = id ? await supabase.from('products').update(row).eq('id', id) : await supabase.from('products').insert(row);
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    navigation.goBack();
  };

  const remove = () =>
    Alert.alert(L('Supprimer ce produit ?', 'Delete this product?'), '', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: L('Supprimer', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) return Alert.alert(t('error'), errText(error));
          navigation.goBack();
        },
      },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
        {images.map((path, i) => (
          <Pressable key={path} onLongPress={() => setImages((x) => x.filter((_, j) => j !== i))}>
            <Image source={{ uri: productImage({ image_paths: [path] }) }} style={{ width: 96, height: 96, borderRadius: 12 }} />
          </Pressable>
        ))}
        {images.length < 5 ? (
          <Pressable onPress={addPhoto} style={{ width: 96, height: 96, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26 }}>📷</Text>
            <Text style={{ color: colors.primary, fontSize: 12 }}>{L('Photo', 'Photo')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {images.length ? <Muted style={{ fontSize: 12 }}>{L('Appui long sur une photo pour la retirer', 'Long-press a photo to remove it')}</Muted> : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[['product', L('Produit', 'Product')], ['service', L('Service', 'Service')]].map(([k, label]) => (
          <Pressable key={k} onPress={() => setKind(k)} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: kind === k ? colors.chipActiveBg : colors.bgAlt }}>
            <Text style={{ color: kind === k ? colors.chipActiveText : colors.textMuted, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Input placeholder={L('Nom', 'Name')} value={name} onChangeText={setName} />
      <Input placeholder={L('Description', 'Description')} value={description} onChangeText={setDescription} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input placeholder={L('Prix', 'Price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Pressable onPress={() => setSheet(true)} style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{currency} ⌄</Text>
        </Pressable>
      </View>
      {kind === 'product' ? (
        <Input placeholder={L('Stock (facultatif)', 'Stock (optional)')} value={stock} onChangeText={setStock} keyboardType="number-pad" />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Title style={{ flex: 1, fontWeight: '400' }}>{L('Disponible', 'Available')}</Title>
        <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.primary }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Title style={{ flex: 1, fontWeight: '400' }}>{L('Masquer du catalogue', 'Hide from catalog')}</Title>
        <Switch value={hidden} onValueChange={setHidden} trackColor={{ true: colors.primary }} />
      </View>

      <Button title={t('save')} onPress={save} loading={busy} />
      {id ? <Button title={L('Supprimer', 'Delete')} variant="danger" onPress={remove} /> : null}

      <ActionSheet
        visible={sheet}
        title={L('Devise', 'Currency')}
        actions={CURRENCIES.map((c) => ({ label: (c === currency ? '● ' : '○ ') + c, onPress: () => setCurrency(c) }))}
        onClose={() => setSheet(false)}
      />
    </ScrollView>
  );
}
