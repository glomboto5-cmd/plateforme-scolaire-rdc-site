import { getLocales } from 'expo-localization';

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ln', label: 'Lingála' },
];

const fr = {
  appName: 'Angechat +',
  tagline: 'Un compte · Une messagerie · Personnel et professionnel',
  name: 'Nom', email: 'Adresse e-mail', continue: 'Continuer', receiveCode: 'Recevoir le code',
  codeSentTo: 'E-mail envoyé à', enterCode: 'Ou saisissez le code, s\'il y en a un dans l\'e-mail', verify: 'Vérifier',
  openLink: 'Ouvrez l\'e-mail sur ce téléphone et touchez le lien',
  openLinkHint: 'Le lien ouvre Angechat + et vous connecte automatiquement. Si le téléphone demande avec quelle application ouvrir, choisissez Angechat +. Pensez à regarder dans les spams.',
  linkExpired: 'Ce lien a expiré ou a déjà été utilisé. Demandez un nouvel e-mail.',
  resend: 'Renvoyer le code', changeEmail: "Modifier l'adresse", nameRequired: 'Le nom est obligatoire',
  emailInvalid: 'Adresse e-mail invalide', loginInfo: 'Pas de mot de passe : un code temporaire vous est envoyé par e-mail.',
  chats: 'Discussions', status: 'Statuts', calls: 'Appels', shop: 'Boutique', settings: 'Paramètres',
  comingSoon: 'Bientôt disponible', comingSoonText: 'Cette fonctionnalité arrive dans une prochaine phase.',
  noChats: 'Aucune discussion pour le moment', startChat: 'Nouvelle discussion', search: 'Rechercher',
  searchPeople: 'Rechercher un nom ou un identifiant', newGroup: 'Nouveau groupe', joinWithCode: 'Rejoindre avec un lien',
  invitations: 'Invitations', accept: 'Accepter', decline: 'Refuser', message: 'Message', send: 'Envoyer',
  typeMessage: 'Écrire un message', edited: 'Modifié', deletedMsg: 'Ce message a été supprimé',
  edit: 'Modifier', deleteForMe: 'Supprimer pour moi', deleteForAll: 'Supprimer pour tous', copy: 'Copier',
  cancel: 'Annuler', save: 'Enregistrer', ok: 'OK', close: 'Fermer', editing: 'Modification du message',
  photo: 'Photo', document: 'Document', attach: 'Joindre', you: 'Vous', group: 'Groupe', members: 'Membres',
  groupName: 'Nom du groupe', description: 'Description', create: 'Créer', selectMembers: 'Choisir les membres',
  groupInfo: 'Infos du groupe', permissions: 'Permissions', whoCanSend: 'Envoyer des messages',
  whoCanEdit: 'Modifier les infos du groupe', whoCanAdd: 'Ajouter des membres', whoCanLinks: 'Créer des liens d\'invitation',
  allMembers: 'Tous les membres', adminsOnly: 'Administrateurs seulement', approval: 'Approuver les nouveaux membres',
  groupReceipts: 'Confirmations de lecture dans le groupe', inviteLink: "Lien d'invitation", createLink: 'Créer un lien',
  revoke: 'Révoquer', share: 'Partager', addMembers: 'Ajouter des membres', leaveGroup: 'Quitter le groupe',
  owner: 'Propriétaire', admin: 'Administrateur', moderator: 'Modérateur', member: 'Membre',
  makeAdmin: 'Nommer administrateur', makeModerator: 'Nommer modérateur', makeMember: 'Rétrograder en membre',
  makeOwner: 'Transférer la propriété', remove: 'Retirer du groupe', joinRequests: "Demandes d'adhésion",
  approve: 'Approuver', reject: 'Rejeter', pasteCode: 'Collez le code ou le lien', join: 'Rejoindre',
  joined: 'Vous avez rejoint le groupe', pendingApproval: 'Demande envoyée, en attente d\'approbation',
  alreadyMember: 'Vous êtes déjà membre', ephemeral: 'Messages éphémères', off: 'Désactivés',
  h24: '24 heures', d7: '7 jours', d90: '90 jours', custom: 'Personnalisé', days: 'jours', profile: 'Profil',
  about: 'À propos', handle: 'Identifiant', language: 'Langue', theme: 'Thème', system: 'Système', light: 'Clair',
  dark: 'Sombre', privacy: 'Confidentialité', readReceipts: 'Confirmations de lecture', whoCanAddMe: "Qui peut m'ajouter aux groupes",
  everyone: 'Tout le monde', contacts: 'Mes contacts', nobody: 'Personne', business: 'Compte professionnel',
  businessName: "Nom de l'entreprise", logout: 'Se déconnecter', phone: 'Téléphone (facultatif)',
  changePhoto: 'Changer la photo', saved: 'Enregistré', error: 'Erreur', deviceRevoked: 'Session fermée',
  deviceRevokedText: 'Votre compte a été activé sur un autre appareil. Un seul appareil peut être actif à la fois.',
  restartForLanguage: "Redémarrez l'application pour appliquer le sens d'écriture.", addContact: 'Ajouter aux contacts',
  contactAdded: 'Contact ajouté', block: 'Bloquer', systemMsg: {
    group_created: 'Groupe créé', member_added: 'Un membre a été ajouté', member_removed: 'Un membre a été retiré',
    member_left: 'Un membre a quitté le groupe', member_joined: 'Un membre a rejoint le groupe',
    member_joined_via_link: 'Un membre a rejoint via un lien', member_approved: 'Un membre a été approuvé',
    role_changed: 'Un rôle a été modifié', group_info_changed: 'Les infos du groupe ont été modifiées',
    ephemeral_changed: 'Les messages éphémères ont été modifiés',
  },
  today: "Aujourd'hui", unreadMessage: 'message non lu', unreadMessages: 'messages non lus', yesterday: 'Hier', confirmLeave: 'Voulez-vous vraiment quitter ce groupe ?',
  noResults: 'Aucun résultat', newChatHint: 'Recherchez une personne inscrite sur Angechat +',
  disappearsAfter: 'Les nouveaux messages disparaîtront après', members_count: 'membres',
  filterAll: 'Toutes', filterUnread: 'Non lues', filterFavorites: 'Favoris', filterGroups: 'Groupes',
  searchChats: 'Rechercher une discussion', news: 'Actus', communities: 'Communautés',
  addFavorite: 'Ajouter aux favoris', removeFavorite: 'Retirer des favoris', markRead: 'Marquer comme lu',
  archive: 'Archiver', unarchive: 'Désarchiver', inviteWhatsApp: 'Inviter par WhatsApp',
  onUnichat: 'Sur Angechat +', phoneContacts: 'Contacts du téléphone', invite: 'Inviter',
  phoneLoading: 'Chargement des contacts du téléphone…',
  phoneDenied: "Autorisez l'accès aux contacts (Paramètres du téléphone → Applications → Angechat + → Autorisations) pour voir vos contacts ici.",
  shareWhatsApp: 'WhatsApp',
  whatsappSection: 'WhatsApp (normal ou Business)', whatsappPhone: 'Numéro WhatsApp, ex. +243812345678',
  whatsappWrite: 'Écrire sur WhatsApp', whatsappInvite: 'Inviter sur Angechat +',
  whatsappHint: 'La discussion s\'ouvre dans WhatsApp ou WhatsApp Business. WhatsApp ne permet pas d\'afficher ses messages dans une autre application.',
  phoneInvalid: 'Numéro invalide. Utilisez le format international, ex. +243812345678',
};

const en = {
  appName: 'Angechat +', tagline: 'One account · One messenger · Personal and business',
  name: 'Name', email: 'Email address', continue: 'Continue', receiveCode: 'Get the code',
  codeSentTo: 'Email sent to', enterCode: 'Or enter the code, if the email contains one', verify: 'Verify',
  openLink: 'Open the email on this phone and tap the link',
  openLinkHint: 'The link opens Angechat + and signs you in automatically. If asked which app to use, choose Angechat +. Check your spam folder.',
  linkExpired: 'This link has expired or was already used. Request a new email.',
  resend: 'Resend code', changeEmail: 'Change email', nameRequired: 'Name is required',
  emailInvalid: 'Invalid email address', loginInfo: 'No password: a temporary code is sent to your email.',
  chats: 'Chats', status: 'Status', calls: 'Calls', shop: 'Shop', settings: 'Settings',
  comingSoon: 'Coming soon', comingSoonText: 'This feature arrives in a later phase.',
  noChats: 'No chats yet', startChat: 'New chat', search: 'Search', searchPeople: 'Search a name or handle',
  newGroup: 'New group', joinWithCode: 'Join with a link', invitations: 'Invitations', accept: 'Accept', decline: 'Decline',
  message: 'Message', send: 'Send', typeMessage: 'Type a message', edited: 'Edited', deletedMsg: 'This message was deleted',
  edit: 'Edit', deleteForMe: 'Delete for me', deleteForAll: 'Delete for everyone', copy: 'Copy', cancel: 'Cancel',
  save: 'Save', ok: 'OK', close: 'Close', editing: 'Editing message', photo: 'Photo', document: 'Document',
  attach: 'Attach', you: 'You', group: 'Group', members: 'Members', groupName: 'Group name', description: 'Description',
  create: 'Create', selectMembers: 'Select members', groupInfo: 'Group info', permissions: 'Permissions',
  whoCanSend: 'Send messages', whoCanEdit: 'Edit group info', whoCanAdd: 'Add members', whoCanLinks: 'Create invite links',
  allMembers: 'All members', adminsOnly: 'Admins only', approval: 'Approve new members', groupReceipts: 'Read receipts in group',
  inviteLink: 'Invite link', createLink: 'Create link', revoke: 'Revoke', share: 'Share', addMembers: 'Add members',
  leaveGroup: 'Leave group', owner: 'Owner', admin: 'Admin', moderator: 'Moderator', member: 'Member',
  makeAdmin: 'Make admin', makeModerator: 'Make moderator', makeMember: 'Demote to member', makeOwner: 'Transfer ownership',
  remove: 'Remove from group', joinRequests: 'Join requests', approve: 'Approve', reject: 'Reject',
  pasteCode: 'Paste the code or link', join: 'Join', joined: 'You joined the group',
  pendingApproval: 'Request sent, awaiting approval', alreadyMember: 'You are already a member',
  ephemeral: 'Disappearing messages', off: 'Off', h24: '24 hours', d7: '7 days', d90: '90 days', custom: 'Custom',
  days: 'days', profile: 'Profile', about: 'About', handle: 'Handle', language: 'Language', theme: 'Theme',
  system: 'System', light: 'Light', dark: 'Dark', privacy: 'Privacy', readReceipts: 'Read receipts',
  whoCanAddMe: 'Who can add me to groups', everyone: 'Everyone', contacts: 'My contacts', nobody: 'Nobody',
  business: 'Business account', businessName: 'Business name', logout: 'Log out', phone: 'Phone (optional)',
  changePhoto: 'Change photo', saved: 'Saved', error: 'Error', deviceRevoked: 'Session closed',
  deviceRevokedText: 'Your account was activated on another device. Only one device can be active at a time.',
  restartForLanguage: 'Restart the app to apply the text direction.', addContact: 'Add to contacts',
  contactAdded: 'Contact added', block: 'Block', systemMsg: {
    group_created: 'Group created', member_added: 'A member was added', member_removed: 'A member was removed',
    member_left: 'A member left', member_joined: 'A member joined', member_joined_via_link: 'A member joined via link',
    member_approved: 'A member was approved', role_changed: 'A role was changed',
    group_info_changed: 'Group info changed', ephemeral_changed: 'Disappearing messages changed',
  },
  today: 'Today', unreadMessage: 'unread message', unreadMessages: 'unread messages', yesterday: 'Yesterday', confirmLeave: 'Do you really want to leave this group?',
  noResults: 'No results', newChatHint: 'Search for someone registered on Angechat +',
  disappearsAfter: 'New messages will disappear after', members_count: 'members',
  filterAll: 'All', filterUnread: 'Unread', filterFavorites: 'Favorites', filterGroups: 'Groups',
  searchChats: 'Search chats', news: 'Updates', communities: 'Communities',
  addFavorite: 'Add to favorites', removeFavorite: 'Remove from favorites', markRead: 'Mark as read',
  archive: 'Archive', unarchive: 'Unarchive', inviteWhatsApp: 'Invite via WhatsApp',
  onUnichat: 'On Angechat +', phoneContacts: 'Phone contacts', invite: 'Invite',
  phoneLoading: 'Loading phone contacts…',
  phoneDenied: 'Allow contacts access (phone Settings → Apps → Angechat + → Permissions) to see your contacts here.',
  shareWhatsApp: 'WhatsApp',
  whatsappSection: 'WhatsApp (regular or Business)', whatsappPhone: 'WhatsApp number, e.g. +243812345678',
  whatsappWrite: 'Message on WhatsApp', whatsappInvite: 'Invite to Angechat +',
  whatsappHint: 'The chat opens in WhatsApp or WhatsApp Business. WhatsApp does not allow its messages to be shown in another app.',
  phoneInvalid: 'Invalid number. Use international format, e.g. +243812345678',
};

// Traductions de base (à faire valider, notamment le lingala)
const partial = {
  es: { chats: 'Chats', status: 'Estados', calls: 'Llamadas', shop: 'Tienda', settings: 'Ajustes', name: 'Nombre',
    email: 'Correo electrónico', receiveCode: 'Recibir el código', verify: 'Verificar', send: 'Enviar',
    typeMessage: 'Escribe un mensaje', edited: 'Editado', deletedMsg: 'Este mensaje fue eliminado', edit: 'Editar',
    deleteForMe: 'Eliminar para mí', deleteForAll: 'Eliminar para todos', cancel: 'Cancelar', save: 'Guardar',
    newGroup: 'Nuevo grupo', startChat: 'Nuevo chat', language: 'Idioma', logout: 'Cerrar sesión', profile: 'Perfil',
    comingSoon: 'Próximamente', members: 'Miembros', leaveGroup: 'Salir del grupo' },
  pt: { chats: 'Conversas', status: 'Status', calls: 'Chamadas', shop: 'Loja', settings: 'Configurações', name: 'Nome',
    email: 'E-mail', receiveCode: 'Receber o código', verify: 'Verificar', send: 'Enviar',
    typeMessage: 'Escreva uma mensagem', edited: 'Editada', deletedMsg: 'Esta mensagem foi apagada', edit: 'Editar',
    deleteForMe: 'Apagar para mim', deleteForAll: 'Apagar para todos', cancel: 'Cancelar', save: 'Guardar',
    newGroup: 'Novo grupo', startChat: 'Nova conversa', language: 'Idioma', logout: 'Sair', profile: 'Perfil',
    comingSoon: 'Em breve', members: 'Membros', leaveGroup: 'Sair do grupo' },
  ar: { chats: 'الدردشات', status: 'الحالات', calls: 'المكالمات', shop: 'المتجر', settings: 'الإعدادات', name: 'الاسم',
    email: 'البريد الإلكتروني', receiveCode: 'استلام الرمز', verify: 'تحقق', send: 'إرسال',
    typeMessage: 'اكتب رسالة', edited: 'معدلة', deletedMsg: 'تم حذف هذه الرسالة', edit: 'تعديل',
    deleteForMe: 'حذف لدي', deleteForAll: 'حذف لدى الجميع', cancel: 'إلغاء', save: 'حفظ',
    newGroup: 'مجموعة جديدة', startChat: 'دردشة جديدة', language: 'اللغة', logout: 'تسجيل الخروج', profile: 'الملف الشخصي',
    comingSoon: 'قريبًا', members: 'الأعضاء', leaveGroup: 'مغادرة المجموعة' },
  zh: { chats: '聊天', status: '动态', calls: '通话', shop: '商店', settings: '设置', name: '姓名',
    email: '电子邮箱', receiveCode: '获取验证码', verify: '验证', send: '发送',
    typeMessage: '输入消息', edited: '已编辑', deletedMsg: '此消息已删除', edit: '编辑',
    deleteForMe: '为我删除', deleteForAll: '为所有人删除', cancel: '取消', save: '保存',
    newGroup: '新建群组', startChat: '新聊天', language: '语言', logout: '退出登录', profile: '个人资料',
    comingSoon: '即将推出', members: '成员', leaveGroup: '退出群组' },
  sw: { chats: 'Mazungumzo', status: 'Hali', calls: 'Simu', shop: 'Duka', settings: 'Mipangilio', name: 'Jina',
    email: 'Barua pepe', receiveCode: 'Pokea msimbo', verify: 'Thibitisha', send: 'Tuma',
    typeMessage: 'Andika ujumbe', edited: 'Imehaririwa', deletedMsg: 'Ujumbe huu umefutwa', edit: 'Hariri',
    deleteForMe: 'Futa kwangu', deleteForAll: 'Futa kwa wote', cancel: 'Ghairi', save: 'Hifadhi',
    newGroup: 'Kikundi kipya', startChat: 'Mazungumzo mapya', language: 'Lugha', logout: 'Toka', profile: 'Wasifu',
    comingSoon: 'Inakuja hivi karibuni', members: 'Wanachama', leaveGroup: 'Ondoka kwenye kikundi' },
  ln: { chats: 'Masolo', status: 'Ba statut', calls: 'Ba appel', shop: 'Butiki', settings: 'Ba paramètre', name: 'Nkombo',
    email: 'Adresse e-mail', receiveCode: 'Zwa code', verify: 'Talela', send: 'Tinda',
    typeMessage: 'Koma message', edited: 'Ebongisami', deletedMsg: 'Message oyo elongolami', edit: 'Bongisa',
    deleteForMe: 'Longola mpo na ngai', deleteForAll: 'Longola mpo na bato nyonso', cancel: 'Tika', save: 'Bomba',
    newGroup: 'Lisanga ya sika', startChat: 'Lisolo ya sika', language: 'Lokota', logout: 'Bima', profile: 'Profil',
    comingSoon: 'Ekoya noki', members: 'Bato ya lisanga', leaveGroup: 'Bima na lisanga' },
};

const dicts = { fr, en };
let current = 'fr';

export function deviceLanguage() {
  try {
    const code = (getLocales()[0] || {}).languageCode || 'fr';
    return LANGUAGES.some((l) => l.code === code) ? code : 'fr';
  } catch (e) {
    return 'fr';
  }
}

export function setLanguage(code) {
  current = LANGUAGES.some((l) => l.code === code) ? code : 'fr';
}
export function getLanguage() {
  return current;
}

export function t(key) {
  const base = current === 'fr' ? fr : current === 'en' ? en : { ...en, ...(partial[current] || {}) };
  const v = base[key];
  return v !== undefined ? v : fr[key] !== undefined ? fr[key] : key;
}

export function tSystem(code) {
  const base = current === 'fr' ? fr : en;
  return (base.systemMsg && base.systemMsg[code]) || code;
}

export const _dicts = dicts;

// Texte bilingue simple pour les nouveaux écrans (français par défaut, anglais pour les autres langues)
export function L(frText, enText) {
  return current === 'fr' ? frText : enText || frText;
}
