import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from './ScreenHeader';
import SketchBackground from './SketchBackground';
import { HelpContent } from '../screens/EditableCollectionScreen';
import { useScreenPalette } from '../ui/theme/palettes';
import IconButton from './IconButton';
import Divider from './Divider';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { typography, radius } from '../ui/theme/theme';

type Props = {
  title: string;
  totalText: string;
  subtextMain?: string;
  subtextFootnote?: string;
  helpContent?: HelpContent;
  children: React.ReactNode;
};

export default function DetailScreenShell({
  title,
  helpContent,
  children,
}: Props) {
  const palette = useScreenPalette();
  const [isHintOpen, setIsHintOpen] = useState(false);
  const hasHints = Boolean(helpContent);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.accent} style={styles.container}>
        <ScreenHeader
          title={title}
          rightAccessory={
            hasHints ? (
              <IconButton
                icon="help-circle-outline"
                size="md"
                variant="neutral"
                onPress={() => setIsHintOpen(true)}
                accessibilityLabel="Help"
              />
            ) : undefined
          }
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        {hasHints ? (
          <Modal
            transparent={true}
            visible={isHintOpen}
            animationType="slide"
            onRequestClose={() => setIsHintOpen(false)}
          >
            <>
              <Pressable style={styles.hintBackdrop} onPress={() => setIsHintOpen(false)} />
              <View style={[styles.hintSheet, { backgroundColor: palette.cardBg }]}>
                {helpContent ? (
                  <>
                    <Text style={[styles.hintTitle, { color: palette.text }]}>{helpContent.title}</Text>
                    <ScrollView style={styles.hintScroll} contentContainerStyle={styles.hintScrollContent} showsVerticalScrollIndicator={false}>
                      {helpContent.sections.map((section, sectionIdx) => (
                        <View key={sectionIdx} style={sectionIdx > 0 ? styles.helpSectionSpacing : null}>
                          {sectionIdx > 0 && <Divider variant="subtle" style={{ marginBottom: spacing.xl }} />}
                          {section.heading ? (
                            <Text style={[styles.helpSectionHeading, { color: palette.text }]}>{section.heading}</Text>
                          ) : null}
                          {section.paragraphs?.map((para, paraIdx) => (
                            <Text key={paraIdx} style={[styles.helpParagraph, { color: palette.text }]}>{para}</Text>
                          ))}
                          {section.example ? (
                            <Text style={[styles.helpExample, { color: palette.text }]}>
                              {section.example.text}
                              <Text style={styles.helpExampleBold}>{section.example.boldValue}</Text>
                            </Text>
                          ) : null}
                          {section.bullets ? (
                            <View style={styles.helpBulletsContainer}>
                              {section.bullets.map((bullet, bulletIdx) => (
                                <Text key={bulletIdx} style={[styles.helpBullet, { color: palette.text }]}>
                                  • {bullet}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                          {section.paragraphsAfter?.map((para, paraIdx) => (
                            <Text key={`after-${paraIdx}`} style={[styles.helpParagraph, { color: palette.text }]}>{para}</Text>
                          ))}
                        </View>
                      ))}
                    </ScrollView>
                  </>
                ) : null}
              </View>
            </>
          </Modal>
        ) : null}
      </SketchBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: spacing.base,
  },
  hintBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  hintSheet: {
    borderTopLeftRadius: radius.rounded,
    borderTopRightRadius: radius.rounded,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  hintTitle: {
    ...typography.medium,
    marginBottom: spacing.xs,
  },
  hintScroll: {
    marginTop: spacing.base,
  },
  hintScrollContent: {
    paddingBottom: spacing.huge,
  },
  helpSectionSpacing: {
    marginTop: spacing.xl,
  },
  helpSectionHeading: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  helpParagraph: {
    ...typography.small,
    marginBottom: layout.inputPadding,
  },
  helpBulletsContainer: {
    marginTop: spacing.tiny,
    marginBottom: layout.inputPadding,
  },
  helpBullet: {
    ...typography.small,
    marginBottom: spacing.xs,
  },
  helpExample: {
    ...typography.small,
    marginTop: spacing.tiny,
    marginBottom: layout.inputPadding,
  },
  helpExampleBold: {
    fontFamily: 'Virgil',
  },
});
