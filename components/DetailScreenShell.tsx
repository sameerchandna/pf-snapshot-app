import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from './ScreenHeader';
import { HelpContent } from '../screens/GroupedListDetailScreen';
import { useTheme } from '../ui/theme/useTheme';
import Icon from './Icon';

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
            <Pressable
              onPress={() => setIsHintOpen(true)}
              style={({ pressed }) => [
                styles.hintButton,
                { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Help"
            >
              <Icon name="help-circle" size="medium" color={theme.colors.text.tertiary} />
            </Pressable>
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
    padding: 16,
    paddingTop: 12,
  },
  hintButton: {
    padding: 6,
  },
  hintBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hintSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  hintScroll: {
    marginTop: 12,
  },
  hintScrollContent: {
    paddingBottom: 24,
  },
  helpSectionDivider: {
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
  },
  helpSectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpParagraph: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  helpBulletsContainer: {
    marginTop: 4,
    marginBottom: 10,
  },
  helpBullet: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  helpExample: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  helpExampleBold: {
    fontWeight: '600',
  },
});


