import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { supabase, errText } from '../lib/supabase';
import { L, t } from '../lib/i18n';
import { useApp } from '../AppContext';
import { ActionSheet, Avatar, Button, Input, Muted, Title } from '../components/ui';
import { avatarUri, formatTime } from '../lib/chat';
import { PAYMENT_METHODS, money, payStatusLabel, statusLabel } from '../lib/shop';

const FIELDS =
  '*, buyer:profiles!orders_buyer_id_fkey(id,display_name,avatar_url), seller:profiles!orders_seller_id_fkey(id,display_name,business_name,avatar_url), ' +
  'order_items(*), order_events(*), payments(*), invoices(*), deliveries(*)';

export default function OrderScreen({ route, navigation }) {
  const { id } = route.params;
  const { colors, userId } = useApp();
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('delivery');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('orders').select(FIELDS).eq('id', id).maybeSingle();
    if (error) Alert.alert(t('error'), errText(error));
    setO(data);
    if (data) navigation.setOptions({ title: data.status === 'cart' ? L('Panier', 'Cart') : data.order_number });
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('order-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `order_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  if (!o) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const isBuyer = o.buyer_id === userId;
  const isSeller = o.seller_id === userId;
  const editable = isBuyer && ['cart', 'requested'].includes(o.status);
  const confirmedPaid = (o.payments || []).filter((p) => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);
  const delivery = (o.deliveries || [])[0];

  const setStatus = async (status, note) => {
    setBusy(true);
    const { error } = await supabase.rpc('set_order_status', { p_order: id, p_status: status, p_note: note || null });
    setBusy(false);
    if (error) Alert.alert(t('error'), errText(error));
    load();
  };

  const confirmAsk = (label, status) =>
    Alert.alert(label, '', [{ text: t('cancel'), style: 'cancel' }, { text: 'OK', onPress: () => setStatus(status) }]);

  const changeQty = async (item, delta) => {
    const q = item.quantity + delta;
    const r = q <= 0 ? await supabase.from('order_items').delete().eq('id', item.id) : await supabase.from('order_items').update({ quantity: q }).eq('id', item.id);
    if (r.error) Alert.alert(t('error'), errText(r.error));
    load();
  };

  const sendOrder = async () => {
    if (deliveryMethod === 'delivery' && !address.trim()) return Alert.alert(t('error'), L("Indiquez l'adresse de livraison", 'Enter a delivery address'));
    setBusy(true);
    if (!delivery) {
      const { error } = await supabase.from('deliveries').insert({ order_id: id, method: deliveryMethod, address: address.trim() || null, recipient_phone: phone.trim() || null });
      if (error) { setBusy(false); return Alert.alert(t('error'), errText(error)); }
    }
    setBusy(false);
    setStatus('requested');
  };

  const pay = async () => {
    const m = payForm.method;
    if (m.key === 'mobile_money' && !payForm.phone.trim()) return Alert.alert(t('error'), L('Numéro Mobile Money obligatoire', 'Mobile Money number required'));
    setBusy(true);
    const { error } = await supabase.from('payments').insert({
      order_id: id,
      payer_id: userId,
      method: m.key,
      provider: payForm.provider || null,
      amount: Number(o.total) - confirmedPaid,
      currency: o.currency,
      payer_phone: m.key === 'mobile_money' ? payForm.phone.trim() : null,
    });
    setBusy(false);
    if (error) return Alert.alert(t('error'), errText(error));
    setPayForm(null);
    Alert.alert(
      L('Paiement enregistré', 'Payment recorded'),
      m.key === 'cash'
        ? L('Le vendeur confirmera le paiement à la réception des espèces.', 'The seller will confirm when the cash is received.')
        : L(
            "Votre paiement est en attente. Il sera confirmé par le prestataire de paiement, ou par le vendeur à réception des fonds.",
            'Your payment is pending confirmation.'
          )
    );
    load();
  };

  const confirmPayment = async (p) => {
    const fn = p.method === 'cash' ? 'confirm_cash_payment' : 'confirm_manual_payment';
    const { error } = await supabase.rpc(fn, { p_payment: p.id });
    if (error) Alert.alert(t('error'), errText(error));
    load();
  };

  const invoice = async () => {
    const { error } = await supabase.rpc('issue_invoice', { p_order: id, p_language: 'fr', p_tax: 0 });
    if (error) Alert.alert(t('error'), errText(error));
    load();
  };

  const chat = async () => {
    const other = isBuyer ? o.seller_id : o.buyer_id;
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', { p_other: other });
    if (error) return Alert.alert(t('error'), errText(error));
    navigation.navigate('Chat', { id: data });
  };

  const other = isBuyer ? o.seller : o.buyer;
  const otherName = other ? (isBuyer ? other.business_name || other.display_name : other.display_name) : '?';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgAlt }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ backgroundColor: colors.bg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar uri={avatarUri(other)} name={otherName} size={48} />
        <View style={{ flex: 1 }}>
          <Title>{otherName}</Title>
          <Muted>{isBuyer ? L('Vendeur', 'Seller') : L('Client', 'Customer')} · {statusLabel(o.status)}</Muted>
        </View>
        <Pressable onPress={chat} style={{ padding: 8 }}><Text style={{ fontSize: 22 }}>💬</Text></Pressable>
      </View>

      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, padding: 16, paddingBottom: 6 }}>{L('ARTICLES', 'ITEMS')}</Text>
      <View style={{ backgroundColor: colors.bg }}>
        {(o.order_items || []).map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Title numberOfLines={1}>{it.product_name}</Title>
              <Muted>{money(it.unit_price, o.currency)} × {it.quantity}</Muted>
            </View>
            {editable ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 10 }}>
                <Pressable onPress={() => changeQty(it, -1)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text, fontSize: 18 }}>−</Text></Pressable>
                <Text style={{ color: colors.text, minWidth: 20, textAlign: 'center' }}>{it.quantity}</Text>
                <Pressable onPress={() => changeQty(it, 1)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text, fontSize: 18 }}>+</Text></Pressable>
              </View>
            ) : null}
            <Text style={{ color: colors.text, fontWeight: '700' }}>{money(it.line_total, o.currency)}</Text>
          </View>
        ))}
        {!(o.order_items || []).length ? <Muted style={{ padding: 14 }}>{L('Panier vide', 'Empty cart')}</Muted> : null}
        <View style={{ padding: 14, gap: 4 }}>
          {Number(o.delivery_fee) ? <Muted>{L('Livraison', 'Delivery')} : {money(o.delivery_fee, o.currency)}</Muted> : null}
          {Number(o.discount) ? <Muted>{L('Remise', 'Discount')} : −{money(o.discount, o.currency)}</Muted> : null}
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{L('Total', 'Total')} : {money(o.total, o.currency)}</Text>
          {confirmedPaid ? <Muted>{L('Déjà payé', 'Paid')} : {money(confirmedPaid, o.currency)}</Muted> : null}
        </View>
      </View>

      {/* Envoi de la commande (acheteur) */}
      {isBuyer && o.status === 'cart' && (o.order_items || []).length ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{L('LIVRAISON', 'DELIVERY')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['delivery', L('Livraison', 'Delivery')], ['pickup', L('Retrait', 'Pickup')], ['in_person', L('En main propre', 'In person')]].map(([k, label]) => (
              <Pressable key={k} onPress={() => setDeliveryMethod(k)} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: deliveryMethod === k ? colors.chipActiveBg : colors.bg }}>
                <Text style={{ color: deliveryMethod === k ? colors.chipActiveText : colors.textMuted, fontWeight: '600', fontSize: 13 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {deliveryMethod === 'delivery' ? <Input placeholder={L('Adresse de livraison', 'Delivery address')} value={address} onChangeText={setAddress} /> : null}
          <Input placeholder={L('Téléphone pour la livraison (facultatif)', 'Phone for delivery (optional)')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Button title={L('Envoyer la commande', 'Send order')} onPress={sendOrder} loading={busy} />
        </View>
      ) : null}

      {/* Actions */}
      <View style={{ padding: 16, gap: 10 }}>
        {isSeller && o.status === 'requested' ? (
          <>
            <Button title={'✅ ' + L('Accepter la commande', 'Accept order')} onPress={() => setStatus('accepted')} loading={busy} />
            <Button title={L('Refuser', 'Reject')} variant="danger" onPress={() => confirmAsk(L('Refuser la commande ?', 'Reject order?'), 'rejected')} />
          </>
        ) : null}
        {isSeller && ['accepted', 'paid'].includes(o.status) ? <Button title={'📦 ' + L('En préparation', 'Preparing')} onPress={() => setStatus('preparing')} loading={busy} /> : null}
        {isSeller && ['paid', 'preparing'].includes(o.status) ? <Button title={'🚚 ' + L('Expédiée', 'Shipped')} onPress={() => setStatus('shipped')} loading={busy} /> : null}
        {isSeller && ['shipped', 'preparing'].includes(o.status) ? <Button title={'📬 ' + L('Livrée', 'Delivered')} onPress={() => setStatus('delivered')} loading={busy} /> : null}
        {isSeller && !['cart', 'requested', 'rejected', 'cancelled'].includes(o.status) ? <Button title={'🧾 ' + L('Émettre une facture', 'Issue invoice')} variant="ghost" onPress={invoice} /> : null}

        {isBuyer && ['accepted', 'requested'].includes(o.status) && confirmedPaid < Number(o.total) ? (
          <Button title={'💰 ' + L('Payer', 'Pay') + ' ' + money(Number(o.total) - confirmedPaid, o.currency)} onPress={() => setSheet('pay')} />
        ) : null}
        {isBuyer && o.status === 'delivered' ? <Button title={'✅ ' + L("J'ai bien reçu ma commande", 'I received my order')} onPress={() => setStatus('completed')} /> : null}
        {isBuyer && ['cart', 'requested', 'accepted'].includes(o.status) ? (
          <Button title={L('Annuler la commande', 'Cancel order')} variant="ghost" onPress={() => confirmAsk(L('Annuler la commande ?', 'Cancel order?'), 'cancelled')} />
        ) : null}
      </View>

      {payForm ? (
        <View style={{ margin: 16, padding: 16, borderRadius: 14, backgroundColor: colors.bg, gap: 10 }}>
          <Title>{payForm.method.icon} {L(payForm.method.fr, payForm.method.en)}</Title>
          {payForm.method.providers.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {payForm.method.providers.map((pr) => (
                <Pressable key={pr} onPress={() => setPayForm({ ...payForm, provider: pr })} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: payForm.provider === pr ? colors.chipActiveBg : colors.bgAlt }}>
                  <Text style={{ color: payForm.provider === pr ? colors.chipActiveText : colors.textMuted }}>{pr}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {payForm.method.key === 'mobile_money' ? (
            <Input placeholder={L('Numéro Mobile Money (+243…)', 'Mobile Money number')} value={payForm.phone} onChangeText={(v) => setPayForm({ ...payForm, phone: v })} keyboardType="phone-pad" />
          ) : null}
          {payForm.method.key === 'card' ? (
            <Muted>{L("Pour votre sécurité, aucun numéro de carte n'est saisi dans l'application. Le vendeur vous indiquera le lien ou le terminal de paiement.", 'No card number is entered in the app.')}</Muted>
          ) : null}
          {payForm.method.key === 'bank_transfer' ? <Muted>{L('Demandez les coordonnées bancaires au vendeur dans la discussion 💬.', 'Ask the seller for bank details in the chat.')}</Muted> : null}
          <Button title={L('Confirmer', 'Confirm') + ' · ' + money(Number(o.total) - confirmedPaid, o.currency)} onPress={pay} loading={busy} />
          <Button title={t('cancel')} variant="ghost" onPress={() => setPayForm(null)} />
        </View>
      ) : null}

      {(o.payments || []).length ? (
        <>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, padding: 16, paddingBottom: 6 }}>{L('PAIEMENTS', 'PAYMENTS')}</Text>
          {o.payments.map((p) => {
            const m = PAYMENT_METHODS.find((x) => x.key === p.method) || {};
            return (
              <View key={p.id} style={{ backgroundColor: colors.bg, padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Title>{m.icon} {L(m.fr || p.method, m.en)} {p.provider ? '· ' + p.provider : ''}</Title>
                  <Muted>{money(p.amount, p.currency)} · {payStatusLabel(p.status)} · {formatTime(p.created_at, t)}</Muted>
                </View>
                {isSeller && p.status === 'pending' ? (
                  <Pressable onPress={() => Alert.alert(L('Confirmer la réception de ce paiement ?', 'Confirm you received this payment?'), money(p.amount, p.currency), [{ text: t('cancel'), style: 'cancel' }, { text: 'OK', onPress: () => confirmPayment(p) }])} style={{ backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{L('Reçu', 'Received')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      {delivery ? (
        <>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, padding: 16, paddingBottom: 6 }}>{L('LIVRAISON', 'DELIVERY')}</Text>
          <View style={{ backgroundColor: colors.bg, padding: 12 }}>
            <Title style={{ fontWeight: '400' }}>
              {delivery.method === 'delivery' ? '🚚 ' + L('Livraison', 'Delivery') : delivery.method === 'pickup' ? '🏪 ' + L('Retrait', 'Pickup') : '🤝 ' + L('En main propre', 'In person')}
            </Title>
            {delivery.address ? <Muted>📍 {delivery.address}</Muted> : null}
            {delivery.recipient_phone ? <Muted>📞 {delivery.recipient_phone}</Muted> : null}
          </View>
        </>
      ) : null}

      {(o.invoices || []).length ? (
        <>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, padding: 16, paddingBottom: 6 }}>{L('FACTURES ET REÇUS', 'INVOICES & RECEIPTS')}</Text>
          {o.invoices.map((iv) => (
            <View key={iv.id} style={{ backgroundColor: colors.bg, padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Title>🧾 {iv.kind === 'invoice' ? L('Facture', 'Invoice') : L('Reçu', 'Receipt')} {iv.number}</Title>
              <Muted>{money(iv.amount, iv.currency)} · {formatTime(iv.issued_at, t)}</Muted>
            </View>
          ))}
        </>
      ) : null}

      {(o.order_events || []).length ? (
        <>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13, padding: 16, paddingBottom: 6 }}>{L('SUIVI', 'TRACKING')}</Text>
          <View style={{ backgroundColor: colors.bg, padding: 12, gap: 6 }}>
            {[...o.order_events].sort((a, b) => a.id - b.id).map((e) => (
              <Muted key={e.id}>• {statusLabel(e.to_status)} — {formatTime(e.created_at, t)}{e.note ? ' · ' + e.note : ''}</Muted>
            ))}
          </View>
        </>
      ) : null}

      <ActionSheet
        visible={sheet === 'pay'}
        title={L('Moyen de paiement', 'Payment method')}
        actions={PAYMENT_METHODS.map((m) => ({ label: m.icon + '  ' + L(m.fr, m.en), onPress: () => setPayForm({ method: m, provider: m.providers[0] || null, phone: '' }) }))}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}
