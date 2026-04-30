import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/store';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert('ההתחברות נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-50" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl font-bold text-brand-700">LactaSync</Text>
        <Text className="mt-2 text-base text-gray-600">התחברי כדי לעקוב אחר ההנקות שלך.</Text>

        <View className="mt-10 gap-4">
          <TextInput
            placeholder="דוא״ל"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            className="rounded-2xl bg-white px-5 py-4 text-base"
          />
          <TextInput
            placeholder="סיסמה"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            className="rounded-2xl bg-white px-5 py-4 text-base"
          />
          <Pressable
            onPress={onSubmit}
            disabled={loading}
            className="items-center justify-center rounded-2xl bg-brand-600 py-4"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">התחברות</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
