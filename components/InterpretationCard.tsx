/**
 * Phase 10.4 / KPI Redesign: Interpretation Card
 *
 * Hero card displayed above the projection chart.
 * Shows 3 user-selectable KPI circles, a merged headline, and warnings.
 *
 * KPI circles use SketchCircle (hand-drawn style) with value + label inside.
 * The user can tap the pencil icon to open the KPI picker and choose which 3 metrics to display.
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil, CheckCircle, CircleIcon } from 'phosphor-react-native';
import type { DetectedProblem } from '../projection/detectProblems';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import SectionCard from './SectionCard';
import SectionHeader from './SectionHeader';
import SketchCircle from './SketchCircle';
import Button from './Button';
import { formatCurrencyCompact } from '../ui/formatters';
import { typography, radius } from '../ui/theme/theme';
import { useScreenPalette } from '../ui/theme/palettes';
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

// ─── Warning paragraph ───────────────────────────────────────────────────────

function buildWarningParagraph(kpiData: KpiData): string | null {
  const { monthlySurplus, monthlyExpenses, liquidAssets, currentAge, endAge, retirementAge, bridgeGap, interpretation } = kpiData;

  const hasSurplusDeficit = monthlySurplus < 0;
  const hasBridgeGap = bridgeGap != null;
  const hasLongevityGap = interpretation.depletionAge != null && interpretation.depletionAge < endAge;

  if (!hasSurplusDeficit && !hasBridgeGap && !hasLongevityGap) return null;

  const sentences: string[] = [];

  if (hasSurplusDeficit) {
    sentences.push(`Your expenses are more than your income by ${formatCurrencyCompact(Math.abs(monthlySurplus))} a month.`);
  }

  if ((hasSurplusDeficit || hasBridgeGap) && monthlyExpenses > 0 && liquidAssets > 0) {
    const runwayYears = liquidAssets / (monthlyExpenses * 12);
    const runwayAge = Math.round(currentAge + runwayYears);
    const runwayText = runwayYears < 1
      ? `${Math.round(runwayYears * 12)} months`
      : `${runwayYears.toFixed(1)} years`;
    sentences.push(`If your income was to suddenly stop today, your accessible savings may support you for about ${runwayText} — until around age ${runwayAge}.`);
  }

  if (hasBridgeGap) {
    const gapYears = Math.round(bridgeGap!.toAge - bridgeGap!.fromAge);
    sentences.push(`If you plan to retire at ${Math.round(retirementAge)}, your ${bridgeGap!.assetName} won't kick in until age ${Math.round(bridgeGap!.toAge)}, so you may have a ${gapYears}-year gap to bridge.`);
  }

  if (hasLongevityGap) {
    const depletionAge = Math.round(interpretation.depletionAge!);
    const gap = Math.round(endAge - interpretation.depletionAge!);
    const opener = hasBridgeGap ? 'And even after that,' : 'At your current pace,';
    sentences.push(`${opener} your total savings may only last to around age ${depletionAge} — ${gap} years short of your plan end at ${Math.round(endAge)}.`);
  }

  return `Be careful...! ${sentences.join(' ')}`;
}

// ─── KPI Circle ──────────────────────────────────────────────────────────────

const CIRCLE_SIZE = 96;

interface KpiCircleProps {
  definition: KpiDefinition;
  kpiData: KpiData;
}

function KpiCircle({ definition, kpiData }: KpiCircleProps) {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const value = definition.compute(kpiData);

  return (
    <SketchCircle
      size={CIRCLE_SIZE}
      borderColor={palette.accent}
      fillColor={theme.colors.bg.card}
    >
      <View style={styles.circleInner}>
        <Text
          style={[styles.circleValue, { color: palette.accent }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value ?? '—'}
        </Text>
        <Text style={[styles.circleLabel, { color: theme.colors.text.secondary }]} numberOfLines={2}>
          {definition.label}
        </Text>
      </View>
    </SketchCircle>
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
  onSolveProblem: _onSolveProblem,
  style,
}: InterpretationCardProps) {
  const { theme } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);

  const warningParagraph = buildWarningParagraph(kpiData);

  const selectedDefinitions = selectedKpiIds
    .map(id => ALL_KPI_DEFINITIONS.find(d => d.id === id))
    .filter((d): d is KpiDefinition => d != null);

  const headlineText = kpiData.interpretation.headline;

  return (
    <>
      <SectionCard fillColor="transparent" style={[styles.card, style]}>
        <SectionHeader title="Your Projection" />

        {/* KPI circles */}
        <View style={{ position: 'relative' }}>
          <View style={styles.circlesRow}>
            {selectedDefinitions.map(def => (
              <KpiCircle key={def.id} definition={def} kpiData={kpiData} />
            ))}
          </View>
          {/* Pencil edit — absolutely positioned top-right */}
          <Pressable
            onPress={() => setPickerVisible(true)}
            style={styles.pencilOverlay}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Edit metrics"
          >
            <Pencil size={16} color={theme.colors.text.secondary} weight="regular" />
          </Pressable>
        </View>

        {/* Merged headline + subline */}
        <Text style={[styles.headline, { color: theme.colors.text.secondary }]}>
          {headlineText}
        </Text>

        {/* Warning paragraph */}
        {warningParagraph != null && (
          <Text style={[styles.warningParagraph, { color: theme.colors.semantic.errorText }]}>
            {warningParagraph}
          </Text>
        )}
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

  // Pencil edit button — absolutely positioned top-right of the circles row container
  pencilOverlay: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.xs,
  },

  // KPI circles row
  circlesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.base,
  },
  circleInner: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  circleValue: {
    ...typography.value,
    textAlign: 'center',
  },
  circleLabel: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.tiny,
  },

  // Merged headline
  headline: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  // Warning paragraph
  warningParagraph: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
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
