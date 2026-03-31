import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from './ScreenHeader';
import { HelpContent } from '../screens/EditableCollectionScreen';
import { useTheme } from '../ui/theme/useTheme';
import Icon from './Icon';
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
  totalText,
  subtextMain,
  subtextFootnote,
  helpContent,
  children,
}: Props) {
  const { theme } = useTheme();
  const [isHintOpen, setIsHintOpen] = useState(false);
  const hasHints = Boolean(helpContent);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.card }]}>
      <ScreenHeader
        title={title}
        totalText={totalText}
        subtitle={subtextMain}
        subtitleFootnote={subtextFootnote}
        rightAccessory={
          hasHints ? (
            <IconButton
              icon="help-circle"
              size="md"
              variant="neutral"
              onPress={() => setIsHintOpen(true)}
              accessibilityLabel="Help"
            />
          ) : null
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
            <Pressable style={[styles.hintBackdrop, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setIsHintOpen(false)} />
            <View style={[styles.hintSheet, { backgroundColor: theme.colors.bg.card }]}>
              {helpContent ? (
                <>
                  <Text style={[styles.hintTitle, { color: theme.colors.text.primary }]}>{helpContent.title}</Text>
                  <ScrollView style={styles.hintScroll} contentContainerStyle={styles.hintScrollContent} showsVerticalScrollIndicator={false}>
                    {helpContent.sections.map((section, sectionIdx) => (
                      <View key={sectionIdx} style={sectionIdx > 0 ? [styles.helpSectionDivider, { borderTopColor: theme.colors.border.default }] : null}>
                        {section.heading ? (
                          <Text style={[styles.helpSectionHeading, { color: theme.colors.text.primary }]}>{section.heading}</Text>
                        ) : null}
                        {section.paragraphs?.map((para, paraIdx) => (
                          <Text key={paraIdx} style={[styles.helpParagraph, { color: theme.colors.text.tertiary }]}>{para}</Text>
                        ))}
                        {section.example ? (
                          <Text style={[styles.helpExample, { color: theme.colors.text.tertiary }]}>
                            {section.example.text}
                            <Text style={[styles.helpExampleBold, { color: theme.colors.text.primary }]}>{section.example.boldValue}</Text>
                          </Text>
                        ) : null}
                        {section.bullets ? (
                          <View style={styles.helpBulletsContainer}>
                            {section.bullets.map((bullet, bulletIdx) => (
                              <Text key={bulletIdx} style={[styles.helpBullet, { color: theme.colors.text.tertiary }]}>
                                • {bullet}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        {section.paragraphsAfter?.map((para, paraIdx) => (
                          <Text key={`after-${paraIdx}`} style={[styles.helpParagraph, { color: theme.colors.text.tertiary }]}>{para}</Text>
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
  hintButton: {
    padding: spacing.xs,
  },
  hintBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hintSheet: {
    borderTopLeftRadius: radius.rounded,
    borderTopRightRadius: radius.rounded,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  hintTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.xs,
  },
  hintScroll: {
    marginTop: spacing.base,
  },
  hintScrollContent: {
    paddingBottom: spacing.huge,
  },
  helpSectionDivider: {
    borderTopWidth: 1,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
  },
  helpSectionHeading: {
    ...typography.button,
    marginBottom: spacing.sm,
  },
  helpParagraph: {
    ...typography.bodyLarge,
    marginBottom: layout.inputPadding,
  },
  helpBulletsContainer: {
    marginTop: spacing.tiny,
    marginBottom: layout.inputPadding,
  },
  helpBullet: {
    ...typography.bodyLarge,
    marginBottom: spacing.xs,
  },
  helpExample: {
    ...typography.bodyLarge,
    marginTop: spacing.tiny,
    marginBottom: layout.inputPadding,
  },
  helpExampleBold: {
    fontWeight: '600',
  },
});


