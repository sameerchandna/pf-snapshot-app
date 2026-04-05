import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable, ScrollView } from 'react-native-gesture-handler';
import { Group } from '../types';
import { parseItemName, parseMoney } from '../domain/domainValidation';
import ScreenHeader from '../components/ScreenHeader';
import SketchBackground from '../components/SketchBackground';
import SectionHeader from '../components/SectionHeader';
import SectionCard from '../components/SectionCard';
import GroupedListSection from '../components/list/GroupedListSection';
import Divider from '../components/Divider';
import IconButton from '../components/IconButton';
import SwipeAction from '../components/SwipeAction';
import EditorActionGroup from '../components/EditorActionGroup';
import ItemEditor from '../components/ItemEditor';
import GroupedList, { Group as GroupedListGroup } from '../components/list/GroupedList';
import { spacing } from '../ui/spacing';
import { layout } from '../ui/layout';
import { useTheme } from '../ui/theme/useTheme';
import { useScreenPalette } from '../ui/theme/palettes';
import { formatCurrencyFull } from '../ui/formatters';

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

  // Optional subtext to display below the "Add item" / "Edit item" header in the SectionCard
  editorSubtext?: string;

  // Optional custom action buttons renderer (for Expenses compact control)
  renderActionButtons?: (props: { onSave: () => void; onCancel: () => void; editingItemId: string | null }) => React.ReactNode;

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

  /** @deprecated no longer used internally; kept for compatibility */
  swipeRevealMode?: 'replace' | 'overlay';

  // renderRow is required.
  // EditableCollectionScreen does NOT provide a default row renderer.
  // All consumers must explicitly define row behavior using CollectionRowWithActions.

  /**
   * Required custom row renderer (v2 row architecture).
   * 
   * All screens must provide a custom row renderer using the v2 architecture.
   * Uses simplified callback API (onEdit, onDelete, onToggleActive) with swipe coordination.
   * 
   * See ExpensesDetailScreen for the v2 implementation pattern.
   */
  renderRow: (
    item: TItem,
    index: number,
    groupId: string | undefined,
    isLastInGroup: boolean,
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
  editorSubtext,
  renderActionButtons,
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
  const palette = useScreenPalette();
  // Education cleanup (phase 1): detail/editor screens should focus purely on entry & inspection.
  // EducationBox is kept only on Snapshot / Accounts / Projection results.
  void educationLines;
  void insightText;
  const groupsEnabled: boolean = allowGroups !== false;
  const implicitGroupId: string = 'general';
  const implicitGroupName: string = 'General';

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
  const [focusedInput, setFocusedInput] = useState<'name' | 'amount' | null>(null);
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
    setFocusedInput(null);
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
      return { ok: false, message: `That value is too large. Max allowed is ${formatCurrencyFull(maxValue)}.` };
    }

    const secondaryTrimmed = draftSecondaryNumber.trim();
    let secondaryNumber: number | null = null;
    if (secondaryNumberField && secondaryTrimmed.length > 0) {
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
    if (liquidityField) {
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
    if (secondaryNumberField?.getItemValue) {
      const v = secondaryNumberField.getItemValue(item);
      setDraftSecondaryNumber(typeof v === 'number' && Number.isFinite(v) ? v.toString() : '');
    } else {
      setDraftSecondaryNumber('');
    }
    if (liquidityField?.getItemLiquidity) {
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
    // Ensure the active entry block is visible when editing.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  // Row rendering is fully delegated to the consumer.
  // There is no fallback FinancialItemRow.
  // This enforces explicit configuration and architectural consistency.

  // Render row using custom renderRow (v2 row architecture)
  const renderRow = (
    item: TItem,
    index: number,
    groupId: string | undefined,
    isLastInGroup: boolean,
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

    // Calculate showTopDivider: show divider if not the first item in the group
    const showTopDivider: boolean = index > 0;

    const handleToggleActive = () => {
      if (typeof setItemIsActive === 'function') {
        const updated = setItemIsActive(item, !itemIsActive);
        const updatedItems = items.map(i => getItemId(i) === id ? updated : i);
        setItems(updatedItems);
      }
    };

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
      isLastInGroup,
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

  // Prepare groups for GroupedList
  const groupedListGroups: GroupedListGroup<TItem>[] | undefined = groupsEnabled
    ? effectiveGroups.map((group) => ({
        id: group.id,
        name: group.name,
        items: itemsByGroupId[group.id] ?? [],
      }))
    : undefined;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <SketchBackground color={palette.accent} style={{flex:1}}>
      <ScreenHeader
        title={title}
        totalText={totalText}
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + keyboardHeight }]}
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

          {editorVisible ? (
            <SectionCard fillColor="transparent" style={{ marginTop: layout.sectionGap }}>
              <SectionHeader title="Quick Entry" />
              <ItemEditor
                draftName={draftName}
                draftAmount={draftAmount}
                draftSecondaryNumber={draftSecondaryNumber}
                draftLiquidityType={draftLiquidityType}
                draftUnlockAge={draftUnlockAge}
                editingItemId={editingItemId}
                errorMessage={errorMessage}
                focusedInput={focusedInput}
                onDraftNameChange={setDraftName}
                onDraftAmountChange={setDraftAmount}
                onDraftSecondaryNumberChange={setDraftSecondaryNumber}
                onDraftLiquidityTypeChange={setDraftLiquidityType}
                onDraftUnlockAgeChange={setDraftUnlockAge}
                onFocusedInputChange={setFocusedInput}
                onSave={saveEditor}
                onCancel={cancelEditor}
                canEditItemName={canEditItemName}
                renderCustomNameField={renderCustomNameField}
                renderActionButtons={renderActionButtons}
                secondaryNumberField={secondaryNumberField}
                liquidityField={liquidityField}
              />
            </SectionCard>
          ) : null}

          {/* Items list section */}
          <SectionCard fillColor="transparent" style={{ marginTop: layout.sectionGap }}>
            <SectionHeader title={title} />
            {editorSubtext ? (
              <View style={styles.editorSubtextContainer}>
                <Text style={[styles.editorSubtext, theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>
                  {editorSubtext}
                </Text>
              </View>
            ) : null}
            <View style={styles.firstGroupedListSection}>
            <GroupedListSection>

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
            </GroupedListSection>
            </View>
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
                      <View key={sectionIdx} style={sectionIdx > 0 ? { marginTop: spacing.xl, paddingTop: spacing.xl } : null}>
                        {sectionIdx > 0 && <Divider variant="default" />}
                        {section.heading ? (
                          <Text style={[styles.helpSectionHeading, theme.typography.button, { color: theme.colors.text.primary }]}>{section.heading}</Text>
                        ) : null}
                        {section.paragraphs?.map((para, paraIdx) => (
                          <Text key={paraIdx} style={[styles.helpParagraph, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>{para}</Text>
                        ))}
                        {section.example ? (
                          <Text style={[styles.helpExample, theme.typography.bodyLarge, { color: theme.colors.text.tertiary }]}>
                            {section.example.text}
                            <Text style={[styles.helpExampleBold, theme.typography.button, { color: theme.colors.text.primary }]}>{section.example.boldValue}</Text>
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
              <Text style={[styles.deleteModalTitle, theme.typography.valueLarge, { color: theme.colors.text.primary }]}>Delete item?</Text>
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
      </SketchBackground>
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
    padding: spacing.xs,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hintBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hintSheet: {
    padding: spacing.xl,
    maxHeight: '80%',
  },
  footerContainer: {
    // Footer is already within SafeAreaView; this just provides breathing room.
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  introBlock: {
    marginBottom: spacing.base,
  },
  hintTitle: {
    marginBottom: spacing.xs,
  },
  hintIntro: {
    marginBottom: layout.inputPadding,
  },
  hintScroll: {
    marginTop: spacing.base,
  },
  hintScrollContent: {
    paddingBottom: spacing.huge,
  },
  hintBullet: {
    marginBottom: spacing.xs,
  },
  helpSectionHeading: {
    marginBottom: spacing.sm,
  },
  helpParagraph: {
    marginBottom: layout.inputPadding,
  },
  helpBulletsContainer: {
    marginTop: spacing.tiny,
    marginBottom: layout.inputPadding,
  },
  helpBullet: {
    marginBottom: spacing.xs,
  },
  helpExample: {
    marginTop: spacing.tiny,
    marginBottom: layout.inputPadding,
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
  addGroupButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: layout.inputPadding,
    marginBottom: spacing.base,
  },
  addGroupButtonText: {
    // Typography via theme.typography.button
  },
  groupWrapper: {
    marginBottom: spacing.base,
  },
  editorSubtextContainer: {
    paddingHorizontal: layout.rowPaddingHorizontal,
    marginTop: spacing.tiny,
    marginBottom: spacing.xs,
  },
  editorSubtext: {
    // Text styling applied inline with theme tokens
  },
  firstGroupedListSection: {
    marginTop: spacing.base,
  },
  groupActionsAbove: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: layout.xxs,
    marginBottom: spacing.xs,
  },
  groupCard: {
    backgroundColor: 'transparent',
    padding: spacing.zero,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groupHeaderLeft: {
    flex: 1,
    marginRight: layout.inputPadding,
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTotalPressable: {
    paddingVertical: spacing.tiny,
    paddingHorizontal: layout.micro,
  },
  groupTitle: {
    // Typography via theme.typography.sectionTitle
  },
  groupTotal: {
    // Typography via theme.typography.valueSmall
  },
  groupNameInput: {
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: layout.inputPadding,
    // Typography via theme.typography.sectionTitle (for TextInput, use input token)
  },
  groupNameErrorText: {
    marginBottom: spacing.xs,
  },
  deleteModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.section,
  },
  deleteModalContent: {
    padding: spacing.section,
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    marginBottom: spacing.sm,
  },
  deleteModalMessage: {
    marginBottom: layout.sectionGap,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.base,
  },
  deleteModalButton: {
    paddingVertical: layout.buttonPaddingVertical,
    paddingHorizontal: layout.buttonPaddingHorizontal,
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
  swipeActionsContainer: {
    // Container for swipe actions - sizing handled by SwipeAction component
    // Alignment and gap handled by SwipeRowContainer actionsContainer
  },
});
