import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import { useSnapshot } from '../context/SnapshotContext';
import { initLoan, stepLoanMonth } from '../engines/loanEngine';
import type { LiabilityItem } from '../types';
import { parseItemName } from '../domain/domainValidation';
import { formatCurrencyFull, formatPercent } from '../ui/formatters';
import { deriveLoanStateAsOfToday } from '../engines/loanDerivation';
import { useTheme } from '../ui/theme/useTheme';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';

type RouteParams = {
  template: 'mortgage' | 'loan';
  groupId: string;
  liabilityId?: string;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function parseDdMmmYyyy(input: string): Date | null {
  // Strict format: DD-MMM-YYYY (e.g. 05-Jan-2018)
  const s = input.trim();
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (!m) return null;

  const day = Number(m[1]);
  const mon = m[2].toLowerCase();
  const year = Number(m[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return null;
  if (year < 1900 || year > 2200) return null;

  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const month = monthMap[mon];
  if (typeof month !== 'number') return null;
  if (day < 1 || day > 31) return null;

  // Construct local date at midnight and validate it round-trips.
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

export default function LoanDetailScreen() {
  const { theme } = useTheme();
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg.card,
    },
    content: {
      flex: 1,
      padding: spacing.xl,
      paddingTop: spacing.base,
    },
    doneButton: {
      paddingHorizontal: layout.inputPadding,
      paddingVertical: spacing.xs,
      borderRadius: theme.radius.base,
      backgroundColor: theme.colors.bg.app,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    doneButtonText: {
      ...theme.typography.bodyMedium,
      fontWeight: '600' as const,
      color: theme.colors.text.tertiary,
    },
    errorCard: {
      backgroundColor: theme.colors.semantic.errorBg,
      borderWidth: 1,
      borderColor: theme.colors.semantic.errorBorder,
      borderRadius: theme.radius.medium,
      padding: layout.inputPadding,
      marginBottom: spacing.base,
    },
    errorTitle: {
      ...theme.typography.body,
      fontWeight: '700' as const,
      color: theme.colors.semantic.errorText,
      marginBottom: spacing.tiny,
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.semantic.errorText,
    },
    card: {
      backgroundColor: theme.colors.bg.cardGradientBottom,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.card,
      padding: spacing.base,
      marginBottom: spacing.base,
    },
    label: {
      ...theme.typography.body,
      fontWeight: '600' as const,
      color: theme.colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    fieldSpacing: {
      marginTop: layout.inputPadding,
    },
    input: {
      backgroundColor: theme.colors.bg.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.medium,
      paddingVertical: layout.inputPadding,
      paddingHorizontal: spacing.base,
      ...theme.typography.input,
      color: theme.colors.text.primary,
    },
    actionsRow: {
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
      marginTop: spacing.base,
    },
    actionButton: {
      backgroundColor: theme.colors.border.subtle,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.medium,
      paddingVertical: layout.inputPadding,
      paddingHorizontal: layout.lg,
    },
    actionButtonText: {
      ...theme.typography.button,
      fontWeight: '600' as const,
      color: theme.colors.text.tertiary,
    },
    readRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginBottom: spacing.xs,
    },
    readLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.text.secondary,
    },
    readValue: {
      ...theme.typography.bodyMedium,
      fontWeight: '600' as const,
      color: theme.colors.text.primary,
    },
    footnote: {
      ...theme.typography.body,
      marginTop: layout.inputPadding,
      color: theme.colors.text.subtle,
    },
    helperText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginBottom: spacing.sm,
    },
    infoBlock: {
      marginTop: spacing.base,
      backgroundColor: theme.colors.bg.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: theme.radius.medium,
      padding: layout.inputPadding,
    },
    infoTitle: {
      ...theme.typography.body,
      fontWeight: '700' as const,
      color: theme.colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    infoText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
  });

  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { template, groupId, liabilityId } = (route.params ?? {}) as RouteParams;

  const title = template === 'mortgage' ? 'Mortgage' : 'Loan';

  const { state, setExpenses, setLiabilities, setLiabilityReductions } = useSnapshot();

  const [draftName, setDraftName] = useState<string>(title);
  const [draftBalance, setDraftBalance] = useState<string>('');
  const [draftRatePct, setDraftRatePct] = useState<string>('');
  const [draftTermYears, setDraftTermYears] = useState<string>('');
  const [draftStartDate, setDraftStartDate] = useState<string>(''); // DD-MMM-YYYY
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [savedLoanId, setSavedLoanId] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  // Editing existing loan: prefill drafts from the liability item.
  useEffect(() => {
    if (!liabilityId) return;
    const existing = state.liabilities.find(l => l.id === liabilityId);
    if (!existing) return;
    if (existing.kind !== 'loan') return;
    // Only initialise once per screen open.
    if (savedLoanId === liabilityId) return;

    setDraftName(existing.name);
    setDraftBalance(existing.balance.toString());
    setDraftRatePct((existing.annualInterestRatePct ?? 0).toString());
    setDraftTermYears((existing.remainingTermYears ?? 0).toString());
    setSavedLoanId(liabilityId);
    setHasSaved(true); // already persisted; show derived section immediately
    setErrorMessage('');
  }, [liabilityId, savedLoanId, state.liabilities]);

  const parsed = useMemo(() => {
    const name = parseItemName(draftName) ?? title;
    const balance = Number(draftBalance);
    const ratePct = Number(draftRatePct);
    const termYears = Number(draftTermYears);

    return {
      name,
      balance: Number.isFinite(balance) ? balance : null,
      ratePct: Number.isFinite(ratePct) ? ratePct : null,
      termYears: Number.isFinite(termYears) ? termYears : null,
    };
  }, [draftBalance, draftName, draftRatePct, draftTermYears, title]);

  const derived = useMemo(() => {
    if (!hasSaved) return null;
    if (parsed.balance === null || parsed.ratePct === null || parsed.termYears === null) return null;
    if (parsed.balance < 0 || parsed.ratePct < 0 || parsed.termYears < 0) return null;

    const init = initLoan({
      balance: parsed.balance,
      annualInterestRatePct: parsed.ratePct,
      remainingTermYears: Math.floor(parsed.termYears),
    });
    const month1 = stepLoanMonth({ balance: parsed.balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });

    return {
      monthlyPayment: init.monthlyPayment,
      monthlyInterest: month1.interest,
      monthlyPrincipal: month1.principal,
    };
  }, [hasSaved, parsed.balance, parsed.ratePct, parsed.termYears]);

  const onChangeAny = (setter: (v: string) => void) => (v: string) => {
    setErrorMessage('');
    setHasSaved(false);
    setter(v);
  };

  const calculate = () => {
    Keyboard.dismiss();

    const balance = parsed.balance;
    const ratePct = parsed.ratePct;
    const termYearsRaw = parsed.termYears;

    if (balance === null || ratePct === null || termYearsRaw === null) {
      setErrorMessage('Please enter valid numbers for all fields.');
      return;
    }
    if (balance < 0) {
      setErrorMessage('Outstanding balance cannot be negative.');
      return;
    }
    if (ratePct < 0) {
      setErrorMessage('Interest rate cannot be negative.');
      return;
    }

    const termYears = Math.floor(termYearsRaw);
    if (termYears < 1) {
      setErrorMessage('Remaining term must be at least 1 year.');
      return;
    }

    const startDateText = draftStartDate.trim();
    const startDateParsed = startDateText.length > 0 ? parseDdMmmYyyy(startDateText) : null;
    if (startDateText.length > 0 && !startDateParsed) {
      setErrorMessage('Enter loan start date as DD-MMM-YYYY (e.g. 05-Jan-2018).');
      return;
    }

    // Optional A2.1 derivation: if a start date is provided, treat entered balance + term as original contract,
    // derive today's state once, then overwrite fields and forget history.
    if (startDateParsed) {
      const today = new Date();
      // Start date in the future -> ignore derivation (spec); proceed as "today state".
      if (startDateParsed.getTime() > today.getTime()) {
        // Continue to save below without derivation.
      } else {
      const derived = deriveLoanStateAsOfToday({
        originalBalance: balance,
        annualRatePct: ratePct,
        originalTermMonths: termYears * 12,
        startDate: startDateParsed,
        today,
      });

      // Replace editable fields with derived "today state"
      const roundedBalance = Math.round(derived.currentBalance);
      const remainingTermYears = Math.ceil(derived.remainingTermMonths / 12);

      setDraftBalance(roundedBalance.toString());
      setDraftTermYears(remainingTermYears.toString());
      setDraftStartDate(''); // forget history

      // After updating drafts, proceed with saving using derived values.
      const id = savedLoanId ?? createId('loan');
      const next: LiabilityItem = {
        id,
        name: parsed.name,
        balance: roundedBalance,
        groupId,
        kind: 'loan',
        loanTemplate: template,
        annualInterestRatePct: ratePct,
        remainingTermYears,
      };

      setLiabilities(
        state.liabilities.some(l => l.id === id)
          ? state.liabilities.map(l => (l.id === id ? next : l))
          : [...state.liabilities, next],
      );

      // Materialize derived flows into the editable flat lists (read-only derived rows).
      // These are pinned to the top so they are immediately visible.
      const init = initLoan({
        balance: next.balance,
        annualInterestRatePct: next.annualInterestRatePct ?? 0,
        remainingTermYears: next.remainingTermYears ?? 1,
      });
      const month = stepLoanMonth({ balance: next.balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
      const interestId = `loan-interest:${id}`;
      const principalId = `loan-principal:${id}`;
      // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
      // Both interest and scheduled principal belong in expenses (full scheduled payment).
      setExpenses([
        { id: interestId, name: `${next.name} - Interest (Derived)`, monthlyAmount: month.interest, groupId: 'general' },
        { id: principalId, name: `${next.name} - Principal (Derived)`, monthlyAmount: month.principal, groupId: 'general' },
        ...state.expenses.filter(e => e.id !== interestId && e.id !== principalId),
      ]);
      // Remove any legacy loan-principal items from liabilityReductions (scheduled principal is now in expenses)
      setLiabilityReductions(state.liabilityReductions.filter(r => r.id !== principalId));

      setSavedLoanId(id);
      setHasSaved(true);
      setErrorMessage('');
      return;
      }
    }

    const id = savedLoanId ?? createId('loan');
    const next: LiabilityItem = {
      id,
      name: parsed.name,
      balance,
      groupId,
      kind: 'loan',
      loanTemplate: template,
      annualInterestRatePct: ratePct,
      remainingTermYears: termYears,
    };

    setLiabilities(state.liabilities.some(l => l.id === id) ? state.liabilities.map(l => (l.id === id ? next : l)) : [...state.liabilities, next]);

    // Materialize derived flows into the editable flat lists (read-only derived rows).
    // These are pinned to the top so they are immediately visible.
    const init = initLoan({
      balance: next.balance,
      annualInterestRatePct: next.annualInterestRatePct ?? 0,
      remainingTermYears: next.remainingTermYears ?? 1,
    });
    const month = stepLoanMonth({ balance: next.balance, monthlyPayment: init.monthlyPayment, monthlyRate: init.monthlyRate });
    const interestId = `loan-interest:${id}`;
    const principalId = `loan-principal:${id}`;
    // Mortgage payments are treated as expenses; overpayments are discretionary liability reductions.
    // Both interest and scheduled principal belong in expenses (full scheduled payment).
    setExpenses([
      { id: interestId, name: `${next.name} - Interest (Derived)`, monthlyAmount: month.interest, groupId: 'general' },
      { id: principalId, name: `${next.name} - Principal (Derived)`, monthlyAmount: month.principal, groupId: 'general' },
      ...state.expenses.filter(e => e.id !== interestId && e.id !== principalId),
    ]);
    // Remove any legacy loan-principal items from liabilityReductions (scheduled principal is now in expenses)
    setLiabilityReductions(state.liabilityReductions.filter(r => r.id !== principalId));

    setSavedLoanId(id);
    setHasSaved(true);
    setErrorMessage('');
  };

  const canDone: boolean = hasSaved && errorMessage.length === 0;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title={title}
        subtitle="Enter the required loan details"
        rightAccessory={
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={!canDone}
            style={({ pressed }) => [
              styles.doneButton,
              { opacity: !canDone ? 0.35 : undefined, backgroundColor: !canDone ? undefined : (pressed ? theme.colors.bg.subtle : undefined) }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            <Text style={styles.doneButtonText}>Save</Text>
          </Pressable>
        }
      />

      <View style={styles.content}>
        {errorMessage.length > 0 ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Can’t save</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Name (optional)</Text>
          <TextInput
            style={styles.input}
            value={draftName}
            onChangeText={onChangeAny(setDraftName)}
            placeholder={title}
            autoCapitalize="sentences"
            autoCorrect={false}
          />

          <Text style={styles.label}>Outstanding balance (£)</Text>
          <TextInput
            style={styles.input}
            value={draftBalance}
            onChangeText={onChangeAny(setDraftBalance)}
            placeholder="e.g. 250000"
            keyboardType="numeric"
          />

          <Text style={[styles.label, styles.fieldSpacing]}>Interest rate (% per year)</Text>
          <TextInput
            style={styles.input}
            value={draftRatePct}
            onChangeText={onChangeAny(setDraftRatePct)}
            placeholder="e.g. 4.25"
            keyboardType="numeric"
          />

          <Text style={[styles.label, styles.fieldSpacing]}>Remaining term (years)</Text>
          <TextInput
            style={styles.input}
            value={draftTermYears}
            onChangeText={onChangeAny(setDraftTermYears)}
            placeholder="e.g. 25"
            keyboardType="numeric"
          />

          <Text style={[styles.label, styles.fieldSpacing]}>Loan start date (optional)</Text>
          <Text style={styles.helperText}>
            If provided, the app estimates your loan’s current balance based on the original contract.
          </Text>
          <TextInput
            style={styles.input}
            value={draftStartDate}
            onChangeText={onChangeAny(setDraftStartDate)}
            placeholder="e.g. 05-Jan-2018"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <View style={styles.actionsRow}>
            <Pressable onPress={calculate} style={({ pressed }) => [styles.actionButton, { backgroundColor: pressed ? theme.colors.bg.subtle : undefined }]}>
              <Text style={styles.actionButtonText}>Calculate</Text>
            </Pressable>
          </View>
        </View>

        {derived ? (
          <View style={styles.card}>
            <GroupHeader title="Derived (monthly)" />
            <View style={styles.readRow}>
              <Text style={styles.readLabel}>Monthly payment</Text>
              <Text style={styles.readValue}>{formatCurrencyFull(derived.monthlyPayment)}</Text>
            </View>
            <View style={styles.readRow}>
              <Text style={styles.readLabel}>Monthly interest</Text>
              <Text style={styles.readValue}>{formatCurrencyFull(derived.monthlyInterest)}</Text>
            </View>
            <View style={styles.readRow}>
              <Text style={styles.readLabel}>Monthly principal</Text>
              <Text style={styles.readValue}>{formatCurrencyFull(derived.monthlyPrincipal)}</Text>
            </View>

            <Text style={styles.footnote}>
              Based on {formatCurrencyFull(Number(parsed.balance ?? 0))} at {formatPercent(Number(parsed.ratePct ?? 0), { decimals: 2 })} over{' '}
              {Math.floor(Number(parsed.termYears ?? 0))} years.
            </Text>

            <View style={styles.infoBlock}>
              <Text style={styles.infoTitle}>How this is calculated</Text>
              <Text style={styles.infoText}>
                If a loan start date is provided, the app estimates your current balance by applying the original loan terms from the start date up to today. Past payments are not shown. Projections always start from today.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}



