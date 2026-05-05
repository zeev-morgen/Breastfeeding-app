import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/store';

const BG_IMAGES = [
  'https://images.unsplash.com/photo-1502872364588-894d7d6ddfab?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&auto=format&fit=crop&q=80',
];

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
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Top photographic section */}
      <ImageBackground
        source={{ uri: BG_IMAGES[0] }}
        style={s.heroBg}
        resizeMode="cover"
      >
        <View style={s.heroOverlay} />
        {/* Wordmark */}
        <SafeAreaView edges={['top']} style={s.wordmarkWrap}>
          <Text style={s.wordmark}>⟢ LACTA / SYNC ⟣</Text>
        </SafeAreaView>
      </ImageBackground>

      {/* Form section */}
      <View style={s.formSection}>
        {/* Heading */}
        <View style={s.headingBlock}>
          <Text style={s.heading}>ברוכה{'\n'}<Text style={s.headingAccent}>השבה</Text></Text>
          <Text style={s.subheading}>
            כמה דקות שקטות לתעד את ההנקה.{'\n'}
            את עושה עבודה מצוינת.
          </Text>
        </View>

        {/* Fields */}
        <View style={s.fields}>
          <View style={s.field}>
            <Text style={s.fieldLabel}>דוא״ל</Text>
            <TextInput
              style={s.fieldInput}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#A8998F"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textAlign="right"
            />
          </View>
          <View style={s.field}>
            <Text style={s.fieldLabel}>סיסמה</Text>
            <TextInput
              style={s.fieldInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#A8998F"
              secureTextEntry
              textAlign="right"
            />
          </View>
        </View>

        {/* Submit */}
        <Pressable
          onPress={onSubmit}
          disabled={loading}
          style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.85 }]}
        >
          {loading ? (
            <ActivityIndicator color="#F4ECE2" />
          ) : (
            <>
              <Text style={s.submitArrow}>←</Text>
              <Text style={s.submitLabel}>כניסה</Text>
              <View style={{ width: 18 }} />
            </>
          )}
        </Pressable>

        {/* Links */}
        <View style={s.linksRow}>
          <Text style={s.linkMuted}>שכחתי סיסמה</Text>
          <Link href="/register" asChild>
            <Pressable>
              <Text style={s.linkAccent}>חשבון חדש ←</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const CREAM = '#F4ECE2';
const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM,
  },
  heroBg: {
    height: 320,
    width: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(36,26,20,0.18)',
  },
  wordmarkWrap: {
    alignItems: 'flex-end',
    paddingRight: 28,
    paddingTop: 8,
  },
  wordmark: {
    fontSize: 11,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  formSection: {
    flex: 1,
    marginTop: -40,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: CREAM,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
  },
  headingBlock: {
    marginBottom: 28,
  },
  heading: {
    fontFamily: 'serif',
    fontSize: 44,
    lineHeight: 52,
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
    fontSize: 15,
    color: INK_SOFT,
    lineHeight: 23,
    marginTop: 10,
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
  submitBtn: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  submitArrow: {
    color: CREAM,
    fontSize: 18,
  },
  submitLabel: {
    color: CREAM,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkMuted: {
    fontSize: 13,
    color: INK_SOFT,
    textDecorationLine: 'underline',
  },
  linkAccent: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
  },
});
