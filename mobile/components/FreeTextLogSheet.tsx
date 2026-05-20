import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, ApiError, type ParsedFreeText } from '@/lib/api';
import { SIDE_LABEL } from '@/lib/format';

interface ParsedAccepted {
  side: 'LEFT' | 'RIGHT' | 'BOTH' | null;
  qualityScore: number | null;
  durationMin: number | null;
  notes: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  // Called after the server creates the log directly. Parent should refresh.
  onLogged: () => void | Promise<void>;
  // Called when confidence was low — parent should prefill the regular form
  // with the partial parse so the user can finish manually.
  onConfirmInForm: (parsed: ParsedAccepted) => void;
}

const EXAMPLES = [
  'הנקתי 20 דקות מצד שמאל, יניקה רגועה',
  '15 דקות ימין, אחיזה מצוינת',
  'הנקה קצרה משני הצדדים',
];

export function FreeTextLogSheet({ visible, onClose, onLogged, onConfirmInForm }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  // After the first submit that wasn't confident enough we keep the parsed
  // values around so the user can preview and either confirm or open the form.
  const [pending, setPending] = useState<ParsedFreeText | null>(null);

  const reset = () => {
    setText('');
    setPending(null);
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const resp = await api.createLogFromText(text.trim());
      if (resp.status === 'OK') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onLogged();
        reset();
        onClose();
        return;
      }
      // Low confidence or non-log intent — show preview for the user to decide.
      Haptics.selectionAsync();
      setPending(resp.parsed);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'תיעוד נכשל',
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'שגיאה לא ידועה',
      );
    } finally {
      setLoading(false);
    }
  };

  const moveToFormPrefilled = () => {
    if (!pending) return;
    onConfirmInForm({
      side: pending.side,
      qualityScore: pending.qualityScore,
      durationMin: pending.durationMin,
      notes: pending.notes,
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="סגירה">
            <Text style={s.cancel}>ביטול</Text>
          </Pressable>
          <Text style={s.title}>תיעוד חופשי</Text>
          <View style={{ width: 50 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={s.lead}>
              תארי את ההנקה במילים שלך — Claude יזהה את הצד, האיכות, המשך וההערות.
            </Text>

            <View style={s.examples}>
              {EXAMPLES.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setText(ex);
                  }}
                  style={({ pressed }) => [s.exampleChip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={s.exampleText}>{ex}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={s.textbox}
              value={text}
              onChangeText={setText}
              placeholder="לדוגמה: 20 דקות שמאל, אחיזה רגועה"
              placeholderTextColor="#A8998F"
              multiline
              autoFocus
              textAlign="right"
              maxLength={500}
              editable={!loading && !pending}
            />

            {pending && (
              <View style={s.previewCard}>
                <Text style={s.previewTitle}>
                  לא הצלחתי לוודא הכל. ככה הבנתי:
                </Text>
                <PreviewRow label="צד" value={pending.side ? SIDE_LABEL[pending.side] : '—'} />
                <PreviewRow label="איכות" value={pending.qualityScore != null ? `${pending.qualityScore}/5` : '—'} />
                <PreviewRow
                  label="משך"
                  value={pending.durationMin != null ? `${pending.durationMin} דק׳` : '—'}
                />
                {pending.notes ? <PreviewRow label="הערות" value={pending.notes} /> : null}
                <Text style={s.previewFoot}>
                  ביטחון של המודל: {Math.round(pending.confidence * 100)}%
                </Text>
              </View>
            )}

            {pending ? (
              <Pressable
                accessibilityRole="button"
                onPress={moveToFormPrefilled}
                style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
              >
                <Text style={s.primaryLabel}>ערכי ושמרי בטופס</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={submit}
                disabled={!text.trim() || loading}
                style={({ pressed }) => [
                  s.primaryBtn,
                  (!text.trim() || loading) && s.disabled,
                  pressed && s.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryLabel}>תיעוד</Text>
                )}
              </Pressable>
            )}

            {pending && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPending(null);
                  setText('');
                }}
                style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}
              >
                <Text style={s.secondaryLabel}>ניסוח מחדש</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.previewRow}>
      <Text style={s.previewLabel}>{label}</Text>
      <Text style={s.previewValue}>{value}</Text>
    </View>
  );
}

const CREAM = '#FDF7EF';
const SURFACE = '#FBF6EE';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  title: { fontSize: 16, fontWeight: '700', color: INK },
  cancel: { fontSize: 15, color: PRIMARY, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 32 },
  lead: { fontSize: 14, color: INK_SOFT, textAlign: 'right', lineHeight: 20, marginBottom: 14 },
  examples: { gap: 8, marginBottom: 14 },
  exampleChip: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: LINE,
  },
  exampleText: { fontSize: 13, color: INK, textAlign: 'right' },
  textbox: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 120,
    fontSize: 16,
    color: INK,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 14,
  },
  previewCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: INK,
    textAlign: 'right',
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  previewLabel: { fontSize: 12, color: INK_SOFT },
  previewValue: { fontSize: 14, color: INK, fontWeight: '600', textAlign: 'right' },
  previewFoot: {
    fontSize: 11,
    color: INK_SOFT,
    textAlign: 'right',
    marginTop: 10,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: LINE,
  },
  secondaryLabel: { color: INK_SOFT, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});
