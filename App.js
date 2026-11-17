import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/AppContext';
import { t } from './src/lib/i18n';
import { Loading } from './src/components/ui';
import LoginScreen from './src/screens/LoginScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import NewGroupScreen from './src/screens/NewGroupScreen';
import JoinGroupScreen from './src/screens/JoinGroupScreen';
import GroupInfoScreen from './src/screens/GroupInfoScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ComingSoonScreen from './src/screens/ComingSoonScreen';
import StatusScreen from './src/screens/StatusScreen';
import StatusViewerScreen from './src/screens/StatusViewerScreen';
import ShopScreen from './src/screens/ShopScreen';
import ProductEditScreen from './src/screens/ProductEditScreen';
import SellerShopScreen from './src/screens/SellerShopScreen';
import OrderScreen from './src/screens/OrderScreen';
import CallsScreen from './src/screens/CallsScreen';
import CallScreen from './src/screens/CallScreen';
import CommunitiesScreen from './src/screens/CommunitiesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsDetailScreen from './src/screens/SettingsDetailScreen';
import EventsScreen from './src/screens/EventsScreen';
import EventScreen from './src/screens/EventScreen';
import EventEditScreen from './src/screens/EventEditScreen';
import NewContactScreen from './src/screens/NewContactScreen';
import { navigationRef } from './src/lib/nav';
import { L } from './src/lib/i18n';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  const { colors } = useApp();
  const icon = (e) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{e}</Text>;
  const header = { headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '800', fontSize: 22 }, headerShadowVisible: false };
  return (
    <Tab.Navigator
      screenOptions={{
        ...header,
        tabBarActiveTintColor: colors.text,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 64, paddingBottom: 8 },
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen name="Chats" component={ChatsScreen} options={{ headerShown: false, tabBarLabel: t('chats'), tabBarIcon: icon('💬'), tabBarBadge: undefined }} />
      <Tab.Screen name="Status" component={StatusScreen} options={{ title: L('Statuts', 'Status'), tabBarLabel: L('Statuts', 'Status'), tabBarIcon: icon('⭕') }} />
      <Tab.Screen name="Communities" component={CommunitiesScreen} options={{ title: t('communities'), tabBarIcon: icon('👥') }} />
      <Tab.Screen name="Calls" component={CallsScreen} options={{ title: t('calls'), tabBarIcon: icon('📞') }} />
      <Tab.Screen name="Shop" component={ShopScreen} options={{ title: L('Boutique', 'Shop'), tabBarLabel: L('Boutique', 'Shop'), tabBarIcon: icon('🛍️') }} />
    </Tab.Navigator>
  );
}

const linking = {
  prefixes: ['unichatplus://'],
  config: { screens: { JoinGroup: 'join/:code', Event: 'event/:code' } },
};

function Root() {
  const { ready, session, colors, theme, lang } = useApp();
  if (!ready) return <Loading />;
  const navTheme = theme === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.primary, background: colors.bg, card: colors.bg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg } };
  const header = { headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } };
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={session ? linking : undefined} key={lang}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={header}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: t('startChat') }} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: t('newGroup') }} />
            <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: t('joinWithCode') }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings') }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: L('Profil', 'Profile') }} />
            <Stack.Screen name="SettingsDetail" component={SettingsDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="Events" component={EventsScreen} options={{ title: L('Événements', 'Events') }} />
            <Stack.Screen name="Event" component={EventScreen} options={{ title: L('Événement', 'Event') }} />
            <Stack.Screen name="EventEdit" component={EventEditScreen} options={{ title: L('Créer un événement', 'Create event') }} />
            <Stack.Screen name="NewContact" component={NewContactScreen} options={{ title: L('Nouveau contact', 'New contact') }} />
            <Stack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: t('groupInfo') }} />
            <Stack.Screen name="StatusViewer" component={StatusViewerScreen} options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="ProductEdit" component={ProductEditScreen} options={{ title: L('Produit', 'Product') }} />
            <Stack.Screen name="SellerShop" component={SellerShopScreen} options={{ title: L('Boutique', 'Shop') }} />
            <Stack.Screen name="Order" component={OrderScreen} options={{ title: L('Commande', 'Order') }} />
            <Stack.Screen name="Call" component={CallScreen} options={{ headerShown: false, gestureEnabled: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
