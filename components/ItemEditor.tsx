import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import EditorActionGroup from './EditorActionGroup';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

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
 * This component renders the editor UI only. All state management and business logic
 * remains in the parent (EditableCollectionScreen).
 */
export default function ItemEditor({
  draftName,
  draftAmount,
  draftSecondaryNumber,
  draftLiquidityType,
  draftUnlockAge,
  editingItemId,
  errorMessage,
  focusedInput,
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

  return (
    <View style={styles.activeEntryWrapper}>
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

      {/* Name and Amount fields */}
      {editingItemId ? (
        // Edit mode: Vertical stack with labels
        <>
          {canEditItemName ? (
            <View style={styles.editorField}>
              <Text style={[styles.editorFieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Name</Text>
              {renderCustomNameField ? (
                renderCustomNameField({
                  value: draftName,
                  onChange: onDraftNameChange,
                  placeholder: 'Name',
                  editingItemId,
                })
              ) : (
                <TextInput
                  style={[
                    styles.input,
                    styles.editorFieldInputFull,
                    {
                      backgroundColor: theme.colors.bg.input,
                      borderColor: focusedInput === 'name' ? theme.colors.border.default : 'transparent',
                      borderRadius: theme.radius.medium,
                      color: theme.colors.text.primary,
                    },
                  ]}
                  value={draftName}
                  onChangeText={onDraftNameChange}
                  placeholder="Name"
                  placeholderTextColor={theme.colors.text.disabled}
                  autoFocus={false}
                  returnKeyType="next"
                  onFocus={() => onFocusedInputChange('name')}
                  onBlur={() => onFocusedInputChange(null)}
                />
              )}
            </View>
          ) : null}
          <View style={styles.editorField}>
            <Text style={[styles.editorFieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Amount</Text>
            <View style={[styles.activeEntryRow, { alignItems: 'center' }]}>
              <TextInput
                style={[
                  styles.input,
                  theme.typography.input,
                  styles.amountInputFixed,
                  {
                    backgroundColor: theme.colors.bg.input,
                    borderColor: focusedInput === 'amount' ? theme.colors.border.default : 'transparent',
                    borderRadius: theme.radius.medium,
                    color: theme.colors.text.primary,
                  },
                ]}
                value={draftAmount}
                onChangeText={onDraftAmountChange}
                placeholder="Amount"
                placeholderTextColor={theme.colors.text.disabled}
                keyboardType="numeric"
                returnKeyType={secondaryNumberField || liquidityField ? 'next' : 'done'}
                onSubmitEditing={!secondaryNumberField && !liquidityField ? onSave : undefined}
                onFocus={() => onFocusedInputChange('amount')}
                onBlur={() => onFocusedInputChange(null)}
              />
              <View style={{ width: spacing.tiny }} />
              {renderActionButtons ? (
                renderActionButtons({ onSave, onCancel, editingItemId })
              ) : (
                <EditorActionGroup onSave={onSave} onCancel={onCancel} editingItemId={editingItemId} />
              )}
            </View>
          </View>
        </>
      ) : (
        // Add mode: Horizontal row with buttons
        <>
          {/* Row 1: Name + Amount (primary inputs) */}
          <View style={[styles.activeEntryRow, styles.activeEntryRowSpacing]}>
            {canEditItemName ? (
              renderCustomNameField ? (
                <View style={styles.activeEntryNameSplit}>
                  {renderCustomNameField({
                    value: draftName,
                    onChange: onDraftNameChange,
                    placeholder: 'Name',
                    editingItemId: null,
                  })}
                </View>
              ) : (
                <TextInput
                  style={[
                    styles.input,
                    theme.typography.input,
                    styles.activeEntryNameSplit,
                    {
                      backgroundColor: theme.colors.bg.input,
                      borderColor: focusedInput === 'name' ? theme.colors.border.default : 'transparent',
                      borderRadius: theme.radius.medium,
                      color: theme.colors.text.primary,
                    },
                  ]}
                  value={draftName}
                  onChangeText={onDraftNameChange}
                  placeholder="New Expense Name"
                  placeholderTextColor={theme.colors.text.disabled}
                  autoFocus={false}
                  returnKeyType="next"
                  onFocus={() => onFocusedInputChange('name')}
                  onBlur={() => onFocusedInputChange(null)}
                />
              )
            ) : null}
            <TextInput
              style={[
                styles.input,
                theme.typography.input,
                styles.activeEntryAmountSplit,
                {
                  backgroundColor: theme.colors.bg.input,
                  borderColor: focusedInput === 'amount' ? theme.colors.border.default : 'transparent',
                  borderRadius: theme.radius.medium,
                  color: theme.colors.text.primary,
                },
              ]}
              value={draftAmount}
              onChangeText={onDraftAmountChange}
              placeholder="Amount"
              placeholderTextColor={theme.colors.text.disabled}
              keyboardType="numeric"
              returnKeyType={secondaryNumberField || liquidityField ? 'next' : 'done'}
              onSubmitEditing={!secondaryNumberField && !liquidityField ? onSave : undefined}
              onFocus={() => onFocusedInputChange('amount')}
              onBlur={() => onFocusedInputChange(null)}
            />
            {/* Only show action buttons in Row 1 if there are no secondary fields */}
            {!(secondaryNumberField || liquidityField) ? (
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
        </>
      )}

      {/* Editor assumptions section */}
      {(secondaryNumberField || liquidityField) ? (
        editingItemId ? (
          // Edit mode: Vertical stack with label and value
          <View style={styles.editorAssumptionsSection}>
            {/* Growth rate */}
            {secondaryNumberField ? (
              <View style={styles.editorField}>
                <Text style={[styles.editorFieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>
                  Growth rate (% per year)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.editorFieldInputFull,
                    {
                      backgroundColor: theme.colors.bg.card,
                      borderColor: theme.colors.border.default,
                      borderRadius: theme.radius.medium,
                      color: theme.colors.text.primary,
                    },
                  ]}
                  value={draftSecondaryNumber}
                  onChangeText={onDraftSecondaryNumberChange}
                  placeholder={secondaryNumberField.placeholder ?? 'Growth %'}
                  placeholderTextColor={theme.colors.text.disabled}
                  keyboardType="numeric"
                  returnKeyType={liquidityField ? 'next' : 'done'}
                  onSubmitEditing={!liquidityField ? onSave : undefined}
                />
              </View>
            ) : null}

            {/* Liquidity */}
            {liquidityField ? (
              <View style={styles.editorField}>
                <Text style={[styles.editorFieldLabelGrey, theme.typography.label, { color: theme.colors.text.disabled }]}>Liquidity</Text>
                <SegmentedControl
                  values={['Liquid', 'Locked', 'Illiquid']}
                  selectedIndex={draftLiquidityType === 'immediate' ? 0 : draftLiquidityType === 'locked' ? 1 : 2}
                  onChange={(event) => {
                    const index = event.nativeEvent.selectedSegmentIndex;
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
                  fontStyle={{ color: theme.colors.text.disabled }}
                  activeFontStyle={{ color: theme.colors.text.disabled }}
                />

                {draftLiquidityType === 'locked' ? (
                  <View style={styles.unlockAgeContainer}>
                    <Text style={[styles.unlockAgeLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Unlock age</Text>
                    <View style={styles.unlockAgeRow}>
                      <TextInput
                        style={[
                          styles.input,
                          theme.typography.input,
                          styles.unlockAgeInput,
                          {
                            backgroundColor: theme.colors.bg.card,
                            borderColor: theme.colors.border.default,
                            borderRadius: theme.radius.medium,
                            color: theme.colors.text.primary,
                          },
                        ]}
                        value={draftUnlockAge}
                        onChangeText={onDraftUnlockAgeChange}
                        placeholder="e.g. 55"
                        placeholderTextColor={theme.colors.text.disabled}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={onSave}
                      />
                      <Text style={[styles.unlockAgeSuffix, theme.typography.bodySmall, { color: theme.colors.text.disabled }]}>years</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          // Add mode: Compact, no header, same row
          <View style={styles.editorAssumptionsCompact}>
            <View style={[styles.activeEntryRow, { alignItems: 'center' }]}>
              {/* Left group: Growth % + Liquidity */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {/* Growth rate */}
                {secondaryNumberField ? (
                  <TextInput
                    style={[
                      styles.input,
                      theme.typography.input,
                      styles.editorFieldInputCompact,
                      {
                        width: 80,
                        backgroundColor: theme.colors.bg.input,
                        borderColor: 'transparent',
                        borderRadius: theme.radius.medium,
                        color: theme.colors.text.primary,
                      },
                    ]}
                    value={draftSecondaryNumber}
                    onChangeText={onDraftSecondaryNumberChange}
                    placeholder={secondaryNumberField.placeholder ?? 'Growth %'}
                    placeholderTextColor={theme.colors.text.disabled}
                    keyboardType="numeric"
                    returnKeyType={liquidityField ? 'next' : 'done'}
                    onSubmitEditing={!liquidityField ? onSave : undefined}
                  />
                ) : null}

                {/* Liquidity */}
                {liquidityField ? (
                  <View style={styles.liquidityFieldWrapper}>
                    <SegmentedControl
                      values={['Liquid', 'Locked', 'Illiquid']}
                      selectedIndex={draftLiquidityType === 'immediate' ? 0 : draftLiquidityType === 'locked' ? 1 : 2}
                      onChange={(event) => {
                        const index = event.nativeEvent.selectedSegmentIndex;
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
                      tintColor={theme.colors.bg.input}
                      style={[
                        styles.segmentedControlField,
                        {
                          backgroundColor: theme.colors.bg.input,
                          borderRadius: theme.radius.medium,
                        },
                      ]}
                      fontStyle={{ color: theme.colors.text.disabled }}
                      activeFontStyle={{ color: theme.colors.text.disabled }}
                    />
                  </View>
                ) : null}
              </View>

              {/* Flex spacer */}
              <View style={{ flex: 1 }} />

              {/* Right group: Action buttons */}
              <View style={{ flexDirection: 'row' }}>
                {renderActionButtons ? (
                  renderActionButtons({ onSave, onCancel, editingItemId })
                ) : (
                  <EditorActionGroup onSave={onSave} onCancel={onCancel} editingItemId={editingItemId} />
                )}
              </View>
            </View>

            {/* Unlock age (if From age selected) - shown below in compact mode too */}
            {liquidityField && draftLiquidityType === 'locked' ? (
              <View style={styles.unlockAgeContainer}>
                <Text style={[styles.unlockAgeLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Unlock age</Text>
                <View style={styles.unlockAgeRow}>
                  <TextInput
                    style={[
                      styles.input,
                      theme.typography.input,
                      styles.unlockAgeInput,
                      {
                        backgroundColor: theme.colors.bg.card,
                        borderColor: theme.colors.border.default,
                        borderRadius: theme.radius.medium,
                        color: theme.colors.text.primary,
                      },
                    ]}
                    value={draftUnlockAge}
                    onChangeText={onDraftUnlockAgeChange}
                    placeholder="e.g. 55"
                    placeholderTextColor={theme.colors.text.disabled}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={onSave}
                  />
                  <Text style={[styles.unlockAgeSuffix, theme.typography.bodySmall, { color: theme.colors.text.disabled }]}>years</Text>
                </View>
              </View>
            ) : null}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  activeEntryWrapper: {
    // No margin - spacing handled by SectionCard paddingVertical
  },
  activeEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  activeEntryRowSpacing: {
    marginBottom: spacing.tiny,
  },
  activeEntryNameSplit: {
    flex: 1,
    marginRight: spacing.xs,
    justifyContent: 'center',
  },
  activeEntryAmountSplit: {
    flex: 0.25,
  },
  input: {
    borderWidth: 1,
    padding: layout.inputPadding,
    // Typography via theme.typography.input (applied to TextInput components)
  },
  errorCard: {
    borderWidth: 1,
    padding: layout.inputPadding,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    marginBottom: spacing.tiny,
  },
  errorText: {
    // Typography via theme.typography.body
  },
  editorAssumptionsSection: {
    marginTop: spacing.sm,
  },
  editorAssumptionsCompact: {
    marginTop: spacing.sm,
  },
  editorField: {
    marginBottom: spacing.xs,
  },
  editorFieldLabel: {
    marginBottom: spacing.tiny,
  },
  editorFieldLabelGrey: {
    marginBottom: spacing.tiny,
  },
  editorFieldInputFull: {
    width: '100%',
  },
  editorFieldInputCompact: {
    width: layout.amountInputWidth,
  },
  amountInputFixed: {
    width: layout.amountInputWidth,
  },
  liquidityFieldWrapper: {
    width: 185,
  },
  segmentedControl: {
    marginBottom: spacing.sm,
    height: 32,
  },
  segmentedControlField: {
    width: '100%',
    height: 40,
  },
  unlockAgeContainer: {
    marginTop: spacing.tiny,
    marginBottom: spacing.tiny,
  },
  unlockAgeLabel: {
    marginBottom: spacing.tiny,
  },
  unlockAgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unlockAgeInput: {
    width: 100,
  },
  unlockAgeSuffix: {
    // Typography via theme.typography.bodySmall
  },
});
