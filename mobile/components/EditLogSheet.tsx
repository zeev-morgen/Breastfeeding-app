import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { FeedingLog, Side } from '@/lib/types';
import { SideButton } from './SideButton';
import { QualityRating } from './QualityRating';
import { StartTimePicker } from './StartTimePicker';

const SIDES: Side[] = ['LEFT', 'RIGHT'];

interface Props {
  log: FeedingLog | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updates: { side: Side; qualityScore: number; startTime: string }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}

export function EditLogSheet({ log, visible, onClose, onSave, onDelete }: Props) {
  const [side, setSide] = useState<Side>('LEFT');
  const [qualityScore, setQualityScore] = useState(4);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (log) {
      setSide(log.side === 'BOTH' ? 'LEFT' : log.side);
      setQualityScore(log.qualityScore);
      setStartTime(new Date(log.startTime));
    }
  }, [log]);

  const handleSave = async () => {
    if (!log) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await onSave({ side, qualityScore, startTime: startTime.toISOString() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('שמירה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!log) return;
    Alert.alert('למחוק את ההנקה?', 'הפעולה אינה הפיכה.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await onDelete();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
          } catch (err) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('מחיקה נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="סגירה"
            hitSlop={12}
          >
            <Text style={s.cancelText}>ביטול</Text>
          </Pressable>
          <Text style={s.title}>עריכת הנקה</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>מתי?</Text>
          <View style={s.field}>
            {/* key forces the wheel to re-anchor on the new log's time when
                the sheet re-opens for a different row. */}
            <StartTimePicker
              key={log?.id ?? 'edit-picker'}
              value={startTime}
              onChange={(v) => setStartTime(v ?? new Date())}
            />
          </View>

          <Text style={s.label}>צד</Text>
          <View style={[s.field, s.sideRow]}>
            {SIDES.map((sv) => (
              <SideButton key={sv} side={sv} selected={side === sv} onPress={setSide} />
            ))}
          </View>

          <Text style={s.label}>איכות</Text>
          <View style={s.field}>
            <QualityRating value={qualityScore} onChange={setQualityScore} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={saving || deleting}
            style={({ pressed }) => [s.saveBtn, (saving || deleting) && s.btnDisabled, pressed && s.btnPressed]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveLabel}>שמירת השינויים</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleDelete}
            disabled={saving || deleting}
            style={({ pressed }) => [s.deleteBtn, (saving || deleting) && s.btnDisabled, pressed && s.btnPressed]}
          >
            {deleting ? (
              <ActivityIndicator color="#B23A2D" />
            ) : (
              <Text style={s.deleteLabel}>מחיקת ההנקה</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const CREAM = '#FDF7EF';
const INK = '#2B1F1A';
const INK_SOFT = '#6B5A50';
const PRIMARY = '#C76A4A';
const DANGER = '#B23A2D';
const LINE = '#E6DBCB';

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CREAM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  cancelText: {
    fontSize: 15,
    color: PRIMARY,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: INK_SOFT,
    textTransform: 'uppercase',
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 4,
  },
  field: {
    marginBottom: 20,
  },
  sideRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: DANGER,
    backgroundColor: 'transparent',
  },
  deleteLabel: {
    color: DANGER,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
