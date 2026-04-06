import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { radius, typography } from '../ui/theme/theme';
import SketchCard from '../components/SketchCard';

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
  const { theme } = useTheme();
  const palette = useScreenPalette();
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
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader title={title} />

      <View style={styles.content}>
        <View style={[
          styles.card,
          {
            backgroundColor: theme.colors.bg.subtle,
            borderColor: theme.colors.border.default,
          }
        ]}>
          <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{label}</Text>
          {isEditing ? (
            <View>
              {hasError ? (
                <View style={[
                  styles.errorCard,
                  {
                    backgroundColor: theme.colors.semantic.errorBg,
                    borderColor: theme.colors.semantic.errorBorder,
                  }
                ]}>
                  <Text style={[styles.errorTitle, { color: theme.colors.semantic.errorText }]}>Can't save</Text>
                  <Text style={[styles.errorText, { color: theme.colors.semantic.errorText }]}>{errorMessage}</Text>
                </View>
              ) : null}
              <SketchCard
                borderColor={palette.accent}
                fillColor={theme.colors.bg.card}
                borderRadius={radius.base}
                style={styles.inputWrapper}
              >
                <TextInput
                  style={styles.inputInner}
                  value={draft}
                  onChangeText={setDraft}
                  keyboardType="numeric"
                  autoFocus={true}
                />
              </SketchCard>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={save}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    }
                  ]}
                >
                  <Text style={[styles.actionButtonText, { color: theme.colors.text.tertiary }]}>Save</Text>
                </Pressable>
                <Pressable
                  onPress={cancelEdit}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    }
                  ]}
                >
                  <Text style={[styles.actionButtonText, { color: theme.colors.text.tertiary }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable disabled={!canEdit} onPress={startEdit} style={styles.valueRow}>
              <Text style={[styles.value, { color: theme.colors.text.primary }]}>{formattedValue}</Text>
              <Text style={[styles.editHint, { color: theme.colors.text.muted }]}>{helperText}</Text>
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
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  card: {
    padding: spacing.base,
    borderRadius: radius.medium,
    marginBottom: spacing.base,
    borderWidth: 1,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  valueRow: {
    paddingVertical: spacing.sm,
  },
  value: {
    ...typography.valueLarge,
  },
  editHint: {
    ...typography.body,
    marginTop: spacing.tiny,
  },
  inputWrapper: {
    alignSelf: 'stretch',
  },
  inputInner: {
    padding: layout.inputPadding,
    ...typography.valueLarge,
    alignSelf: 'stretch',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: radius.base,
    padding: layout.inputPadding,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    ...typography.groupTitle,
    marginBottom: spacing.tiny,
  },
  errorText: {
    ...typography.body,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.base,
    borderWidth: 1,
  },
  actionButtonText: {
    ...typography.bodyLarge,
  },
});


