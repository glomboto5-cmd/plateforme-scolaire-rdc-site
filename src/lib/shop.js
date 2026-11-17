import { supabase } from './supabase';
import { publicUrl } from './upload';
import { L } from './i18n';

export const CURRENCIES = ['USD', 'CDF', 'EUR', 'XAF', 'KES', 'TZS', 'UGX', 'RWF', 'ZAR', 'NGN', 'GBP', 'CNY'];

export const PAYMENT_METHODS = [
  { key: 'mobile_money', icon: '📱', fr: 'Mobile Money', en: 'Mobile Money', providers: ['M-Pesa', 'Airtel Money', 'Orange Money', 'Afrimoney', 'Autre'] },
  { key: 'bank_transfer', icon: '🏦', fr: 'Virement bancaire', en: 'Bank transfer', providers: [] },
  { key: 'card', icon: '💳', fr: 'Carte bancaire', en: 'Bank card', providers: ['Visa', 'Mastercard', 'Autre'] },
  { key: 'cash', icon: '💵', fr: 'Espèces', en: 'Cash', providers: [] },
];

export function money(amount, currency) {
  const n = Number(amount || 0);
  const s = n.toFixed(n % 1 === 0 ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return s + ' ' + (currency || '');
}

export function productImage(p) {
  const path = p && p.image_paths && p.image_paths[0];
  if (!path) return null;
  return path.startsWith('http') ? path : publicUrl('products', path);
}

export const STATUS_LABEL = {
  cart: ['Panier', 'Cart'],
  requested: ['Commande envoyée', 'Order sent'],
  accepted: ['Acceptée', 'Accepted'],
  rejected: ['Refusée', 'Rejected'],
  cancelled: ['Annulée', 'Cancelled'],
  paid: ['Payée', 'Paid'],
  preparing: ['En préparation', 'Preparing'],
  shipped: ['Expédiée', 'Shipped'],
  delivered: ['Livrée', 'Delivered'],
  completed: ['Terminée', 'Completed'],
};
export const statusLabel = (s) => L(...(STATUS_LABEL[s] || [s, s]));

export const PAY_STATUS = {
  pending: ['En attente', 'Pending'],
  processing: ['En cours', 'Processing'],
  confirmed: ['Confirmé', 'Confirmed'],
  failed: ['Échoué', 'Failed'],
  refunded: ['Remboursé', 'Refunded'],
  cancelled: ['Annulé', 'Cancelled'],
};
export const payStatusLabel = (s) => L(...(PAY_STATUS[s] || [s, s]));

// Ajoute un produit au panier (un panier par vendeur)
export async function addToCart(userId, product, quantity = 1) {
  let { data: cart } = await supabase
    .from('orders')
    .select('id,currency')
    .eq('buyer_id', userId)
    .eq('seller_id', product.seller_id)
    .eq('status', 'cart')
    .maybeSingle();
  if (!cart) {
    const r = await supabase
      .from('orders')
      .insert({ buyer_id: userId, seller_id: product.seller_id, currency: product.currency, status: 'cart' })
      .select('id,currency')
      .single();
    if (r.error) throw r.error;
    cart = r.data;
  }
  const { data: existing } = await supabase.from('order_items').select('id,quantity').eq('order_id', cart.id).eq('product_id', product.id).maybeSingle();
  const r2 = existing
    ? await supabase.from('order_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id)
    : await supabase.from('order_items').insert({ order_id: cart.id, product_id: product.id, product_name: product.name, unit_price: product.price, quantity });
  if (r2.error) throw r2.error;
  return cart.id;
}
