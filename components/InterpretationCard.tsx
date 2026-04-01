/**
 * Phase 10.4 / KPI Redesign: Interpretation Card
 *
 * Hero card displayed above the projection chart.
 * Shows the projection headline, 3 user-selectable KPI tiles, and net worth milestone pills.
 *
 * KPI tiles use a tinted mini-card style (icon + value + label).
 * The user can tap the edit button to open the KPI picker and choose which 3 metrics to display.
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil, CheckCircle, CircleIcon, Warning, CaretRight } from 'phosphor-react-native';
import type { DetectedProblem } from '../projection/detectProblems';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import SectionCard from './SectionCard';
import Button from './Button';
import { formatCurrencyCompact } from '../ui/formatters';
import { typography, radius } from '../ui/theme/theme';
import type { KpiData, KpiId, KpiDefinition } from '../domain/kpi/kpiDefinitions';
import { ALL_KPI_DEFINITIONS } from '../domain/kpi/kpiDefinitions';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InterpretationCardProps {
  kpiData: KpiData;
  selectedKpiIds: KpiId[];
  onSaveKpis: (ids: KpiId[]) => void;
  /** Whether liabilities exist (used to contextualise headline) */
  hasLiabilities: boolean;
  /** Detected problems from Phase 13 back-solve engine; enables tappable warnings */
  detectedProblems?: DetectedProblem[];
  /** Called when the user taps a solvable warning */
  onSolveProblem?: (problem: DetectedProblem) => void;
  style?: object;
}

// ─── Warning Row ─────────────────────────────────────────────────────────────

function WarningRow({
  message,
  level,
  onPress,
}: {
  message: string;
  level: 'error' | 'warning';
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const isError = level === 'error';
  const textColor = isError ? theme.colors.semantic.errorText : theme.colors.semantic.warningText;

  const inner = (
    <View
      style={[
        styles.warningRow,
        {
          backgroundColor: isError ? theme.colors.semantic.errorBg : theme.colors.semantic.warningBg,
          borderRadius: theme.radius.base,
        },
      ]}
    >
      <Warning
        size={14}
        color={isError ? theme.colors.semantic.error : theme.colors.semantic.warning}
        weight="fill"
      />
      <Text style={[styles.warningText, { color: textColor }]}>{message}</Text>
      {onPress != null && <CaretRight size={12} color={textColor} weight="bold" />}
    </View>
  );

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.bg.subtlePressed : 'transparent' })}
        accessibilityRole="button"
        accessibilityLabel="Fix this problem"
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

interface KpiTileProps {
  definition: KpiDefinition;
  kpiData: KpiData;
}

function KpiTile({ definition, kpiData }: KpiTileProps) {
  const { theme } = useTheme();
  const value = definition.compute(kpiData);
  const IconComponent = definition.Icon;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.colors.brand.tint,
          borderRadius: theme.radius.medium,
        },
      ]}
    >
      <IconComponent size={16} color={theme.colors.brand.primary} weight="regular" />
      <Text style={[styles.tileValue, { color: theme.colors.text.primary }]}>
        {value ?? '—'}
      </Text>
      <Text style={[styles.tileLabel, { color: theme.colors.text.muted }]}>
        {definition.label}
      </Text>
    </View>
  );
}

// ─── KPI Picker Modal ─────────────────────────────────────────────────────────

interface KpiPickerModalProps {
  visible: boolean;
  currentSelection: KpiId[];
  onSave: (ids: KpiId[]) => void;
  onDismiss: () => void;
}

function KpiPickerModal({ visible, currentSelection, onSave, onDismiss }: KpiPickerModalProps) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<KpiId[]>(currentSelection);

  // Reset draft whenever the modal opens with a fresh selection
  React.useEffect(() => {
    if (visible) setDraft(currentSelection);
  }, [visible, currentSelection]);

  function toggle(id: KpiId) {
    setDraft(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}
        onPress={onDismiss}
      />

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.bg.card,
            borderTopLeftRadius: theme.radius.modal,
            borderTopRightRadius: theme.radius.modal,
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: theme.colors.border.subtle }]} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.colors.text.primary }]}>
            Choose metrics
          </Text>
          <Text style={[styles.sheetSubtitle, { color: theme.colors.text.muted }]}>
            Pick exactly 3 to display
          </Text>
        </View>

        {/* KPI list */}
        <ScrollView
          style={styles.pickerList}
          contentContainerStyle={styles.pickerListContent}
          showsVerticalScrollIndicator={false}
        >
          {ALL_KPI_DEFINITIONS.map(def => {
            const isSelected = draft.includes(def.id);
            const isDisabled = !isSelected && draft.length >= 3;
            const IconComponent = def.Icon;
            const rowColor = isDisabled
              ? theme.colors.text.disabled
              : theme.colors.text.primary;
            const iconColor = isDisabled
              ? theme.colors.text.disabled
              : theme.colors.brand.primary;

            return (
              <Pressable
                key={def.id}
                onPress={() => toggle(def.id)}
                disabled={isDisabled}
                style={({ pressed }) => [
                  styles.pickerRow,
                  {
                    borderBottomColor: theme.colors.border.subtle,
                    opacity: isDisabled ? 0.4 : 1,
                    backgroundColor: !isDisabled && pressed ? theme.colors.bg.subtlePressed : 'transparent',
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              >
                {/* Icon + label + description */}
                <View style={styles.pickerRowLeft}>
                  <IconComponent size={18} color={iconColor} weight="regular" />
                  <View style={styles.pickerRowText}>
                    <Text style={[styles.pickerRowLabel, { color: rowColor }]}>
                      {def.label}
                    </Text>
                    <Text style={[styles.pickerRowDesc, { color: theme.colors.text.muted }]}>
                      {def.description}
                    </Text>
                  </View>
                </View>

                {/* Check indicator */}
                {isSelected ? (
                  <CheckCircle
                    size={20}
                    color={theme.colors.brand.primary}
                    weight="fill"
                  />
                ) : (
                  <CircleIcon size={20} color={theme.colors.border.default} weight="regular" />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Save */}
        <View style={styles.sheetFooter}>
          <Button
            variant="primary"
            size="md"
            onPress={() => { onSave(draft); onDismiss(); }}
            disabled={draft.length !== 3}
          >
            Save
          </Button>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InterpretationCard({
  kpiData,
  selectedKpiIds,
  onSaveKpis,
  detectedProblems,
  onSolveProblem,
  style,
}: InterpretationCardProps) {
  const { theme } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);

  const { interpretation, monthlySurplus, endAge, bridgeGap } = kpiData;

  // Build ordered warning list: errors first, then warnings.
  // Warnings that map to a DetectedProblem get an onPress handler.
  const warnings: Array<{ message: string; level: 'error' | 'warning'; problem?: DetectedProblem }> = [];

  if (monthlySurplus < 0) {
    warnings.push({
      level: 'error',
      message: `Spending exceeds income by ${formatCurrencyCompact(Math.abs(monthlySurplus))}/mo`,
    });
  }

  if (interpretation.depletionAge != null && interpretation.depletionAge < endAge) {
    const gap = Math.round(endAge - interpretation.depletionAge);
    warnings.push({
      level: 'error',
      message: `Savings run out at age ${Math.round(interpretation.depletionAge)}. Your plan runs to ${Math.round(endAge)} — a ${gap}-year gap.`,
      problem: detectedProblems?.find(p => p.kind === 'LONGEVITY_GAP'),
    });
  }

  if (bridgeGap != null) {
    const gapYears = Math.round(bridgeGap.toAge - bridgeGap.fromAge);
    warnings.push({
      level: 'warning',
      message: `Savings run out at age ${Math.round(bridgeGap.fromAge)} before ${bridgeGap.assetName} unlocks at ${Math.round(bridgeGap.toAge)} — a ${gapYears}-year gap.`,
      problem: detectedProblems?.find(p => p.kind === 'BRIDGE_GAP'),
    });
  }

  if (monthlySurplus > 100) {
    warnings.push({
      level: 'warning',
      message: `${formatCurrencyCompact(monthlySurplus)}/mo unallocated — consider increasing contributions`,
    });
  }

  const selectedDefinitions = selectedKpiIds
    .map(id => ALL_KPI_DEFINITIONS.find(d => d.id === id))
    .filter((d): d is KpiDefinition => d != null);

  return (
    <>
      <SectionCard style={[styles.card, style]}>
        {/* Header row with title + edit button */}
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.brand.primary },
            ]}
          >
            Your Projection
          </Text>
          <Pressable
            onPress={() => setPickerVisible(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Edit metrics"
            style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.bg.subtlePressed : 'transparent' })}
          >
            <Pencil size={16} color={theme.colors.text.secondary} weight="regular" />
          </Pressable>
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: theme.colors.text.primary }]}>
          {interpretation.headline}
        </Text>

        {/* Subline */}
        {interpretation.subline ? (
          <Text style={[styles.subline, { color: theme.colors.text.secondary }]}>
            {interpretation.subline}
          </Text>
        ) : null}

        {/* KPI tiles */}
        <View style={styles.tilesRow}>
          {selectedDefinitions.map(def => (
            <KpiTile key={def.id} definition={def} kpiData={kpiData} />
          ))}
        </View>

        {/* Actionable warnings — tappable when a DetectedProblem is attached */}
        {warnings.length > 0 ? (
          <View style={styles.warningsContainer}>
            {warnings.map((w, i) => (
              <WarningRow
                key={i}
                message={w.message}
                level={w.level}
                onPress={
                  w.problem != null && onSolveProblem != null
                    ? () => onSolveProblem(w.problem!)
                    : undefined
                }
              />
            ))}
          </View>
        ) : null}
      </SectionCard>

      <KpiPickerModal
        visible={pickerVisible}
        currentSelection={selectedKpiIds}
        onSave={onSaveKpis}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {},

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.sectionTitleBottom,
  },
  sectionTitle: {
    ...typography.sectionTitle,
  },

  // Headline / subline
  headline: {
    ...typography.sectionTitle,
    marginTop: spacing.sm,
  },
  subline: {
    ...typography.body,
    marginTop: spacing.xs,
  },

  // KPI tiles
  tilesRow: {
    flexDirection: 'row',
    marginTop: spacing.base,
    gap: spacing.xs,
  },
  tile: {
    flex: 1,
    padding: spacing.sm,
    gap: spacing.tiny,
  },
  tileValue: {
    ...typography.value,
    marginTop: spacing.tiny,
  },
  tileLabel: {
    ...typography.caption,
  },

  // Warnings
  warningsContainer: {
    marginTop: spacing.sm,
    gap: spacing.tiny,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    flex: 1,
  },

  // Picker modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.base,
  },
  sheetTitle: {
    ...typography.sectionTitle,
  },
  sheetSubtitle: {
    ...typography.caption,
    marginTop: spacing.tiny,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerListContent: {
    paddingHorizontal: spacing.xl,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
  },
  pickerRowText: {
    flex: 1,
    gap: spacing.tiny,
  },
  pickerRowLabel: {
    ...typography.body,
  },
  pickerRowDesc: {
    ...typography.caption,
  },
  sheetFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
  },
});
