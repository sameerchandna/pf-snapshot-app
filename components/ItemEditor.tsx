import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import EditorActionGroup from './EditorActionGroup';
import SketchSegmentedControl from './SketchSegmentedControl';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import SketchCard from './SketchCard';

type ItemEditorProps = {
  // State
  draftName: string;
  draftAmount: string;
  draftSecondaryNumber: string;
  draftLiquidityType: 'immediate' | 'locked' | 'illiquid';
  draftUnlockAge: string;
  editingItemId: string | null;
  errorMessage: string;
  focusedInput: 'name' | 'amount' | null;

  // Setters
  onDraftNameChange: (value: string) => void;
  onDraftAmountChange: (value: string) => void;
  onDraftSecondaryNumberChange: (value: string) => void;
  onDraftLiquidityTypeChange: (type: 'immediate' | 'locked' | 'illiquid') => void;
  onDraftUnlockAgeChange: (value: string) => void;
  onFocusedInputChange: (input: 'name' | 'amount' | null) => void;

  // Actions
  onSave: () => void;
  onCancel: () => void;

  // Configuration
  canEditItemName: boolean;
  renderCustomNameField?: (props: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    editingItemId: string | null;
  }) => React.ReactNode;
  renderActionButtons?: (props: {
    onSave: () => void;
    onCancel: () => void;
    editingItemId: string | null;
  }) => React.ReactNode;
  secondaryNumberField?: {
    label: string;
    placeholder?: string;
    min?: number;
    max?: number;
  };
  liquidityField?: {
    currentAge?: number;
  };
};

/**
 * ItemEditor - Dumb UI component for editing financial items.
 *
 * Layout — secondary field only (e.g. Liabilities with Interest Rate):
 *   Row 1 — Name + Rate % + Amount + Buttons
 *
 * Layout — with liquidity field (e.g. Assets):
 *   Row 1 — Name + Amount
 *   Row 2 — Growth % | Liquidity segment | Unlock age (always visible, disabled unless Locked)
 *   Row 3 — Tick / X buttons, centred
 */
export default function ItemEditor({
  draftName,
  draftAmount,
  draftSecondaryNumber,
  draftLiquidityType,
  draftUnlockAge,
  editingItemId,
  errorMessage,
  onDraftNameChange,
  onDraftAmountChange,
  onDraftSecondaryNumberChange,
  onDraftLiquidityTypeChange,
  onDraftUnlockAgeChange,
  onFocusedInputChange,
  onSave,
  onCancel,
  canEditItemName,
  renderCustomNameField,
  renderActionButtons,
  secondaryNumberField,
  liquidityField,
}: ItemEditorProps) {
  const { theme } = useTheme();
  const palette = useScreenPalette();

  // secondaryOnly: secondary field sits inline in Row 1 (no separate assumptions row needed)
  const secondaryOnly = !!(secondaryNumberField && !liquidityField);
  // hasLiquidityAssumptions: full Row 2 with liquidity controls + Row 3 buttons
  const hasLiquidityAssumptions = !!liquidityField;
  const unlockLocked = draftLiquidityType === 'locked';

  return (
    <View style={styles.activeEntryWrapper}>
      {/* Error banner */}
      {errorMessage.length > 0 ? (
        <View
          style={[
            styles.errorCard,
            {
              backgroundColor: theme.colors.semantic.errorBg,
              borderColor: theme.colors.semantic.errorBorder,
              borderRadius: theme.radius.medium,
            },
          ]}
        >
          <Text style={[styles.errorTitle, theme.typography.body, { fontWeight: '700', color: theme.colors.semantic.errorText }]}>
            Can't save
          </Text>
          <Text style={[styles.errorText, theme.typography.body, { color: theme.colors.semantic.errorText }]}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* ── Row 1: Name [+ Rate %] + Amount [+ Buttons when no liquidity] ── */}
      <View style={[styles.activeEntryRow, hasLiquidityAssumptions && styles.activeEntryRowSpacing]}>
        {canEditItemName ? (
          renderCustomNameField ? (
            <View style={styles.activeEntryNameSplit}>
              {renderCustomNameField({
                value: draftName,
                onChange: onDraftNameChange,
                placeholder: 'Name',
                editingItemId,
              })}
            </View>
          ) : (
            <SketchCard
              borderColor={palette.accent}
              fillColor={theme.colors.bg.input}
              borderRadius={theme.radius.medium}
              style={styles.activeEntryNameSplit}
            >
              <TextInput
                style={[styles.inputInner, theme.typography.input, { color: theme.colors.text.primary }]}
                value={draftName}
                onChangeText={onDraftNameChange}
                placeholder="Name"
                placeholderTextColor={theme.colors.text.disabled}
                autoFocus={false}
                returnKeyType="next"
                onFocus={() => onFocusedInputChange('name')}
                onBlur={() => onFocusedInputChange(null)}
              />
            </SketchCard>
          )
        ) : null}
        <SketchCard
          borderColor={palette.accent}
          fillColor={theme.colors.bg.input}
          borderRadius={theme.radius.medium}
          style={styles.activeEntryAmountSplit}
        >
          <TextInput
            style={[styles.inputInner, theme.typography.input, { color: theme.colors.text.primary }]}
            value={draftAmount}
            onChangeText={onDraftAmountChange}
            placeholder="Amount"
            placeholderTextColor={theme.colors.text.disabled}
            keyboardType="numeric"
            returnKeyType={hasLiquidityAssumptions ? 'next' : secondaryOnly ? 'next' : 'done'}
            onSubmitEditing={!hasLiquidityAssumptions && !secondaryOnly ? onSave : undefined}
            onFocus={() => onFocusedInputChange('amount')}
            onBlur={() => onFocusedInputChange(null)}
          />
        </SketchCard>
        {/* Secondary field inline (e.g. Interest Rate) — only when no liquidity controls */}
        {secondaryOnly ? (
          <SketchCard
            borderColor={palette.accent}
            fillColor={theme.colors.bg.input}
            borderRadius={theme.radius.medium}
            style={styles.activeEntrySecondarySplit}
          >
            <TextInput
              style={[styles.inputInner, theme.typography.input, { color: theme.colors.text.primary, textAlign: 'center' }]}
              value={draftSecondaryNumber}
              onChangeText={onDraftSecondaryNumberChange}
              placeholder={secondaryNumberField!.placeholder ?? '%'}
              placeholderTextColor={theme.colors.text.disabled}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={onSave}
            />
          </SketchCard>
        ) : null}
        {!hasLiquidityAssumptions ? (
          <>
            <View style={{ width: spacing.tiny }} />
            {renderActionButtons ? (
              renderActionButtons({ onSave, onCancel, editingItemId })
            ) : (
              <EditorActionGroup onSave={onSave} onCancel={onCancel} editingItemId={editingItemId} />
            )}
          </>
        ) : null}
      </View>

      {/* ── Row 2: Growth | Liquidity segment | Unlock age (only when liquidity controls present) ── */}
      {hasLiquidityAssumptions ? (
        <View style={styles.assumptionsRow}>
          {/* Growth % */}
          {secondaryNumberField ? (
            <View style={styles.growthWrapper}>
              <Text style={[styles.fieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>
                Growth %
              </Text>
              <SketchCard
                borderColor={palette.accent}
                fillColor={theme.colors.bg.input}
                borderRadius={theme.radius.medium}
                style={styles.growthInput}
              >
                <TextInput
                  style={[styles.inputInner, theme.typography.input, { color: theme.colors.text.primary }]}
                  value={draftSecondaryNumber}
                  onChangeText={onDraftSecondaryNumberChange}
                  placeholder={secondaryNumberField.placeholder ?? '0'}
                  placeholderTextColor={theme.colors.text.disabled}
                  keyboardType="numeric"
                  returnKeyType={liquidityField ? 'next' : 'done'}
                  onSubmitEditing={!liquidityField ? onSave : undefined}
                />
              </SketchCard>
            </View>
          ) : null}

          {/* Liquidity segment */}
          {liquidityField ? (
            <View style={styles.liquidityWrapper}>
              <Text style={[styles.fieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>
                Liquidity
              </Text>
              <SketchSegmentedControl
                values={['Liquid', 'Locked', 'Illiquid']}
                selectedIndex={draftLiquidityType === 'immediate' ? 0 : draftLiquidityType === 'locked' ? 1 : 2}
                onChange={(index) => {
                  if (index === 0) {
                    onDraftLiquidityTypeChange('immediate');
                    onDraftUnlockAgeChange('');
                  } else if (index === 1) {
                    onDraftLiquidityTypeChange('locked');
                  } else {
                    onDraftLiquidityTypeChange('illiquid');
                    onDraftUnlockAgeChange('');
                  }
                }}
                style={styles.segmentedControl}
              />
            </View>
          ) : null}

          {/* Unlock age — always visible, disabled unless Locked */}
          {liquidityField ? (
            <View style={[styles.unlockWrapper, !unlockLocked && styles.unlockDisabled]}>
              <Text style={[styles.fieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>
                Unlock age
              </Text>
              <SketchCard
                borderColor={palette.accent}
                fillColor={theme.colors.bg.input}
                borderRadius={theme.radius.medium}
                style={styles.unlockInput}
              >
                <TextInput
                  style={[styles.inputInner, theme.typography.input, { color: theme.colors.text.primary }]}
                  value={draftUnlockAge}
                  onChangeText={onDraftUnlockAgeChange}
                  placeholder="55"
                  placeholderTextColor={theme.colors.text.disabled}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={onSave}
                  editable={unlockLocked}
                />
              </SketchCard>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Row 3: Action buttons, centred (only when liquidity controls present) ── */}
      {hasLiquidityAssumptions ? (
        <View style={styles.actionRow}>
          {renderActionButtons ? (
            renderActionButtons({ onSave, onCancel, editingItemId })
          ) : (
            <EditorActionGroup onSave={onSave} onCancel={onCancel} editingItemId={editingItemId} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  activeEntryWrapper: {
    // No margin — spacing handled by SectionCard paddingVertical
  },
  activeEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeEntryRowSpacing: {
    marginBottom: spacing.sm,
  },
  activeEntryNameSplit: {
    flex: 1,
    justifyContent: 'center',
  },
  activeEntrySecondarySplit: {
    width: 64,
  },
  activeEntryAmountSplit: {
    flex: 0.45,
  },
  inputInner: {
    padding: layout.inputPadding,
    alignSelf: 'stretch',
  },
  errorCard: {
    borderWidth: 1,
    padding: layout.inputPadding,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    marginBottom: spacing.tiny,
  },
  errorText: {},
  // Row 2: assumptions
  assumptionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    marginBottom: spacing.tiny,
    textAlign: 'center',
  },
  growthWrapper: {
    width: 72,
  },
  growthInput: {
    width: '100%',
  },
  liquidityWrapper: {
    flex: 1,
  },
  segmentedControl: {
    width: '100%',
  },
  unlockWrapper: {
    width: 72,
  },
  unlockDisabled: {
    opacity: 0.35,
  },
  unlockInput: {
    width: '100%',
  },
  // Row 3: centred action buttons
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
