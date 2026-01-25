import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import ScreenHeader from './ScreenHeader';
import { HelpContent } from '../screens/GroupedListDetailScreen';

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
  const [isHintOpen, setIsHintOpen] = useState(false);
  const hasHints = Boolean(helpContent);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title={title}
        totalText={totalText}
        subtitle={subtextMain}
        subtitleFootnote={subtextFootnote}
        rightAccessory={
          hasHints ? (
            <Pressable
              onPress={() => setIsHintOpen(true)}
              style={({ pressed }) => [styles.hintButton, { opacity: pressed ? 0.8 : 0.55 }]}
              accessibilityRole="button"
              accessibilityLabel="Help"
            >
              <Feather name="help-circle" size={18} color="#333" />
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
            <Pressable style={styles.hintBackdrop} onPress={() => setIsHintOpen(false)} />
            <View style={styles.hintSheet}>
              {helpContent ? (
                <>
                  <Text style={styles.hintTitle}>{helpContent.title}</Text>
                  <ScrollView style={styles.hintScroll} contentContainerStyle={styles.hintScrollContent} showsVerticalScrollIndicator={false}>
                    {helpContent.sections.map((section, sectionIdx) => (
                      <View key={sectionIdx} style={sectionIdx > 0 ? styles.helpSectionDivider : null}>
                        {section.heading ? (
                          <Text style={styles.helpSectionHeading}>{section.heading}</Text>
                        ) : null}
                        {section.paragraphs?.map((para, paraIdx) => (
                          <Text key={paraIdx} style={styles.helpParagraph}>{para}</Text>
                        ))}
                        {section.example ? (
                          <Text style={styles.helpExample}>
                            {section.example.text}
                            <Text style={styles.helpExampleBold}>{section.example.boldValue}</Text>
                          </Text>
                        ) : null}
                        {section.bullets ? (
                          <View style={styles.helpBulletsContainer}>
                            {section.bullets.map((bullet, bulletIdx) => (
                              <Text key={bulletIdx} style={styles.helpBullet}>
                                • {bullet}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        {section.paragraphsAfter?.map((para, paraIdx) => (
                          <Text key={`after-${paraIdx}`} style={styles.helpParagraph}>{para}</Text>
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
    backgroundColor: '#fff',
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  hintSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
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
    borderTopColor: '#e0e0e0',
    marginTop: 16,
    paddingTop: 16,
  },
  helpSectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  helpParagraph: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    marginBottom: 10,
  },
  helpBulletsContainer: {
    marginTop: 4,
    marginBottom: 10,
  },
  helpBullet: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    marginBottom: 6,
  },
  helpExample: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  helpExampleBold: {
    fontWeight: '600',
    color: '#000',
  },
});


