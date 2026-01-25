import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';

type Props = {
  title: string;
  label: string;
  value: number;
  prefix: string;
  onSave: (value: number) => void;
  maxValue?: number;
  validate?: (nextValue: number) => string | null;
};

export default function SingleValueDetailScreen({
  title,
  label,
  value,
  prefix,
  onSave,
  maxValue,
  validate,
}: Props) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(value.toString());
  const [errorMessage, setErrorMessage] = useState<string>('');

  const formattedValue: string = useMemo(() => {
    return `${prefix}${value.toLocaleString('en-GB')}`;
  }, [prefix, value]);

  const helperText: string = useMemo(() => {
    return isEditing ? 'Edit value (numbers only)' : 'Tap to edit';
  }, [isEditing]);

  const canEdit: boolean = true;
  const hasError: boolean = errorMessage.length > 0;

  const startEdit = () => {
    setDraft(value.toString());
    setErrorMessage('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(value.toString());
    setErrorMessage('');
    setIsEditing(false);
  };

  const save = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setErrorMessage('Please enter a valid number.');
      return;
    }

    if (parsed < 0) {
      setErrorMessage('This value cannot be negative. Enter a number greater than or equal to 0.');
      return;
    }

    if (typeof maxValue === 'number' && parsed > maxValue) {
      setErrorMessage(`That value is too large. Max allowed is ${maxValue.toLocaleString('en-GB')}.`);
      return;
    }

    if (validate) {
      const customError = validate(parsed);
      if (customError) {
        setErrorMessage(customError);
        return;
      }
    }

    setErrorMessage('');
    onSave(parsed);
    setIsEditing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title={title} />

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>{label}</Text>
          {isEditing ? (
            <View>
              {hasError ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Can’t save</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                keyboardType="numeric"
                autoFocus={true}
              />
              <View style={styles.actionsRow}>
                <Pressable onPress={save} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Save</Text>
                </Pressable>
                <Pressable onPress={cancelEdit} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable disabled={!canEdit} onPress={startEdit} style={styles.valueRow}>
              <Text style={styles.value}>{formattedValue}</Text>
              <Text style={styles.editHint}>{helperText}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  valueRow: {
    paddingVertical: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
  },
  editHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 10,
    fontSize: 18,
  },
  errorCard: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#ffd6d6',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a1f1f',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#8a1f1f',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});


