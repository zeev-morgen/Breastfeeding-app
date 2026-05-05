import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header row: wordmark + step */}
        <View style={s.topRow}>
          <Text style={s.wordmark}>⟢ LACTA / SYNC ⟣</Text>
          <Text style={s.stepLabel}>שלב 1 / 3</Text>
        </View>

        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={s.progressFill} />
        </View>

        {/* Heading */}
        <View style={s.headingBlock}>
          <Text style={s.heading}>
            בואי <Text style={s.headingAccent}>נכיר</Text>
          </Text>
          <Text style={s.subheading}>
            הפרטים נשמרים מקומית במכשיר ומסונכרנים מוצפנים.
          </Text>
        </View>

        {/* Fields */}
        <View style={s.fields}>
          <LabeledInput
            label="איך לקרוא לך"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          <LabeledInput
            label="דוא״ל"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <LabeledInput
            label="סיסמה"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <LabeledInput
            label="אימות סיסמה"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        {/* Baby age hint */}
        <View style={s.babyCard}>
          <View style={s.babyIcon}>
            <Text style={s.babyIconText}>♡</Text>
          </View>
          <View style={s.babyText}>
            <Text style={s.babyTitle}>גיל התינוק/ת</Text>
            <Text style={s.babySub}>נשתמש בזה להמלצות מותאמות</Text>
          </View>
          <Text style={s.babyAge}>— ימים</Text>
        </View>

        {/* Submit */}
        <Pressable
          onPress={onSubmit}
          disabled={loading}
          style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.85 }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.submitArrow}>←</Text>
              <Text style={s.submitLabel}>המשך</Text>
              <View style={{ width: 18 }} />
            </>
          )}
        </Pressable>

        <View style={s.loginRow}>
          <Text style={s.loginMuted}>יש לך כבר חשבון? </Text>
          <Link href="/login" asChild>
            <Pressable>
              <Text style={s.loginLink}>כניסה</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  autoComplete?: 'email' | 'off';
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        placeholderTextColor="#A8998F"
        textAlign="right"
      />
    </View>
  );
}

const CREAM = '#F4ECE2';
const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const ACCENT = '#7A8C6F';
const ACCENT_SOFT = '#D9DFCE';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wordmark: {
    fontSize: 11,
    letterSpacing: 4,
    color: INK_SOFT,
    fontWeight: '500',
  },
  stepLabel: {
    fontSize: 14,
    color: INK_SOFT,
  },
  progressTrack: {
    height: 2,
    backgroundColor: LINE,
    borderRadius: 2,
    marginBottom: 28,
  },
  progressFill: {
    width: '33%',
    height: 2,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  headingBlock: {
    marginBottom: 28,
  },
  heading: {
    fontFamily: 'serif',
    fontSize: 38,
    lineHeight: 46,
    color: INK,
    fontWeight: '500',
    letterSpacing: -0.5,
    textAlign: 'right',
  },
  headingAccent: {
    color: PRIMARY,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  subheading: {
    fontSize: 14,
    color: INK_SOFT,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'right',
  },
  fields: {
    gap: 12,
    marginBottom: 16,
  },
  field: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: INK_SOFT,
    marginBottom: 3,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  fieldInput: {
    fontSize: 16,
    color: INK,
    fontWeight: '500',
    padding: 0,
  },
  babyCard: {
    backgroundColor: ACCENT_SOFT,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  babyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  babyIconText: {
    fontSize: 16,
    color: CREAM,
  },
  babyText: {
    flex: 1,
  },
  babyTitle: {
    fontSize: 13,
    color: INK,
    fontWeight: '600',
    textAlign: 'right',
  },
  babySub: {
    fontSize: 12,
    color: INK_SOFT,
    textAlign: 'right',
  },
  babyAge: {
    fontSize: 14,
    color: INK,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  submitArrow: {
    color: '#fff',
    fontSize: 18,
  },
  submitLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginMuted: {
    fontSize: 13,
    color: INK_SOFT,
  },
  loginLink: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
  },
});
