import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/store';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('שדות חסרים', 'יש למלא דוא״ל וסיסמה');
      return;
    }
    if (password.length < 8) {
      Alert.alert('סיסמה קצרה מדי', 'הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('אימות סיסמה נכשל', 'הסיסמאות אינן תואמות');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim() || undefined,
      });
    } catch (err) {
      Alert.alert('הרשמה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-50" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text className="text-4xl font-bold text-brand-700">הצטרפות ל-LactaSync</Text>
        <Text className="mt-2 text-base text-gray-600">צרי חשבון חדש כדי להתחיל לעקוב.</Text>

        <View className="mt-8 gap-4">
          <TextInput
            placeholder="שם תצוגה (לא חובה)"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            className="rounded-2xl bg-white px-5 py-4 text-base"
          />
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
            placeholder="סיסמה (לפחות 8 תווים)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            className="rounded-2xl bg-white px-5 py-4 text-base"
          />
          <TextInput
            placeholder="אימות סיסמה"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
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
              <Text className="text-base font-bold text-white">יצירת חשבון</Text>
            )}
          </Pressable>

          <Link href="/login" asChild>
            <Pressable className="items-center py-2">
              <Text className="text-sm text-brand-700">יש לי כבר חשבון — להתחברות</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
