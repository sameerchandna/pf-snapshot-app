import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, View, Text, StyleSheet, TextInput, Pressable, ScrollView as RNScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Swipeable, ScrollView } from 'react-native-gesture-handler';
import { Group } from '../types';
import { parseItemName, parseMoney } from '../domainValidation';
import ScreenHeader from '../components/ScreenHeader';
import GroupHeader from '../components/GroupHeader';
import SectionCard from '../components/SectionCard';
import Divider from '../components/Divider';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import SwipeAction from '../components/SwipeAction';
import GroupedList, { Group as GroupedListGroup } from '../components/list/GroupedList';
import FinancialItemRow from '../components/rows/FinancialItemRow';
import { spacing } from '../spacing';
import { layout } from '../layout';
import { useTheme } from '../ui/theme/useTheme';

// Minimal, opinionated help content structure
export type HelpExample = {
  text: string; // Text before the bold value
  boldValue: string; // The value to make bold (e.g. "£200 per month")
};

export type HelpSection = {
  heading?: string;
  paragraphs?: string[]; // Paragraphs before bullets
  bullets?: string[];
  paragraphsAfter?: string[]; // Optional paragraphs after bullets
  example?: HelpExample;
};

export type HelpContent = {
  title: string;
  sections: HelpSection[];
};

type Props<TItem> = {
  // Header + subtext
  title: string;
  totalText: string;
  subtextMain: string;
  subtextFootnote?: string;
  headerRightAccessory?: React.ReactNode;
  educationLines?: string[];
  insightText?: string;
  hintExamples?: string[];
  helpContent?: HelpContent; // Structured help content (replaces hintExamples when provided)

  // Grouped data
  groups: Group[];
  setGroups: (groups: Group[]) => void;
  items: TItem[];
  setItems: (items: TItem[]) => void;

  // Item accessors
  getItemId: (item: TItem) => string;
  getItemName: (item: TItem) => string;
  getItemAmount: (item: TItem) => number;
  getItemGroupId: (item: TItem) => string;
  makeNewItem: (
    groupId: string,
    name: string,
    amount: number,
    extra?: { secondaryNumber?: number | null; liquidity?: { type: 'immediate' | 'locked' | 'illiquid'; unlockAge?: number } },
  ) => TItem;
  updateItem: (
    item: TItem,
    name: string,
    amount: number,
    extra?: { secondaryNumber?: number | null; liquidity?: { type: 'immediate' | 'locked' | 'illiquid'; unlockAge?: number } },
  ) => TItem;

  // Formatting
  formatAmountText: (amount: number) => string;
  formatGroupTotalText: (total: number) => string;

  // Starter behavior
  createNewGroup: () => Group;
  autoExpandSingleGroup?: boolean;
  // If null, suppress empty-state messaging entirely.
  emptyStateText?: string | null;
  allowGroups?: boolean;

  // Optional "fixed field" mode toggles (used by Projection v1)
  allowAddItems?: boolean; // default true
  allowDeleteItems?: boolean; // default true
  allowEditItemName?: boolean; // default true
  allowEditGroups?: boolean; // default true
  allowAddGroups?: boolean; // default true
  groupsCollapsible?: boolean; // default true
  isItemLocked?: (item: TItem) => boolean;
  // If provided, determines whether the item should use the inline editor (default: true).
  canInlineEditItem?: (item: TItem) => boolean;
  // Optional external edit handler (used for "smart" items that should open a dedicated screen).
  onExternalEditItem?: (item: TItem) => void;
  formatItemAmountText?: (item: TItem, amount: number) => string;
  // Optional display name override (for cases where internal name differs from display name, e.g., contributions use assetId internally but show asset name).
  getItemDisplayName?: (item: TItem) => string;
  // Optional right-side meta label per item row (e.g. growth rate).
  formatItemMetaText?: (item: TItem) => string | null;
  validateEditedItem?: (ctx: { itemId: string | null; name: string; amount: number }) => string | null;

  // Optional footer rendered after all groups (used by Projection chart v1)
  renderFooter?: React.ReactNode;

  // Optional intro content rendered above EducationBox (used by guidance/info cards)
  renderIntro?: React.ReactNode;

  // Editor UI placement (legacy: inline editor at bottom of list; new: top "active entry block")
  editorPlacement?: 'inline' | 'top';
  // Optional: hide the editor entirely (useful for guided flows that provide their own entry UI).
  showEditor?: boolean;

  // Optional secondary numeric field in the editor (e.g. Growth Rate % for assets).
  // Only applies to the top editor placement.
  secondaryNumberField?: {
    label: string;
    placeholder?: string;
    getItemValue?: (item: TItem) => number | null | undefined;
    min?: number;
    max?: number;
  };
  // Optional liquidity field for assets (availability settings).
  // Only applies to the top editor placement.
  liquidityField?: {
    getItemLiquidity?: (item: TItem) => { type: 'immediate' | 'locked' | 'illiquid'; unlockAge?: number } | null | undefined;
    currentAge?: number; // Required for validation when type is 'locked'
  };

  // Optional custom name field renderer (e.g., asset picker dropdown instead of text input).
  // When provided, replaces the standard name TextInput in the editor.
  renderCustomNameField?: (props: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    editingItemId: string | null;
  }) => React.ReactNode;

  // Optional upsert logic: when saving, if an item with the same "key" exists, update it instead of creating new.
  // Used for contributions where one contribution per asset is enforced.
  upsertKey?: (name: string) => string; // Extract key from name (e.g., assetId from asset name)
  findExistingByKey?: (key: string) => TItem | null; // Find existing item by key

  // Optional active/inactive toggle support
  getItemIsActive?: (item: TItem) => boolean; // Get isActive state (defaults to true if not provided)
  setItemIsActive?: (item: TItem, isActive: boolean) => TItem; // Update isActive state

  // Optional item press handler (for navigation to detail screens)
  onItemPress?: (item: TItem) => void;

  // Swipe reveal mode: 'replace' (default) or 'overlay' (row stays fixed, actions slide underneath)
  swipeRevealMode?: 'replace' | 'overlay';

  /**
   * Optional custom row renderer (for v2 row architecture migration).
   * 
   * V2 vs Legacy Boundary:
   * - ExpensesDetailScreen is the canonical v2 prototype using screen-local semantic rows
   * - All other EditableCollectionScreen-based screens use FinancialItemRow (legacy)
   * - This prop enables gradual migration by allowing screens to override row rendering
   * - When provided, bypasses FinancialItemRow and swipe coordination logic
   * - Uses simplified callback API (onEdit, onDelete, onToggleActive) instead of swipeable refs
   * 
   * See ExpensesDetailScreen for the v2 implementation pattern.
   */
  renderRow?: (
    item: TItem,
    index: number,
    groupId: string | undefined,
    callbacks: {
      onEdit: () => void;
      onDelete: () => void;
      onToggleActive?: () => void;
      swipeableRef?: (ref: Swipeable | null) => void;
      onSwipeableWillOpen?: () => void;
      onSwipeableOpen?: () => void;
      onSwipeableClose?: () => void;
    },
    state: {
      locked: boolean;
      isActive: boolean;
      isInactive: boolean;
      isCurrentlyEditing: boolean;
      dimRow: boolean;
      showTopDivider: boolean;
      name: string;
      amountText: string;
      metaText: string | null;
    },
  ) => React.ReactNode;

  // Optional callback when delete is canceled (for v2 row reset)
  onDeleteCanceled?: () => void;
};

/**
 * Screen-level orchestrator for editable collections of financial items.
 * Owns add/edit lifecycle and Snapshot mutation; delegates rendering to list/row components.
 */
export default function EditableCollectionScreen<TItem>({
  title,
  totalText,
  subtextMain,
  subtextFootnote,
  headerRightAccessory,
  educationLines,
  insightText,
  hintExamples,
  helpContent,
  groups,
  setGroups,
  items,
  setItems,
  getItemId,
  getItemName,
  getItemAmount,
  getItemGroupId,
  makeNewItem,
  updateItem,
  formatAmountText,
  formatGroupTotalText,
  createNewGroup,
  autoExpandSingleGroup,
  emptyStateText,
  allowGroups,
  allowAddItems,
  allowDeleteItems,
  allowEditItemName,
  allowEditGroups,
  allowAddGroups,
  groupsCollapsible,
  isItemLocked,
  canInlineEditItem,
  onExternalEditItem,
  formatItemAmountText,
  getItemDisplayName,
  formatItemMetaText,
  validateEditedItem,
  renderFooter,
  renderIntro,
  editorPlacement,
  secondaryNumberField,
  liquidityField,
  showEditor,
  renderCustomNameField,
  upsertKey,
  findExistingByKey,
  getItemIsActive,
  setItemIsActive,
  onItemPress,
  swipeRevealMode = 'replace',
  renderRow: renderRowOverride,
  onDeleteCanceled,
}: Props<TItem>) {
  const { theme } = useTheme();
  // Education cleanup (phase 1): detail/editor screens should focus purely on entry & inspection.
  // EducationBox is kept only on Snapshot / Accounts / Projection results.
  void educationLines;
  void insightText;
  const groupsEnabled: boolean = allowGroups !== false;
  const implicitGroupId: string = 'general';
  const implicitGroupName: string = 'General';

  const effectiveEditorPlacement: 'inline' | 'top' = editorPlacement ?? 'inline';
  const editorVisible: boolean = showEditor !== false;
  const scrollRef = useRef<any>(null);
  const [openSwipeableId, setOpenSwipeableId] = useState<string | null>(null);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [draftAmount, setDraftAmount] = useState<string>('');
  const [draftSecondaryNumber, setDraftSecondaryNumber] = useState<string>('');
  const [draftLiquidityType, setDraftLiquidityType] = useState<'immediate' | 'locked' | 'illiquid'>('immediate');
  const [draftUnlockAge, setDraftUnlockAge] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState<string>('');
  const [groupNameError, setGroupNameError] = useState<string>('');
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [isHintOpen, setIsHintOpen] = useState<boolean>(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const maxValue: number = 1_000_000_000;
  const autoFocus: boolean = false;
  const shouldDismissKeyboardOnAction: boolean = true;

  const canAddItems: boolean = allowAddItems !== false;
  const canDeleteItems: boolean = allowDeleteItems !== false;
  const canEditItemName: boolean = allowEditItemName !== false;
  const canEditGroups: boolean = allowEditGroups !== false;
  const canAddGroups: boolean = allowAddGroups !== false;
  const canCollapseGroups: boolean = groupsCollapsible !== false;
  const isLocked = (item: TItem): boolean => (typeof isItemLocked === 'function' ? isItemLocked(item) : false);
  const isInlineEditable = (item: TItem): boolean => (typeof canInlineEditItem === 'function' ? canInlineEditItem(item) : true);

  const cancelEditor = () => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    setErrorMessage('');
    setDraftName('');
    setDraftAmount('');
    setDraftSecondaryNumber('');
    setDraftLiquidityType('immediate');
    setDraftUnlockAge('');
    setEditingItemId(null);
  };

  const activeEditingMeta: { groupId: string; name: string } | null = useMemo(() => {
    if (!editingItemId) return null;
    const it = items.find(x => getItemId(x) === editingItemId);
    if (!it) return null;
    return {
      groupId: groupsEnabled ? getItemGroupId(it) : implicitGroupId,
      name: getItemName(it),
    };
  }, [editingItemId, items, getItemId, getItemGroupId, getItemName, groupsEnabled]);

  const hasHints: boolean = Boolean(helpContent) || (Array.isArray(hintExamples) && hintExamples.length > 0);
  const hintVisible: boolean = isHintOpen;
  const hasHeaderRightAccessory: boolean = Boolean(headerRightAccessory);
  const showHeaderRight: boolean = hasHints || hasHeaderRightAccessory;

  const effectiveGroups: Group[] = useMemo(() => {
    return groupsEnabled ? groups : [{ id: implicitGroupId, name: implicitGroupName }];
  }, [groupsEnabled, groups]);

  const isExpanded = (groupId: string): boolean => {
    if (!groupsEnabled) return true;
    return expandedGroupId === groupId;
  };

  const itemsByGroupId: Record<string, TItem[]> = useMemo(() => {
    const byGroup: Record<string, TItem[]> = {};
    for (const g of effectiveGroups) byGroup[g.id] = [];
    for (const it of items) {
      const gid = groupsEnabled ? getItemGroupId(it) : implicitGroupId;
      if (!byGroup[gid]) byGroup[gid] = [];
      byGroup[gid].push(it);
    }
    return byGroup;
  }, [effectiveGroups, items, getItemGroupId, groupsEnabled]);

  const collapseAll = () => {
    setErrorMessage('');
    setDraftName('');
    setDraftAmount('');
    setDraftSecondaryNumber('');
    setEditingItemId(null);
    setEditingGroupId(null);
    setGroupNameDraft('');
    setGroupNameError('');
    if (groupsEnabled) setExpandedGroupId(null);
  };

  const expandGroup = (groupId: string) => {
    setErrorMessage('');
    setDraftName('');
    setDraftAmount('');
    setDraftSecondaryNumber('');
    setEditingItemId(null);
    setEditingGroupId(null);
    setGroupNameDraft('');
    setGroupNameError('');
    if (groupsEnabled) setExpandedGroupId(groupId);
  };

  // Auto-expand when exactly one group exists (used by "flat" screens with one Generic group)
  useEffect(() => {
    if (!groupsEnabled) return;
    if (autoExpandSingleGroup === true && groups.length === 1 && expandedGroupId === null) {
      // Safe: no autofocus; just sets the expanded group.
      setExpandedGroupId(groups[0].id);
    }
  }, [autoExpandSingleGroup, groups, expandedGroupId, groupsEnabled]);

  useEffect(() => {
    const onShow = (e: any) => {
      const height = typeof e?.endCoordinates?.height === 'number' ? e.endCoordinates.height : 0;
      setKeyboardHeight(height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const toggleGroup = (groupId: string) => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    if (!groupsEnabled) return;
    if (!canCollapseGroups) return;
    if (isExpanded(groupId)) {
      collapseAll();
      return;
    }
    expandGroup(groupId);
  };

  const validateAndParse = ():
    | { ok: true; name: string; amount: number; secondaryNumber: number | null; liquidity: { type: 'immediate' | 'locked' | 'illiquid'; unlockAge?: number } | null }
    | { ok: false; message: string } => {
    const name = parseItemName(draftName);
    if (!name) return { ok: false, message: 'Name is required.' };

    const parsed = parseMoney(draftAmount);
    if (parsed === null) {
      return { ok: false, message: 'Please enter a valid number for the amount.' };
    }

    if (parsed > maxValue) {
      return { ok: false, message: `That value is too large. Max allowed is ${maxValue.toLocaleString('en-GB')}.` };
    }

    const secondaryTrimmed = draftSecondaryNumber.trim();
    let secondaryNumber: number | null = null;
    if (effectiveEditorPlacement === 'top' && secondaryNumberField && secondaryTrimmed.length > 0) {
      const n = Number(secondaryTrimmed);
      if (!Number.isFinite(n)) return { ok: false, message: `Please enter a valid number for ${secondaryNumberField.label}.` };
      if (typeof secondaryNumberField.min === 'number' && n < secondaryNumberField.min) {
        return { ok: false, message: `${secondaryNumberField.label} must be at least ${secondaryNumberField.min}.` };
      }
      if (typeof secondaryNumberField.max === 'number' && n > secondaryNumberField.max) {
        return { ok: false, message: `${secondaryNumberField.label} must be at most ${secondaryNumberField.max}.` };
      }
      secondaryNumber = n;
    }

    // Validate liquidity
    let liquidity: { type: 'immediate' | 'locked' | 'illiquid'; unlockAge?: number } | null = null;
    if (effectiveEditorPlacement === 'top' && liquidityField) {
      if (draftLiquidityType === 'locked') {
        const ageTrimmed = draftUnlockAge.trim();
        if (ageTrimmed.length === 0) {
          return { ok: false, message: 'Unlock age is required when "Locked" is selected.' };
        }
        const unlockAge = parseMoney(ageTrimmed);
        if (unlockAge === null) {
          return { ok: false, message: 'Please enter a valid number for unlock age.' };
        }
        if (typeof liquidityField.currentAge === 'number' && unlockAge <= liquidityField.currentAge) {
          return { ok: false, message: `Unlock age must be greater than current age (${liquidityField.currentAge}).` };
        }
        liquidity = { type: 'locked', unlockAge };
      } else {
        liquidity = { type: draftLiquidityType };
      }
    }

    return { ok: true, name, amount: parsed, secondaryNumber, liquidity };
  };

  const saveEditor = () => {
    const editingItem: TItem | undefined = editingItemId ? items.find(it => getItemId(it) === editingItemId) : undefined;
    const targetGroupId: string | null =
      groupsEnabled ? (editingItem ? getItemGroupId(editingItem) : expandedGroupId) : implicitGroupId;
    if (!targetGroupId) return;
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();

    const validated = validateAndParse();
    if (!validated.ok) {
      setErrorMessage(validated.message);
      return;
    }

    if (typeof validateEditedItem === 'function') {
      const message = validateEditedItem({ itemId: editingItemId, name: validated.name, amount: validated.amount });
      if (message) {
        setErrorMessage(message);
        return;
      }
    }

    setErrorMessage('');

    if (editingItemId) {
      const next = items.map(it =>
        getItemId(it) === editingItemId
          ? updateItem(it, validated.name, validated.amount, { secondaryNumber: validated.secondaryNumber, liquidity: validated.liquidity ?? undefined })
          : it,
      );
      setItems(next);
      setEditingItemId(null);
    } else {
      if (!canAddItems) return;
      
      // Check for upsert logic: if an item with the same key exists, update it instead
      if (upsertKey && findExistingByKey) {
        const key = upsertKey(validated.name);
        const existing = findExistingByKey(key);
        if (existing) {
          const updated = updateItem(existing, validated.name, validated.amount, { secondaryNumber: validated.secondaryNumber, liquidity: validated.liquidity ?? undefined });
          const next = items.map(it =>
            getItemId(it) === getItemId(existing) ? updated : it,
          );
          setItems(next);
          // Switch to edit mode for the updated item, which will refresh the editor with the item's values
          startEditItem(updated);
          return;
        }
      }
      
      const newItem = makeNewItem(targetGroupId, validated.name, validated.amount, { secondaryNumber: validated.secondaryNumber, liquidity: validated.liquidity ?? undefined });
      setItems([...items, newItem]);
    }

    setDraftName('');
    setDraftAmount('');
    setDraftSecondaryNumber('');
    setDraftLiquidityType('immediate');
    setDraftUnlockAge('');
  };

  const closeAllSwipeables = (exceptId?: string) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (ref && id !== exceptId) {
        ref.close();
      }
    });
  };

  // Swipeable coordination handlers (all coordination decisions made here)
  const handleSwipeableWillOpen = (itemId: string) => {
    // Close all other swipeables when one opens
    closeAllSwipeables(itemId);
    setOpenSwipeableId(itemId);
    if (Platform.OS === 'ios') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available, ignore
      }
    }
  };

  const handleSwipeableOpen = (itemId: string) => {
    setOpenSwipeableId(itemId);
  };

  const handleSwipeableClose = (itemId: string) => {
    // Only clear state if this was the open one
    if (openSwipeableId === itemId) {
      setOpenSwipeableId(null);
    }
  };

  const handleScrollBeginDrag = () => {
    // Close all swipeables when scrolling starts
    closeAllSwipeables();
    setOpenSwipeableId(null);
  };

  const handleTouchOutside = () => {
    // Close all swipeables when touching outside (handled by ScrollView responder)
    if (openSwipeableId !== null) {
      closeAllSwipeables();
      setOpenSwipeableId(null);
    }
  };

  const getSwipeableEnabled = (itemId: string, groupId: string | undefined) => {
    const isCurrentlyEditing = Boolean(editingItemId && editingItemId === itemId);
    const groupExpanded = groupsEnabled && groupId ? isExpanded(groupId) : true;
    return !isCurrentlyEditing && (openSwipeableId === null || openSwipeableId === itemId) && (groupsEnabled && groupId ? (groupExpanded || !canCollapseGroups) : true);
  };

  const startEditItem = (item: TItem) => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    closeAllSwipeables();
    const gid = groupsEnabled ? getItemGroupId(item) : implicitGroupId;
    if (groupsEnabled && !isExpanded(gid)) {
      expandGroup(gid);
    }
    setErrorMessage('');
    setDraftName(getItemName(item));
    setDraftAmount(getItemAmount(item).toString());
    if (effectiveEditorPlacement === 'top' && secondaryNumberField?.getItemValue) {
      const v = secondaryNumberField.getItemValue(item);
      setDraftSecondaryNumber(typeof v === 'number' && Number.isFinite(v) ? v.toString() : '');
    } else {
      setDraftSecondaryNumber('');
    }
    if (effectiveEditorPlacement === 'top' && liquidityField?.getItemLiquidity) {
      const liquidity = liquidityField.getItemLiquidity(item);
      if (liquidity) {
        setDraftLiquidityType(liquidity.type);
        setDraftUnlockAge(typeof liquidity.unlockAge === 'number' && Number.isFinite(liquidity.unlockAge) ? liquidity.unlockAge.toString() : '');
      } else {
        setDraftLiquidityType('immediate');
        setDraftUnlockAge('');
      }
    } else {
      setDraftLiquidityType('immediate');
      setDraftUnlockAge('');
    }
    setEditingItemId(getItemId(item));
    if (effectiveEditorPlacement === 'top') {
      // Ensure the active entry block is visible when editing.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const deleteItem = (itemId: string) => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    setPendingDeleteItemId(itemId);
  };

  const confirmDeleteItem = () => {
    if (!pendingDeleteItemId) return;
    const itemId = pendingDeleteItemId;
    setPendingDeleteItemId(null);
    setItems(items.filter(it => getItemId(it) !== itemId));
    if (editingItemId === itemId) {
      setErrorMessage('');
      setDraftName('');
      setDraftAmount('');
      setDraftSecondaryNumber('');
      setDraftLiquidityType('immediate');
      setDraftUnlockAge('');
      setEditingItemId(null);
    }
  };

  const cancelDeleteItem = () => {
    setPendingDeleteItemId(null);
    closeAllSwipeables();
    onDeleteCanceled?.();
  };

  const addGroup = () => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    if (!groupsEnabled) return;
    const newGroup = createNewGroup();
    setGroups([...groups, newGroup]);
    expandGroup(newGroup.id);
    setEditingGroupId(newGroup.id);
    setGroupNameDraft(newGroup.name);
    setGroupNameError('');
  };

  const startEditGroupName = (group: Group) => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    if (!groupsEnabled) return;
    if (!isExpanded(group.id)) {
      expandGroup(group.id);
    }
    setEditingGroupId(group.id);
    setGroupNameDraft(group.name);
    setGroupNameError('');
  };

  const cancelEditGroupName = () => {
    setEditingGroupId(null);
    setGroupNameDraft('');
    setGroupNameError('');
  };

  const saveGroupName = (groupId: string) => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    if (!groupsEnabled) return;
    const nextName = groupNameDraft.trim();
    if (nextName.length === 0) {
      setGroupNameError('Group name is required.');
      return;
    }
    setGroupNameError('');
    setGroups(groups.map(g => (g.id === groupId ? { ...g, name: nextName } : g)));
    setEditingGroupId(null);
    setGroupNameDraft('');
  };

  const deleteGroup = (groupId: string) => {
    if (shouldDismissKeyboardOnAction) Keyboard.dismiss();
    if (!groupsEnabled) return;
    const itemsInGroup = items.filter(it => getItemGroupId(it) === groupId);
    if (itemsInGroup.length > 0) return;
    setGroups(groups.filter(g => g.id !== groupId));
    if (expandedGroupId === groupId) collapseAll();
  };

  const renderSwipeActions = (item: TItem, itemId: string, locked: boolean, canDelete: boolean, canEdit: boolean, inlineEditable: boolean, canExternalEdit: boolean) => {
    const handleEdit = () => {
      closeAllSwipeables();
      if (canExternalEdit && !inlineEditable) {
        onExternalEditItem?.(item);
      } else {
        startEditItem(item);
      }
    };

    const handleDelete = () => {
      closeAllSwipeables();
      deleteItem(itemId);
    };

    const actions: React.ReactNode[] = [];

    // Edit action (shown for all items that can be edited, including locked items)
    if (canEdit) {
      actions.push(
        <SwipeAction
          key="edit"
          variant="edit"
          onPress={handleEdit}
          accessibilityLabel="Edit"
        />
      );
    }

    // Delete action (only if not locked and deletion is allowed)
    if (!locked && canDelete && canDeleteItems) {
      actions.push(
        <SwipeAction
          key="delete"
          variant="delete"
          onPress={handleDelete}
          accessibilityLabel="Delete"
        />
      );
    }

    if (actions.length === 0) {
      return null;
    }

    return (
      <View style={styles.swipeActionsContainer}>
        {actions}
      </View>
    );
  };

  // Render row using FinancialItemRow (or custom renderRow override if provided)
  const renderRow = (
    item: TItem,
    index: number,
    groupId: string | undefined,
    swipeableCallbacks: {
      swipeableRef: (ref: Swipeable | null) => void;
      onSwipeableWillOpen: () => void;
      onSwipeableOpen: () => void;
      onSwipeableClose: () => void;
      swipeableEnabled: boolean;
    },
  ) => {
    const id = getItemId(item);
    const name = typeof getItemDisplayName === 'function' ? getItemDisplayName(item) : getItemName(item);
    const amount = getItemAmount(item);
    const amountText =
      typeof formatItemAmountText === 'function' ? formatItemAmountText(item, amount) : formatAmountText(amount);
    const metaText = typeof formatItemMetaText === 'function' ? formatItemMetaText(item) : null;
    const locked = isLocked(item);
    const deleteDisabled = locked || !canDeleteItems || (groupsEnabled && canCollapseGroups && groupId && !isExpanded(groupId));
    const editDisabled = locked || (groupsEnabled && canCollapseGroups && groupId && !isExpanded(groupId));
    const inlineEditable = isInlineEditable(item);
    const canExternalEdit = typeof onExternalEditItem === 'function';

    const isEditingInThisGroup: boolean = Boolean(editingItemId && activeEditingMeta?.groupId === (groupId || implicitGroupId));
    const isCurrentlyEditing: boolean = Boolean(editingItemId && editingItemId === id);
    const dimRow: boolean = isEditingInThisGroup && !isCurrentlyEditing;

    const itemIsActive = typeof getItemIsActive === 'function' ? getItemIsActive(item) : true;
    const isInactive = itemIsActive === false;

    const handleToggleActive = () => {
      if (typeof setItemIsActive === 'function') {
        const updated = setItemIsActive(item, !itemIsActive);
        const updatedItems = items.map(i => getItemId(i) === id ? updated : i);
        setItems(updatedItems);
      }
    };

    const showTopDivider = index > 0;

    // Use custom renderRow override if provided (for v2 row architecture)
    if (renderRowOverride) {
      const handleEdit = () => {
        if (canExternalEdit && !inlineEditable) {
          onExternalEditItem?.(item);
        } else {
          startEditItem(item);
        }
      };

      const handleDelete = () => {
        deleteItem(id);
      };

      return renderRowOverride(
        item,
        index,
        groupId,
        {
          onEdit: handleEdit,
          onDelete: handleDelete,
          onToggleActive: typeof getItemIsActive === 'function' && typeof setItemIsActive === 'function' ? handleToggleActive : undefined,
          swipeableRef: swipeableCallbacks.swipeableRef,
          onSwipeableWillOpen: swipeableCallbacks.onSwipeableWillOpen,
          onSwipeableOpen: swipeableCallbacks.onSwipeableOpen,
          onSwipeableClose: swipeableCallbacks.onSwipeableClose,
        },
        {
          locked,
          isActive: itemIsActive,
          isInactive,
          isCurrentlyEditing,
          dimRow,
          showTopDivider,
          name,
          amountText,
          metaText,
        },
      );
    }

    // Default: use FinancialItemRow
    return (
      <FinancialItemRow
        key={id}
        item={item}
        itemId={id}
        name={name}
        amountText={amountText}
        metaText={metaText}
        locked={locked}
        isActive={itemIsActive}
        isCurrentlyEditing={isCurrentlyEditing}
        dimRow={dimRow}
        isInactive={isInactive}
        showTopDivider={showTopDivider}
        onPress={
          onItemPress && !isCurrentlyEditing
            ? () => {
                onItemPress(item);
              }
            : undefined
        }
        onToggleActive={typeof getItemIsActive === 'function' && typeof setItemIsActive === 'function' ? handleToggleActive : undefined}
        renderSwipeActions={() => renderSwipeActions(item, id, locked, !deleteDisabled, !editDisabled, inlineEditable, canExternalEdit)}
        swipeableEnabled={swipeableCallbacks.swipeableEnabled}
        onSwipeableWillOpen={swipeableCallbacks.onSwipeableWillOpen}
        onSwipeableOpen={swipeableCallbacks.onSwipeableOpen}
        onSwipeableClose={swipeableCallbacks.onSwipeableClose}
        swipeableRef={swipeableCallbacks.swipeableRef}
        swipeRevealMode={swipeRevealMode}
      />
    );
  };

  // Render group header
  const renderGroupHeader = (group: GroupedListGroup<TItem>) => {
    const groupItems = itemsByGroupId[group.id] ?? [];
    const groupTotal = groupItems.reduce((sum, it) => sum + getItemAmount(it), 0);
    const groupTotalText = formatGroupTotalText(groupTotal);

    const groupExpanded = isExpanded(group.id);
    const isRenamingThisGroup = editingGroupId === group.id;
    const groupDeleteEnabled = groupExpanded && groupItems.length === 0 && !isRenamingThisGroup;
    const groupEditEnabled = groupExpanded && !isRenamingThisGroup;

    return (
      <View style={styles.groupWrapper}>
        {groupExpanded && canEditGroups ? (
          <View style={styles.groupActionsAbove}>
            {isRenamingThisGroup ? (
              <>
                <IconButton
                  icon="check"
                  size="md"
                  variant="success"
                  onPress={() => saveGroupName(group.id)}
                  disabled={false}
                  accessibilityLabel="Save"
                />
                <IconButton
                  icon="x"
                  size="md"
                  variant="neutral"
                  onPress={cancelEditGroupName}
                  disabled={false}
                  accessibilityLabel="Cancel"
                />
              </>
            ) : (
              <>
                <IconButton
                  icon="edit-2"
                  size="md"
                  variant="neutral"
                  onPress={() => startEditGroupName(group)}
                  disabled={!groupEditEnabled}
                  accessibilityLabel="Edit group"
                />
                {groupItems.length === 0 ? (
                  <IconButton
                    icon="trash-2"
                    size="md"
                    variant="destructive"
                    onPress={() => deleteGroup(group.id)}
                    disabled={!groupDeleteEnabled}
                    accessibilityLabel="Delete group"
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.groupCard}>
          <View style={styles.groupHeaderRow}>
            {isRenamingThisGroup ? (
              <View style={styles.groupHeaderLeft}>
                {groupNameError.length > 0 ? (
                  <Text style={[styles.groupNameErrorText, theme.typography.body, { color: theme.colors.semantic.errorText }]}>
                    {groupNameError}
                  </Text>
                ) : null}
                <TextInput
                  style={[
                    styles.groupNameInput,
                    theme.typography.sectionTitle,
                    {
                      backgroundColor: theme.colors.bg.card,
                      borderColor: theme.colors.border.default,
                      color: theme.colors.text.primary,
                      borderRadius: theme.radius.medium,
                    },
                  ]}
                  value={groupNameDraft}
                  onChangeText={setGroupNameDraft}
                  placeholderTextColor={theme.colors.text.disabled}
                  autoFocus={true}
                  returnKeyType="done"
                  onSubmitEditing={() => saveGroupName(group.id)}
                />
              </View>
            ) : canCollapseGroups ? (
              <Pressable
                onPress={() => toggleGroup(group.id)}
                style={({ pressed }) => [
                  styles.groupHeaderLeft,
                  { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
                ]}
              >
                <Text style={[styles.groupTitle, theme.typography.sectionTitle, { color: theme.colors.text.primary }]}>
                  {group.name}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.groupHeaderLeft}>
                <Text style={[styles.groupTitle, theme.typography.sectionTitle, { color: theme.colors.text.primary }]}>
                  {group.name}
                </Text>
              </View>
            )}

            <View style={styles.groupHeaderRight}>
              {canCollapseGroups ? (
                <Pressable
                  onPress={() => toggleGroup(group.id)}
                  style={({ pressed }) => [
                    styles.groupTotalPressable,
                    { backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent' },
                  ]}
                >
                  <Text style={[styles.groupTotal, theme.typography.valueSmall, { color: theme.colors.text.primary }]}>
                    {groupTotalText}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.groupTotalPressable}>
                  <Text style={[styles.groupTotal, theme.typography.valueSmall, { color: theme.colors.text.primary }]}>
                    {groupTotalText}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Render inline editor
  const renderInlineEditor = (groupId?: string) => {
    if (!editorVisible || effectiveEditorPlacement !== 'inline') {
      return null;
    }

    const targetGroupId = groupId || implicitGroupId;
    const groupExpanded = groupsEnabled ? isExpanded(targetGroupId) : true;
    const shouldShow =
      (canAddItems && (groupExpanded || !canCollapseGroups)) ||
      (editingItemId && activeEditingMeta?.groupId === targetGroupId);

    if (!shouldShow) {
      return null;
    }

    return (
      <View style={styles.editorInline}>
        {editingItemId && activeEditingMeta?.groupId === targetGroupId ? (
          <Text style={[styles.editorLabel, theme.typography.body, { color: theme.colors.text.secondary }]}>
            Editing: {activeEditingMeta.name}
          </Text>
        ) : null}
        {errorMessage.length > 0 ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.colors.semantic.errorBg,
                borderColor: theme.colors.semantic.errorBorder,
                borderRadius: theme.radius.medium,
              },
            ]}
          >
            <Text style={[styles.errorTitle, theme.typography.body, { fontWeight: '700', color: theme.colors.semantic.errorText }]}>
              Can't save
            </Text>
            <Text style={[styles.errorText, theme.typography.body, { color: theme.colors.semantic.errorText }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.entryRow}>
          {canEditItemName ? (
            <TextInput
              style={[
                styles.input,
                theme.typography.input,
                styles.entryName,
                {
                  backgroundColor: theme.colors.bg.card,
                  borderColor: theme.colors.border.default,
                  borderRadius: theme.radius.medium,
                  color: theme.colors.text.primary,
                },
              ]}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Name"
              placeholderTextColor={theme.colors.text.disabled}
              autoFocus={autoFocus}
            />
          ) : null}

          <TextInput
            style={[
              styles.input,
              theme.typography.input,
              styles.entryAmount,
              {
                backgroundColor: theme.colors.bg.card,
                borderColor: theme.colors.border.default,
                borderRadius: theme.radius.medium,
                color: theme.colors.text.primary,
              },
            ]}
            value={draftAmount}
            onChangeText={setDraftAmount}
            placeholder="Amount"
            placeholderTextColor={theme.colors.text.disabled}
            keyboardType="numeric"
          />

          <IconButton
            icon="check"
            size="md"
            variant="success"
            onPress={saveEditor}
            disabled={canCollapseGroups && groupsEnabled && groupId ? !isExpanded(groupId) : false}
            accessibilityLabel="Save"
            style={[
              styles.tickIconButton,
              {
                borderColor: theme.colors.semantic.successBorder,
                borderRadius: theme.radius.medium,
                opacity: canCollapseGroups && groupsEnabled && groupId && !isExpanded(groupId) ? 0.5 : 1,
              },
            ]}
          />
          <IconButton
            icon="x"
            size="md"
            variant="neutral"
            onPress={cancelEditor}
            accessibilityLabel="Cancel"
            style={[
              styles.cancelIconButton,
              {
                borderColor: theme.colors.border.default,
                borderRadius: theme.radius.medium,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  // Prepare groups for GroupedList
  const groupedListGroups: GroupedListGroup<TItem>[] | undefined = groupsEnabled
    ? effectiveGroups.map((group) => ({
        id: group.id,
        name: group.name,
        items: itemsByGroupId[group.id] ?? [],
      }))
    : undefined;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScreenHeader
        title={title}
        totalText={totalText}
        subtitle={subtextMain}
        subtitleFootnote={subtextFootnote}
        rightAccessory={
          showHeaderRight ? (
            <View style={styles.headerRightRow}>
              {hasHints ? (
                <IconButton
                  icon="help-circle"
                  size="md"
                  variant="neutral"
                  onPress={() => setIsHintOpen(true)}
                  accessibilityLabel="Common examples"
                />
              ) : null}
              {headerRightAccessory ? headerRightAccessory : null}
            </View>
          ) : null
        }
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 + keyboardHeight }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          directionalLockEnabled={true}
          scrollEnabled={openSwipeableId === null}
          onScrollBeginDrag={handleScrollBeginDrag}
          onStartShouldSetResponderCapture={() => {
            handleTouchOutside();
            return false; // Allow touch to continue to children
          }}
        >
          {renderIntro ? <View style={styles.introBlock}>{renderIntro}</View> : null}

          {effectiveEditorPlacement === 'top' && editorVisible ? (
            <SectionCard>
              <View style={styles.sectionHeaderRow}>
                <GroupHeader title={editingItemId ? 'Edit item' : 'Add item'} />
              </View>

              <View style={styles.activeEntryWrapper}>
                <View
                  style={[
                    styles.activeEntryBlock,
                    { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium },
                  ]}
                >
                  {errorMessage.length > 0 ? (
                    <View
                      style={[
                        styles.errorCard,
                        { backgroundColor: theme.colors.semantic.errorBg, borderColor: theme.colors.semantic.errorBorder, borderRadius: theme.radius.medium },
                      ]}
                    >
                      <Text style={[styles.errorTitle, theme.typography.body, { fontWeight: '700', color: theme.colors.semantic.errorText }]}>Can't save</Text>
                      <Text style={[styles.errorText, theme.typography.body, { color: theme.colors.semantic.errorText }]}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* Name and Amount fields */}
                  {editingItemId ? (
                    // Edit mode: Vertical stack with labels
                    <>
                      {canEditItemName ? (
                        <View style={styles.projectionField}>
                          <Text style={[styles.projectionFieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Name</Text>
                          {renderCustomNameField ? (
                            renderCustomNameField({
                              value: draftName,
                              onChange: setDraftName,
                              placeholder: 'Name',
                              editingItemId,
                            })
                          ) : (
                            <TextInput
                              style={[
                                styles.input,
                                styles.projectionFieldInputFull,
                                { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                              ]}
                              value={draftName}
                              onChangeText={setDraftName}
                              placeholder="Name"
                              placeholderTextColor={theme.colors.text.disabled}
                              autoFocus={false}
                              returnKeyType="next"
                            />
                          )}
                        </View>
                      ) : null}
                      <View style={styles.projectionField}>
                        <Text style={[styles.projectionFieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Amount</Text>
                        <TextInput
                          style={[
                            styles.input,
                            theme.typography.input,
                            styles.projectionFieldInputFull,
                            { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                          ]}
                          value={draftAmount}
                          onChangeText={setDraftAmount}
                          placeholder="Amount"
                          placeholderTextColor={theme.colors.text.disabled}
                          keyboardType="numeric"
                          returnKeyType={(secondaryNumberField || liquidityField) ? 'next' : 'done'}
                          onSubmitEditing={(!secondaryNumberField && !liquidityField) ? saveEditor : undefined}
                        />
                      </View>
                    </>
                  ) : (
                    // Add mode: Horizontal row (75/25 split)
                    <View style={[styles.activeEntryRow, styles.activeEntryRowSpacing]}>
                      {canEditItemName ? (
                        renderCustomNameField ? (
                          <View style={styles.activeEntryNameSplit}>
                            {renderCustomNameField({
                              value: draftName,
                              onChange: setDraftName,
                              placeholder: 'Name',
                              editingItemId: null,
                            })}
                          </View>
                        ) : (
                          <TextInput
                            style={[
                              styles.input,
                              theme.typography.input,
                              styles.activeEntryNameSplit,
                              { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                            ]}
                            value={draftName}
                            onChangeText={setDraftName}
                            placeholder="Name"
                            placeholderTextColor={theme.colors.text.disabled}
                            autoFocus={false}
                            returnKeyType="next"
                          />
                        )
                      ) : null}
                      <TextInput
                        style={[
                          styles.input,
                          theme.typography.input,
                          styles.activeEntryAmountSplit,
                          { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                        ]}
                        value={draftAmount}
                        onChangeText={setDraftAmount}
                        placeholder="Amount"
                        placeholderTextColor={theme.colors.text.disabled}
                        keyboardType="numeric"
                        returnKeyType={(secondaryNumberField || liquidityField) ? 'next' : 'done'}
                        onSubmitEditing={(!secondaryNumberField && !liquidityField) ? saveEditor : undefined}
                      />
                    </View>
                  )}

                  {/* Projection assumptions section */}
                  {(secondaryNumberField || liquidityField) ? (
                    editingItemId ? (
                      // Edit mode: Vertical stack with label and value
                      <View style={styles.projectionAssumptionsSection}>
                        {/* Growth rate */}
                        {secondaryNumberField ? (
                          <View style={styles.projectionField}>
                            <Text style={[styles.projectionFieldLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Growth rate (% per year)</Text>
                            <TextInput
                              style={[
                                styles.input,
                                styles.projectionFieldInputFull,
                                { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                              ]}
                              value={draftSecondaryNumber}
                              onChangeText={setDraftSecondaryNumber}
                              placeholder={secondaryNumberField.placeholder ?? 'Growth %'}
                              placeholderTextColor={theme.colors.text.disabled}
                              keyboardType="numeric"
                              returnKeyType={liquidityField ? 'next' : 'done'}
                              onSubmitEditing={!liquidityField ? saveEditor : undefined}
                            />
                          </View>
                        ) : null}

                        {/* Liquidity */}
                        {liquidityField ? (
                          <View style={styles.projectionField}>
                            <Text style={[styles.projectionFieldLabelGrey, theme.typography.label, { color: theme.colors.text.disabled }]}>Liquidity</Text>
                            <SegmentedControl
                              values={['Liquid', 'Locked', 'Illiquid']}
                              selectedIndex={draftLiquidityType === 'immediate' ? 0 : draftLiquidityType === 'locked' ? 1 : 2}
                              onChange={(event) => {
                                const index = event.nativeEvent.selectedSegmentIndex;
                                if (index === 0) {
                                  setDraftLiquidityType('immediate');
                                  setDraftUnlockAge('');
                                } else if (index === 1) {
                                  setDraftLiquidityType('locked');
                                } else {
                                  setDraftLiquidityType('illiquid');
                                  setDraftUnlockAge('');
                                }
                              }}
                              style={styles.segmentedControl}
                              fontStyle={{ color: theme.colors.text.disabled }}
                              activeFontStyle={{ color: theme.colors.text.disabled }}
                            />
                            
                            {draftLiquidityType === 'locked' ? (
                              <View style={styles.unlockAgeContainer}>
                                <Text style={[styles.unlockAgeLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Unlock age</Text>
                                <View style={styles.unlockAgeRow}>
                                  <TextInput
                                    style={[
                                      styles.input,
                                      theme.typography.input,
                                      styles.unlockAgeInput,
                                      { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                                    ]}
                                    value={draftUnlockAge}
                                    onChangeText={setDraftUnlockAge}
                                    placeholder="e.g. 55"
                                    placeholderTextColor={theme.colors.text.disabled}
                                    keyboardType="numeric"
                                    returnKeyType="done"
                                    onSubmitEditing={saveEditor}
                                  />
                                  <Text style={[styles.unlockAgeSuffix, theme.typography.bodySmall, { color: theme.colors.text.disabled }]}>years</Text>
                                </View>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      // Add mode: Compact, no header, same row
                      <View style={styles.projectionAssumptionsCompact}>
                        <View style={styles.activeEntryRow}>
                          {/* Growth rate */}
                          {secondaryNumberField ? (
                            <TextInput
                              style={[
                                styles.input,
                                theme.typography.input,
                                styles.projectionFieldInputCompact,
                                { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                              ]}
                              value={draftSecondaryNumber}
                              onChangeText={setDraftSecondaryNumber}
                              placeholder={secondaryNumberField.placeholder ?? 'Growth %'}
                              placeholderTextColor={theme.colors.text.disabled}
                              keyboardType="numeric"
                              returnKeyType={liquidityField ? 'next' : 'done'}
                              onSubmitEditing={!liquidityField ? saveEditor : undefined}
                            />
                          ) : null}

                          {/* Liquidity */}
                          {liquidityField ? (
                            <View style={styles.liquidityCompact}>
                              <SegmentedControl
                                values={['Liquid', 'Locked', 'Illiquid']}
                                selectedIndex={draftLiquidityType === 'immediate' ? 0 : draftLiquidityType === 'locked' ? 1 : 2}
                                onChange={(event) => {
                                  const index = event.nativeEvent.selectedSegmentIndex;
                                  if (index === 0) {
                                    setDraftLiquidityType('immediate');
                                    setDraftUnlockAge('');
                                  } else if (index === 1) {
                                    setDraftLiquidityType('locked');
                                  } else {
                                    setDraftLiquidityType('illiquid');
                                    setDraftUnlockAge('');
                                  }
                                }}
                                style={styles.segmentedControlCompact}
                                fontStyle={{ color: theme.colors.text.disabled }}
                                activeFontStyle={{ color: theme.colors.text.disabled }}
                              />
                            </View>
                          ) : null}
                        </View>

                        {/* Unlock age (if From age selected) - shown below in compact mode too */}
                        {liquidityField && draftLiquidityType === 'locked' ? (
                          <View style={styles.unlockAgeContainer}>
                            <Text style={[styles.unlockAgeLabel, theme.typography.label, { color: theme.colors.text.disabled }]}>Unlock age</Text>
                            <View style={styles.unlockAgeRow}>
                              <TextInput
                                style={[
                                  styles.input,
                                  theme.typography.input,
                                  styles.unlockAgeInput,
                                  { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium, color: theme.colors.text.primary },
                                ]}
                                value={draftUnlockAge}
                                onChangeText={setDraftUnlockAge}
                                placeholder="e.g. 55"
                                placeholderTextColor={theme.colors.text.disabled}
                                keyboardType="numeric"
                                returnKeyType="done"
                                onSubmitEditing={saveEditor}
                              />
                              <Text style={[styles.unlockAgeSuffix, theme.typography.bodySmall, { color: theme.colors.text.disabled }]}>years</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    )
                  ) : null}
                </View>

                {/* Action buttons - positioned outside and bottom-right aligned */}
                <View style={styles.activeEntryActions}>
                  <View style={[styles.activeEntryButtonsContainer, { borderColor: theme.colors.border.default, borderRadius: theme.radius.large }]}>
                    <IconButton
                      icon="check"
                      size="md"
                      variant="success"
                      onPress={saveEditor}
                      accessibilityLabel={editingItemId ? 'Save' : 'Add'}
                      style={[
                        styles.activeTickIconButton,
                        {
                          borderTopLeftRadius: theme.radius.large,
                          borderBottomLeftRadius: theme.radius.large,
                          borderTopRightRadius: theme.radius.none,
                          borderBottomRightRadius: theme.radius.none,
                        },
                      ]}
                    />
                    <View style={[styles.activeEntryButtonsDivider, { backgroundColor: theme.colors.border.default }]} />
                    <IconButton
                      icon="x"
                      size="md"
                      variant="neutral"
                      onPress={cancelEditor}
                      accessibilityLabel={editingItemId ? 'Cancel' : 'Clear'}
                      style={[
                        styles.activeCancelIconButton,
                        {
                          borderTopLeftRadius: theme.radius.none,
                          borderBottomLeftRadius: theme.radius.none,
                          borderTopRightRadius: theme.radius.large,
                          borderBottomRightRadius: theme.radius.large,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </SectionCard>
          ) : null}

          {/* Items list section */}
          <SectionCard>
            {/* List/Table section header (kept simple; matches "two clean sections" rhythm). */}
            {!groupsEnabled ? (
              <View style={styles.sectionHeaderRow}>
                <GroupHeader title={title} />
              </View>
            ) : null}

            <GroupedList
              groups={groupedListGroups}
              items={groupsEnabled ? undefined : items}
              getItemId={getItemId}
              isGroupExpanded={isExpanded}
              canCollapseGroups={canCollapseGroups}
              renderGroupHeader={renderGroupHeader}
              renderRow={renderRow}
              renderSwipeActions={(item) => {
                const id = getItemId(item);
                const locked = isLocked(item);
                const groupId = groupsEnabled ? getItemGroupId(item) : undefined;
                const deleteDisabled = locked || !canDeleteItems || (canCollapseGroups && groupId && !isExpanded(groupId));
                const editDisabled = locked || (canCollapseGroups && groupId && !isExpanded(groupId));
                const inlineEditable = isInlineEditable(item);
                const canExternalEdit = typeof onExternalEditItem === 'function';
                return renderSwipeActions(item, id, locked, !deleteDisabled, !editDisabled, inlineEditable, canExternalEdit);
              }}
              emptyStateText={emptyStateText}
              renderInlineEditor={renderInlineEditor}
              swipeableRefs={swipeableRefs}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableOpen={handleSwipeableOpen}
              onSwipeableClose={handleSwipeableClose}
              swipeableEnabled={(itemId) => {
                const item = items.find(it => getItemId(it) === itemId);
                if (!item) return false;
                const groupId = groupsEnabled ? getItemGroupId(item) : undefined;
                return getSwipeableEnabled(itemId, groupId);
              }}
            />

            {groupsEnabled && canEditGroups && canAddGroups ? (
              <Pressable
                onPress={addGroup}
                style={({ pressed }) => [
                  styles.addGroupButton,
                  {
                    borderColor: theme.colors.border.default,
                    borderRadius: theme.radius.medium,
                    backgroundColor: pressed ? theme.colors.bg.subtle : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.addGroupButtonText, theme.typography.button, { color: theme.colors.text.secondary }]}>
                  + Add group
                </Text>
              </Pressable>
            ) : null}
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderFooter ? <View style={styles.footerContainer}>{renderFooter}</View> : null}

      {hasHints ? (
        <Modal
          transparent={true}
          visible={hintVisible}
          animationType="slide"
          onRequestClose={() => setIsHintOpen(false)}
        >
          <>
            <Pressable style={[styles.hintBackdrop, { backgroundColor: theme.colors.overlay.scrim25 }]} onPress={() => setIsHintOpen(false)} />
            <View style={[styles.hintSheet, { backgroundColor: theme.colors.bg.card, borderTopLeftRadius: theme.radius.large, borderTopRightRadius: theme.radius.large }]}>
              {helpContent ? (
                <>
                  <Text style={[styles.hintTitle, theme.typography.sectionTitle, { color: theme.colors.text.primary }]}>{helpContent.title}</Text>
                  <ScrollView style={styles.hintScroll} contentContainerStyle={styles.hintScrollContent} showsVerticalScrollIndicator={false}>
                    {helpContent.sections.map((section, sectionIdx) => (
                      <View key={sectionIdx} style={sectionIdx > 0 ? { marginTop: 16, paddingTop: 16 } : null}>
                        {sectionIdx > 0 && <Divider variant="default" />}
                        {section.heading ? (
                          <Text style={[styles.helpSectionHeading, theme.typography.bodyLarge, { fontWeight: '600', color: theme.colors.text.primary }]}>{section.heading}</Text>
                        ) : null}
                        {section.paragraphs?.map((para, paraIdx) => (
                          <Text key={paraIdx} style={[styles.helpParagraph, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>{para}</Text>
                        ))}
                        {section.example ? (
                          <Text style={[styles.helpExample, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>
                            {section.example.text}
                            <Text style={[styles.helpExampleBold, theme.typography.bodyLarge, { fontWeight: '600', color: theme.colors.text.primary }]}>{section.example.boldValue}</Text>
                          </Text>
                        ) : null}
                        {section.bullets ? (
                          <View style={styles.helpBulletsContainer}>
                            {section.bullets.map((bullet, bulletIdx) => (
                              <Text key={bulletIdx} style={[styles.helpBullet, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>
                                • {bullet}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        {section.paragraphsAfter?.map((para, paraIdx) => (
                          <Text key={`after-${paraIdx}`} style={[styles.helpParagraph, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>{para}</Text>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <>
                  <Text style={[styles.hintTitle, theme.typography.sectionTitle, { color: theme.colors.text.primary }]}>Common examples</Text>
                  <Text style={[styles.hintIntro, theme.typography.body, { color: theme.colors.text.muted }]}>These are common examples people include. Use what applies to you.</Text>
                  <ScrollView style={styles.hintScroll} contentContainerStyle={styles.hintScrollContent} showsVerticalScrollIndicator={false}>
                    {(hintExamples ?? []).map((ex, idx) => (
                      <Text key={`${idx}-${ex}`} style={[styles.hintBullet, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>
                        • {ex}
                      </Text>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </>
        </Modal>
      ) : null}

      {/* Delete confirmation modal */}
      {pendingDeleteItemId ? (
        <Modal transparent={true} visible={true} animationType="fade" onRequestClose={cancelDeleteItem}>
          <View style={[styles.deleteModalBackdrop, { backgroundColor: theme.colors.overlay.scrim50 }]}>
            <View style={[styles.deleteModalContent, { backgroundColor: theme.colors.bg.card, borderRadius: theme.radius.large }]}>
              <Text style={[styles.deleteModalTitle, theme.typography.valueLarge, { fontWeight: '700', color: theme.colors.text.primary }]}>Delete item?</Text>
              <Text style={[styles.deleteModalMessage, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>This action cannot be undone.</Text>
              <View style={styles.deleteModalActions}>
                <Pressable
                  onPress={cancelDeleteItem}
                  style={({ pressed }) => [
                    styles.deleteModalButton,
                    styles.deleteModalButtonCancel,
                    { backgroundColor: pressed ? theme.colors.border.default : theme.colors.bg.subtle, borderColor: theme.colors.border.default, borderRadius: theme.radius.medium },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.deleteModalButtonCancelText, theme.typography.button, { color: theme.colors.text.tertiary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDeleteItem}
                  style={({ pressed }) => [
                    styles.deleteModalButton,
                    styles.deleteModalButtonConfirm,
                    { backgroundColor: pressed ? theme.colors.semantic.errorBg : theme.colors.semantic.error, borderRadius: theme.radius.medium },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                >
                  <Text style={[styles.deleteModalButtonConfirmText, theme.typography.button, { color: theme.colors.text.primary }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const ROW_HEIGHT = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  hintButton: {
    padding: 6,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hintSheet: {
    padding: 16,
    maxHeight: '80%',
  },
  footerContainer: {
    // Footer is already within SafeAreaView; this just provides breathing room.
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  introBlock: {
    marginBottom: 12,
  },
  hintTitle: {
    marginBottom: 6,
  },
  hintIntro: {
    marginBottom: 10,
  },
  hintScroll: {
    marginTop: 12,
  },
  hintScrollContent: {
    paddingBottom: 24,
  },
  hintBullet: {
    marginBottom: 6,
  },
  helpSectionHeading: {
    marginBottom: 8,
  },
  helpParagraph: {
    marginBottom: 10,
  },
  helpBulletsContainer: {
    marginTop: 4,
    marginBottom: 10,
  },
  helpBullet: {
    marginBottom: 6,
  },
  helpExample: {
    marginTop: 4,
    marginBottom: 10,
  },
  helpExampleBold: {
    // Typography via theme.typography.bodyLarge with fontWeight override
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingTop: layout.screenPaddingTop,
  },
  educationBlock: {
    marginBottom: 12,
  },
  addGroupButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  addGroupButtonText: {
    // Typography via theme.typography.button
  },
  groupWrapper: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 6,
  },
  activeEntryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  activeEntryButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  activeEntryButtonsDivider: {
    width: 1,
    height: 30,
  },
  groupActionsAbove: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 5,
    marginBottom: 6,
  },
  groupCard: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTotalPressable: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  groupBody: {
    marginTop: 4,
  },
  groupTitle: {
    // Typography via theme.typography.sectionTitle
  },
  groupTotal: {
    // Typography via theme.typography.valueSmall
  },
  groupNameInput: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    // Typography via theme.typography.sectionTitle (for TextInput, use input token)
  },
  groupNameErrorText: {
    marginBottom: 6,
  },
  emptyText: {
    marginBottom: 8,
  },
  itemRowWrapper: {
    // Wrapper kept for structure, but no margin (dividers provide separation)
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: layout.rowPaddingHorizontal,
    position: 'relative',
  },
  itemRowDim: {
    opacity: 0.45,
  },
  itemRowLocked: {
    opacity: 0.7,
  },
  itemRowInactive: {
    opacity: 0.5,
  },
  activeCheckbox: {
    marginLeft: 0,
    marginRight: spacing.tiny,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheckmark: {
    // Typography via theme.typography.caption with fontWeight override
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemMainActive: {
    opacity: 0.95,
  },
  itemMainLocked: {
    opacity: 0.7,
  },
  itemLeft: {
    flex: 1,
    flexShrink: 1,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    marginBottom: 1,
  },
  itemNameLocked: {
    // Legacy style - typography removed, using theme tokens
  },
  itemAmount: {
    // Typography via theme.typography.valueSmall
    marginLeft: 'auto',
    textAlign: 'right',
  },
  itemAmountLocked: {
    // Legacy style - typography removed, using theme tokens
  },
  itemRight: {
    // No longer used - amount is now in primaryRow
  },
  itemMeta: {
    marginTop: spacing.tiny,
    // Single-line truncation enforced via numberOfLines prop
  },
  itemMetaLocked: {
    // Legacy style - typography removed, using theme tokens
  },
  editorInline: {
    marginTop: 10,
  },
  editorLabel: {
    marginBottom: 6,
  },
  activeEntryWrapper: {
    marginBottom: 12,
  },
  activeEntryBlock: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 4,
  },
  activeEntryLabel: {
    marginBottom: 6,
  },
  activeEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  activeEntryRowSpacing: {
    marginBottom: 4,
  },
  activeEntryName: {
    flexGrow: 1,
  },
  activeEntryNameSplit: {
    flex: 0.75,
    marginRight: 8,
    justifyContent: 'center',
  },
  activeEntryAmount: {
    width: 130,
  },
  activeEntryAmountSplit: {
    flex: 0.25,
  },
  activeEntrySecondary: {
    width: 130,
  },
  activeTickIconButton: {
    width: 56,
    height: 30,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCancelIconButton: {
    width: 56,
    height: 30,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTickText: {
    // Typography via theme.typography.sectionTitle with fontWeight override
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderWidth: 1,
    padding: 10,
    // Typography via theme.typography.input (applied to TextInput components)
  },
  entryName: {
    flex: 1,
  },
  entryAmount: {
    width: 110,
  },
  tickIconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: {
    // Typography via theme.typography.valueLarge with fontWeight override
  },
  cancelIconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  errorTitle: {
    marginBottom: 4,
  },
  errorText: {
    // Typography via theme.typography.body
  },
  projectionAssumptionsSection: {
    marginTop: 8,
  },
  projectionAssumptionsCompact: {
    marginTop: 8,
  },
  projectionAssumptionsHeader: {
    marginBottom: 4,
  },
  projectionAssumptionsHelper: {
    marginBottom: 8,
  },
  projectionField: {
    marginBottom: 8,
  },
  projectionFieldLabel: {
    marginBottom: 4,
  },
  projectionFieldLabelGrey: {
    marginBottom: 4,
  },
  projectionFieldInput: {
    width: 130,
  },
  projectionFieldInputFull: {
    width: '100%',
  },
  projectionFieldInputCompact: {
    width: 130,
  },
  liquidityCompact: {
    flex: 1,
    marginLeft: 8,
  },
  segmentedControl: {
    marginBottom: 8,
    height: 32,
  },
  segmentedControlCompact: {
    height: 32,
  },
  segmentedControlText: {
    // Color via theme.colors.text.disabled (applied inline)
  },
  segmentedControlTextActive: {
    // Color via theme.colors.text.disabled (applied inline)
  },
  unlockAgeContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  unlockAgeLabel: {
    marginBottom: 4,
  },
  unlockAgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockAgeInput: {
    width: 100,
  },
  unlockAgeSuffix: {
    // Typography via theme.typography.bodySmall
  },
  deleteModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    marginBottom: 8,
  },
  deleteModalMessage: {
    marginBottom: 20,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  deleteModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  deleteModalButtonCancel: {
    borderWidth: 1,
  },
  deleteModalButtonConfirm: {
    // Background color via theme.colors.semantic.error (applied inline)
  },
  deleteModalButtonCancelText: {
    // Typography via theme.typography.button
  },
  deleteModalButtonConfirmText: {
    // Typography via theme.typography.button
  },
  swipeableContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 44,
    paddingLeft: 2,
    paddingRight: 2,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    gap: 4,
  },
  swipeActionEdit: {
    width: 35,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionDelete: {
    width: 35,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
