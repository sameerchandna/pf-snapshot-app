import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { spacing } from '../ui/spacing';
import { typography } from '../ui/theme/theme';
import { useScreenPalette } from '../ui/theme/palettes';
import Divider from './Divider';

type Props = {
  title: string;
  totalText?: string;
  subtitle?: string;
  subtitleFootnote?: string;
  rightAccessory?: React.ReactNode;
};

export default function ScreenHeader({ title, rightAccessory }: Props) {
  const palette = useScreenPalette();
  return (
    <View>
      <View style={[styles.header, styles.safeHeader]}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        {rightAccessory ? (
          <View style={styles.rightAccessory}>{rightAccessory}</View>
        ) : (
          <View style={styles.aiBadge}>
            <Svg width={45} height={42}>
              <Circle cx={22.5} cy={21} r={19} fill="#ffffff" stroke={palette.accent} strokeWidth={1.5} />
              <SvgText
                x={22.5}
                y={25}
                textAnchor="middle"
                fill={palette.accent}
                fontSize={14}
                fontFamily="Virgil"
              >
                AI
              </SvgText>
            </Svg>
          </View>
        )}
      </View>
      <Divider color={palette.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  safeHeader: {
    marginTop: Platform.OS === 'ios' ? 10 : 0,
  },
  title: {
    ...typography.medium,
    flex: 1,
  },
  rightAccessory: {
    marginLeft: spacing.sm,
  },
  aiBadge: {
    marginLeft: spacing.sm,
  },
});
