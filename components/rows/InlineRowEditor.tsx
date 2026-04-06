/**
 * InlineRowEditor - Stateless inline form component for editing a single collection item in-place.
 *
 * Renders a single-row editor: optional leading checkbox slot + name TextInput + amount TextInput + save/cancel.
 * All state lives in EditableCollectionScreen; this component is purely presentational.
 */

import React, { useRef, useEffect } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/theme/useTheme';
import { useScreenPalette } from '../../ui/theme/palettes';
import { spacing } from '../../ui/spacing';
import SketchCircle from '../SketchCircle';
import SketchCard from '../SketchCard';
import Divider from '../Divider';

const CIRCLE_SIZE = 30;

const ROW_HEIGHT = 44;

type InlineRowEditorProps = {
  draftName: string;
  draftAmount: string;
  errorMessage: string;
  onDraftNameChange: (value: string) => void;
  onDraftAmountChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isLastInGroup: boolean;

  // Optional leading slot for active toggle (Expenses)
  leadingSlot?: React.ReactNode;

  // Optional replacement for the name TextInput (e.g. an asset picker)
  nameSlot?: React.ReactNode;
};

export default function InlineRowEditor({
  draftName,
  draftAmount,
  errorMessage,
  onDraftNameChange,
  onDraftAmountChange,
  onSave,
  onCancel,
  isLastInGroup,
  leadingSlot,
  nameSlot,
}: InlineRowEditorProps) {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus the name field when this row mounts (skip when nameSlot replaces the input)
    if (nameSlot) return;
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const hasError = errorMessage.length > 0;

  return (
    <>
    <View style={styles.container}>
      {/* Inline error banner */}
      {hasError ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: theme.colors.semantic.errorBg,
              borderColor: theme.colors.semantic.errorBorder,
              borderRadius: theme.radius.small,
            },
          ]}
        >
          <Text style={[styles.errorText, theme.typography.caption, { color: theme.colors.semantic.errorText }]}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Input row */}
      <View style={[styles.inputRow, { height: ROW_HEIGHT }]}>
        {leadingSlot ? (
          <View style={styles.leadingSlot}>{leadingSlot}</View>
        ) : null}

        {/* Name input — or custom nameSlot replacement */}
        {nameSlot ? (
          <View style={styles.nameInputWrapper}>{nameSlot}</View>
        ) : (
          <SketchCard
            borderColor={palette.accent}
            fillColor={theme.colors.bg.input}
            borderRadius={theme.radius.base}
            style={styles.nameInputWrapper}
          >
            <TextInput
              ref={nameRef}
              style={[styles.inputInner, theme.typography.body, { color: theme.colors.text.primary }]}
              value={draftName}
              onChangeText={onDraftNameChange}
              placeholder="Name"
              placeholderTextColor={theme.colors.text.disabled}
              returnKeyType="next"
              onSubmitEditing={() => {}}
            />
          </SketchCard>
        )}

        {/* Amount input */}
        <SketchCard
          borderColor={palette.accent}
          fillColor={theme.colors.bg.input}
          borderRadius={theme.radius.base}
          style={styles.amountInputWrapper}
        >
          <TextInput
            style={[styles.inputInner, theme.typography.body, { color: theme.colors.text.primary, textAlign: 'right' }]}
            value={draftAmount}
            onChangeText={onDraftAmountChange}
            placeholder="0"
            placeholderTextColor={theme.colors.text.disabled}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
        </SketchCard>

        {/* Save button (tick) */}
        <Pressable
          onPress={onSave}
          style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          accessibilityLabel="Save"
        >
          <SketchCircle
            size={CIRCLE_SIZE}
            fillColor={palette.sectionHeaderBg}
            borderColor={palette.accent}
          >
            <Text style={[theme.typography.button, { color: palette.accent }]}>✓</Text>
          </SketchCircle>
        </Pressable>

        {/* Cancel button (cross) */}
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          accessibilityLabel="Cancel"
        >
          <SketchCircle
            size={CIRCLE_SIZE}
            fillColor={theme.colors.bg.subtle}
            borderColor={palette.accent}
          >
            <Text style={[theme.typography.button, { color: palette.accent }]}>✕</Text>
          </SketchCircle>
        </Pressable>
      </View>
    </View>
    {!isLastInGroup && <Divider variant="subtle" />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  errorBanner: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    // typography spread applied inline
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leadingSlot: {
    marginRight: spacing.xs,
  },
  nameInputWrapper: {
    flex: 1,
    height: 36,
  },
  amountInputWrapper: {
    width: 90,
    height: 36,
  },
  inputInner: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
  },
});
