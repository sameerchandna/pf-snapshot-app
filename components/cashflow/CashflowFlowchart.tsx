import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SketchCard from '../SketchCard';
import SketchLine from '../SketchLine';
import SketchBranch from '../SketchBranch';
import SketchHighlight from '../SketchHighlight';
import SketchCurvedArrow from '../SketchCurvedArrow';
import Icon from '../Icon';
import { useTheme } from '../../ui/theme/useTheme';
import { useScreenPalette } from '../../ui/theme/palettes';
import { spacing } from '../../ui/spacing';

type NodeGap = 'tiny' | 'small' | 'medium' | 'large';

const NODE_GAP_VALUES: Record<NodeGap, number> = {
  tiny: spacing.tiny,
  small: spacing.sm,
  medium: spacing.base,
  large: spacing.xl,
};

interface CashflowFlowchartProps {
  grossIncome: string;
  deductions: string;
  pension: string;
  netIncome: string;
  expenses: string;
  availableCash: string;
  liabilityReduction: string;
  assetContribution: string;
  remainingCash: string;
  nodeGap?: NodeGap;
  onPressGrossIncome?: () => void;
  onPressPension?: () => void;
  onPressNetIncome?: () => void;
  onPressExpenses?: () => void;
  onPressAssetContribution?: () => void;
  onPressLiabilityReduction?: () => void;
}

const SIDE_GAP = spacing.xl;

// --- Flow node ---

function FlowNode({
  title,
  value,
  borderColor,
  fillColor,
  valueColor,
  highlight = false,
  onPress,
  width,
}: {
  title: string;
  value: string;
  borderColor: string;
  fillColor: string;
  valueColor?: string;
  highlight?: boolean;
  onPress?: () => void;
  width?: `${number}%`;
}) {
  const { theme } = useTheme();
  const palette = useScreenPalette();
  const inner = (
    <SketchCard borderColor={borderColor} fillColor={fillColor} style={styles.node}>
      {highlight ? (
        <SketchHighlight color={`${palette.sectionHeaderBg}30`}>
          <Text style={[styles.nodeValue, theme.typography.medium, { color: valueColor || theme.colors.text.primary }]}>
            {value}
          </Text>
        </SketchHighlight>
      ) : (
        <Text style={[styles.nodeValue, theme.typography.medium, { color: valueColor || theme.colors.text.primary }]}>
          {value}
        </Text>
      )}
      <Text style={[styles.nodeTitle, theme.typography.small, { color: theme.colors.text.secondary }]}>
        {title}
      </Text>
      {onPress && (
        <View style={styles.nodeChevron}>
          <Icon name="chevron-forward-outline" size="small" color={theme.colors.text.muted} />
        </View>
      )}
    </SketchCard>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [width ? { width } : { alignSelf: 'stretch' as const }, pressed && { opacity: 0.7 }]}>
        {inner}
      </Pressable>
    );
  }
  return <View style={width ? { width } : { alignSelf: 'stretch' }}>{inner}</View>;
}

// --- Main flowchart ---

// Half-width of SketchLine's SVG canvas (CROSS = 16)
const LINE_HALF = 8;
const LINE_GAP = spacing.xs;

export default function CashflowFlowchart(props: CashflowFlowchartProps) {
  const { theme } = useTheme();
  const { nodeGap = 'small' } = props;
  const gap = NODE_GAP_VALUES[nodeGap];

  const [grossIncomeRowTop, setGrossIncomeRowTop] = useState(0);
  const [grossIncomeRowBottom, setGrossIncomeRowBottom] = useState(0);
  const [netIncomeRowTop, setNetIncomeRowTop] = useState(0);
  const [deductionsRowTop, setDeductionsRowTop] = useState(0);
  const [expensesRowBottom, setExpensesRowBottom] = useState(0);
  const [availableCashRowTop, setAvailableCashRowTop] = useState(0);
  const [availableCashRowBottom, setAvailableCashRowBottom] = useState(0);
  const [remainingCashRowTop, setRemainingCashRowTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [deductionsRowCenterY, setDeductionsRowCenterY] = useState(0);
  const [liabilitiesRowTop, setLiabilitiesRowTop] = useState(0);
  const [liabilitiesRowCenterY, setLiabilitiesRowCenterY] = useState(0);

  const cardFill = theme.colors.bg.card;
  const redBorder = theme.colors.semantic.error;
  const greenBorder = theme.colors.semantic.success;
  const blueBorder = theme.colors.brand.primary;
  const blackBorder = theme.colors.text.primary;

  // Curved arrows: Gross Income → Deductions (LHS) and Gross Income → Pension (RHS)
  const FLOAT = 8;
  const arrowHeight = deductionsRowTop - grossIncomeRowTop;
  const grossIncomeNodeLeftX = (containerWidth - containerWidth * 0.50) / 2;
  const grossIncomeNodeRightX = (containerWidth + containerWidth * 0.50) / 2;
  const arrowFromY = (grossIncomeRowBottom - grossIncomeRowTop) / 2;
  const arrowToY = arrowHeight - FLOAT;

  // LHS: left of Gross Income → top of Deductions
  const arrowFromX = grossIncomeNodeLeftX - FLOAT;
  const arrowToX = containerWidth * 0.1275; // 30% from left of Deductions (42.5% * 0.30)

  // RHS: right of Gross Income → top of Pension (SVG coords relative to containerWidth * 0.5)
  const arrowRhsSvgLeft = containerWidth * 0.5;
  const arrowRhsFromX = grossIncomeNodeRightX + FLOAT - arrowRhsSvgLeft;
  const arrowRhsToX = containerWidth * 0.8725 - arrowRhsSvgLeft; // 30% from right of Pension (1 - 42.5% * 0.30)

  // Available Cash → Reduce Liabilities (LHS) and Increase Assets (RHS) — same column layout
  const arrow2Height = liabilitiesRowTop - availableCashRowTop;
  const arrow2FromY = (availableCashRowBottom - availableCashRowTop) / 2;
  const arrow2ToY = arrow2Height - FLOAT;
  // x coords reuse same column geometry as Gross Income arrows

  const line2Top = expensesRowBottom + LINE_GAP;
  const line2Length = availableCashRowTop - line2Top - LINE_GAP;


  return (
    <View style={styles.container} onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>

      <View
        style={[styles.row, { marginBottom: spacing.xl }]}
        onLayout={e => {
          setGrossIncomeRowTop(e.nativeEvent.layout.y);
          setGrossIncomeRowBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
        }}
      >
        <FlowNode
          title="Gross Income"
          value={props.grossIncome}
          borderColor={blackBorder}
          fillColor={cardFill}
          onPress={props.onPressGrossIncome}
          width="50%"
        />
      </View>

      {/* Curved arrow: left of Gross Income → top of Deductions */}
      {grossIncomeRowBottom > 0 && deductionsRowTop > 0 && arrowHeight > 0 && containerWidth > 0 && (
        <View style={{ position: 'absolute', left: 0, top: grossIncomeRowTop, zIndex: 2 }} pointerEvents="none">
          <SketchCurvedArrow
            width={containerWidth * 0.5}
            height={arrowHeight}
            from={[arrowFromX, arrowFromY]}
            to={[arrowToX, arrowToY]}
            curvature={0.25}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            arrowSize={7}
          />
        </View>
      )}

      {/* Curved arrow: right of Gross Income → top of Pension */}
      {grossIncomeRowBottom > 0 && deductionsRowTop > 0 && arrowHeight > 0 && containerWidth > 0 && (
        <View style={{ position: 'absolute', left: arrowRhsSvgLeft, top: grossIncomeRowTop, zIndex: 2 }} pointerEvents="none">
          <SketchCurvedArrow
            width={containerWidth * 0.5}
            height={arrowHeight}
            from={[arrowRhsFromX, arrowFromY]}
            to={[arrowRhsToX, arrowToY]}
            curvature={-0.25}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            arrowSize={7}
          />
        </View>
      )}


      {/* Line: Gross Income → Net Income */}
      {grossIncomeRowBottom > 0 && netIncomeRowTop > 0 && (
        <View style={[styles.centerLine, { top: grossIncomeRowBottom + FLOAT, marginLeft: -LINE_HALF }]}>
          <SketchLine
            length={netIncomeRowTop - grossIncomeRowBottom - 2 * FLOAT}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            orientation="vertical"
          />
        </View>
      )}

      <View
        style={[styles.row, styles.threeColRow, { marginBottom: spacing.huge }]}
        onLayout={e => {
          setDeductionsRowTop(e.nativeEvent.layout.y);
          setDeductionsRowCenterY(e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2);
        }}
      >
        <View style={styles.threeColSide}>
          <FlowNode
            title="Deductions"
            value={props.deductions}
            borderColor={redBorder}
            fillColor={cardFill}
          />
        </View>
        <View style={styles.threeColMiddle} />
        <View style={styles.threeColSide}>
          <FlowNode
            title="Pension"
            value={props.pension}
            borderColor={greenBorder}
            fillColor={cardFill}
            onPress={props.onPressPension}
          />
        </View>
      </View>

      <View
        style={[styles.row, { marginBottom: gap }]}
        onLayout={e => setNetIncomeRowTop(e.nativeEvent.layout.y)}
      >
        <FlowNode
          title="Net Income"
          value={props.netIncome}
          borderColor={blackBorder}
          fillColor={cardFill}
          onPress={props.onPressNetIncome}
          width="50%"
        />
      </View>

      <View
        style={[styles.row, { marginBottom: spacing.huge }]}
        onLayout={e => setExpensesRowBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <FlowNode
          title="Expenses"
          value={props.expenses}
          borderColor={redBorder}
          fillColor={cardFill}
          onPress={props.onPressExpenses}
          width="42%"
        />
      </View>

      {expensesRowBottom > 0 && availableCashRowTop > 0 && (
        <View style={[styles.centerLine, { top: line2Top, marginLeft: -LINE_HALF }]}>
          <SketchLine
            length={line2Length}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            orientation="vertical"
          />
        </View>
      )}

      <View
        style={[styles.row, { marginBottom: spacing.xl }]}
        onLayout={e => {
          setAvailableCashRowTop(e.nativeEvent.layout.y);
          setAvailableCashRowBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
        }}
      >
        <FlowNode
          title="Available Cash"
          value={props.availableCash}
          borderColor={blueBorder}
          fillColor={cardFill}
          width="50%"
        />
      </View>

      {/* Curved arrow: left of Available Cash → top of Reduce Liabilities */}
      {availableCashRowBottom > 0 && liabilitiesRowTop > 0 && arrow2Height > 0 && containerWidth > 0 && (
        <View style={{ position: 'absolute', left: 0, top: availableCashRowTop, zIndex: 2 }}>
          <SketchCurvedArrow
            width={containerWidth * 0.5}
            height={arrow2Height}
            from={[arrowFromX, arrow2FromY]}
            to={[arrowToX, arrow2ToY]}
            curvature={0.25}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            arrowSize={7}
          />
        </View>
      )}

      {/* Curved arrow: right of Available Cash → top of Increase Assets */}
      {availableCashRowBottom > 0 && liabilitiesRowTop > 0 && arrow2Height > 0 && containerWidth > 0 && (
        <View style={{ position: 'absolute', left: arrowRhsSvgLeft, top: availableCashRowTop, zIndex: 2 }}>
          <SketchCurvedArrow
            width={containerWidth * 0.5}
            height={arrow2Height}
            from={[arrowRhsFromX, arrow2FromY]}
            to={[arrowRhsToX, arrow2ToY]}
            curvature={-0.25}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            arrowSize={7}
          />
        </View>
      )}


      <View
        style={[styles.row, styles.threeColRow, { marginBottom: spacing.huge }]}
        onLayout={e => {
          setLiabilitiesRowTop(e.nativeEvent.layout.y);
          setLiabilitiesRowCenterY(e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2);
        }}
      >
        <View style={styles.threeColSide}>
          <FlowNode
            title="Reduce Liabilities"
            value={props.liabilityReduction}
            borderColor={greenBorder}
            fillColor={cardFill}
            onPress={props.onPressLiabilityReduction}
          />
        </View>
        <View style={styles.threeColMiddle} />
        <View style={styles.threeColSide}>
          <FlowNode
            title="Increase Assets"
            value={props.assetContribution}
            borderColor={greenBorder}
            fillColor={cardFill}
            onPress={props.onPressAssetContribution}
          />
        </View>
      </View>

      {/* Arrow: Available Cash → Remaining Cash */}
      {availableCashRowBottom > 0 && remainingCashRowTop > 0 && (
        <View style={[styles.centerLine, { top: availableCashRowBottom + FLOAT, marginLeft: -10 }]}>
          <SketchCurvedArrow
            width={20}
            height={remainingCashRowTop - availableCashRowBottom - 2 * FLOAT}
            curvature={0}
            color={theme.colors.text.muted}
            strokeWidth={1.5}
            arrowSize={7}
          />
        </View>
      )}

      <View
        style={styles.row}
        onLayout={e => setRemainingCashRowTop(e.nativeEvent.layout.y)}
      >
        <FlowNode
          title="Remaining Cash in Hand"
          value={props.remainingCash}
          borderColor={blueBorder}
          fillColor={cardFill}
          valueColor={blueBorder}
          highlight
          width="75%"
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    width: '90%',
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingBottom: spacing.base,
  },
  row: {
    alignItems: 'center',
  },
  centerLine: {
    position: 'absolute',
    left: '50%',
    zIndex: 1,
  },
  sideRow: {
    flexDirection: 'row',
    gap: SIDE_GAP,
    justifyContent: 'center',
  },
  sideCell: {
    width: '34%',
  },
  threeColRow: {
    flexDirection: 'row',
    width: '100%',
  },
  threeColSide: {
    width: '42.5%',
  },
  threeColMiddle: {
    width: '15%',
  },
  node: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  nodeTitle: {
    textAlign: 'center',
  },
  nodeValue: {
    textAlign: 'center',
    marginTop: spacing.tiny,
  },
  nodeChevron: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
