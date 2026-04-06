import React, { useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../ui/theme/useTheme';
import SketchLine from './SketchLine';

type DividerVariant = 'default' | 'subtle' | 'thick';

type Props = {
  variant?: DividerVariant;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Divider({ variant = 'default', color: colorProp, style }: Props) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);

  const color = colorProp ?? (
    variant === 'subtle'
      ? theme.colors.border.subtle
      : theme.colors.border.default
  );

  const strokeWidth =
    variant === 'thick' ? 2 : variant === 'subtle' ? 0.75 : 1.5;

  return (
    <View
      style={[{ alignSelf: 'stretch', alignItems: 'center' }, style]}
      onLayout={e => setWidth(e.nativeEvent.layout.width * 0.9)}
    >
      {width > 0 ? (
        <SketchLine
          length={width}
          orientation="horizontal"
          color={color}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </View>
  );
}
