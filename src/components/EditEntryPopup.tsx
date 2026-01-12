import { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  STButton,
  STFancyDropdown,
  STSortableList,
  STTextarea,
  SortableListItemData,
  DropdownItem,
} from 'sillytavern-utils-lib/components/react';
import { st_runRegexScript } from 'sillytavern-utils-lib/config';
import { RegexScriptData } from 'sillytavern-utils-lib/types/regex';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { SupportedLanguage, settingsManager } from '../settings.js';

const globalContext = SillyTavern.getContext();

/**
 * The props for the EditEntryPopup component.
 */
interface EditEntryPopupProps {
  entry: WIEntry;
  initialRegexIds: Record<string, Partial<RegexScriptData>>;
}

/**
 * Defines the imperative functions that can be called on this component's instance
 * from a parent component using a ref.
 */
export interface EditEntryPopupRef {
  getFormData: () => {
    updatedEntry: WIEntry;
    updatedRegexIds: Record<string, Partial<RegexScriptData>>;
  };
}

type EditLabels = {
  title: string;
  nameLabel: string;
  keywordsLabel: string;
  applyRegexTitle: string;
  regexPlaceholder: string;
  simulateButton: string;
  contentPlaceholder: string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const EDIT_LABELS: Record<SupportedLanguage, EditLabels> = {
  en: {
    title: 'Edit Suggestion',
    nameLabel: 'Title',
    keywordsLabel: 'Keywords (comma-separated)',
    applyRegexTitle: 'Apply Regex Scripts',
    regexPlaceholder: 'Select regex scripts...',
    simulateButton: 'Simulate Regex',
    contentPlaceholder: 'Resulting content...',
  },
  'zh-CN': {
    title: '编辑建议条目',
    nameLabel: '标题',
    keywordsLabel: '触发词（以逗号分隔）',
    applyRegexTitle: '应用正则脚本',
    regexPlaceholder: '请选择要应用的正则脚本…',
    simulateButton: '模拟应用正则',
    contentPlaceholder: '最终内容预览…',
  },
};

/**
 * A popup form for editing a suggested World Info entry, including its content and associated regex scripts.
 * It's wrapped in `forwardRef` to allow the parent component to call `getFormData` imperatively when the
 * user confirms the changes via an external "OK" button (provided by the <Popup> component).
 */
export const EditEntryPopup = forwardRef<EditEntryPopupRef, EditEntryPopupProps>(({ entry, initialRegexIds }, ref) => {
  // --- Internal State Management ---
  const [allRegexes, setAllRegexes] = useState<RegexScriptData[]>([]);
  const [title, setTitle] = useState(entry.comment);
  const [keywords, setKeywords] = useState(entry.key.join(', '));
  const [content, setContent] = useState(entry.content);
  const [regexListItems, setRegexListItems] = useState<SortableListItemData[]>([]);

  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = EDIT_LABELS[language] ?? EDIT_LABELS[DEFAULT_LANGUAGE];

  useEffect(() => {
    const loadedRegexes = globalContext.extensionSettings.regex ?? [];
    setAllRegexes(loadedRegexes);

    const initialItems = Object.entries(initialRegexIds)
      .map(([id, data]) => {
        const regex = loadedRegexes.find((r) => r.id === id);
        return regex ? { id: regex.id, label: regex.scriptName, enabled: !data?.disabled } : null;
      })
      // @ts-ignore
      .filter((item): item is SortableListItemData => item !== null);
    // @ts-ignore
    setRegexListItems(initialItems);
  }, [initialRegexIds]);

  // --- Imperative Handle ---
  // This exposes the `getFormData` function to the parent component through the ref.
  // It's the bridge that allows the parent's "OK" button to retrieve this component's final state.
  useImperativeHandle(ref, () => ({
    getFormData: () => {
      const updatedEntry: WIEntry = {
        ...entry,
        comment: title.trim(),
        key: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        content,
      };

      const updatedRegexIds = regexListItems.reduce(
        (acc, item) => {
          acc[item.id] = { disabled: !item.enabled };
          return acc;
        },
        {} as Record<string, Partial<RegexScriptData>>,
      );

      return { updatedEntry, updatedRegexIds };
    },
  }));

  // --- Derived Data & Handlers ---
  const fancyDropdownItems = useMemo(
    (): DropdownItem[] => allRegexes.map((r) => ({ value: r.id, label: r.scriptName })),
    [allRegexes],
  );

  const selectedRegexIds = useMemo(() => regexListItems.map((item) => item.id), [regexListItems]);

  const handleSimulate = useCallback(() => {
    let simulatedContent = entry.content; // Start from original content for simulation
    const orderedEnabledItems = regexListItems.filter((item) => item.enabled);

    for (const item of orderedEnabledItems) {
      const regex = allRegexes.find((r) => r.id === item.id);
      if (regex) {
        simulatedContent = st_runRegexScript(regex, simulatedContent);
      }
    }
    setContent(simulatedContent);
  }, [regexListItems, allRegexes, entry.content]);

  const handleRegexSelectionChange = (newIds: string[]) => {
    const newItems = newIds
      .map((id) => {
        const existingItem = regexListItems.find((item) => item.id === id);
        if (existingItem) return existingItem;
        const regex = allRegexes.find((r) => r.id === id);
        return regex ? { id: regex.id, label: regex.scriptName, enabled: true } : null;
      })
      .filter((item): item is SortableListItemData => item !== null);
    setRegexListItems(newItems);
  };

  // The component does not render its own buttons, as they are provided by the parent <Popup>.
  return (
    <div className="edit-popup" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <h3>{labels.title}</h3>
      <div>
        <label>{labels.nameLabel}</label>
        <input type="text" className="text_pole" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label>{labels.keywordsLabel}</label>
        <input type="text" className="text_pole" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </div>
      <div>
        <h4>{labels.applyRegexTitle}</h4>
        <STFancyDropdown
          items={fancyDropdownItems}
          value={selectedRegexIds}
          onChange={handleRegexSelectionChange}
          multiple
          enableSearch
          placeholder={labels.regexPlaceholder}
        />
        {regexListItems.length > 0 && (
          <STSortableList
            items={regexListItems}
            onItemsChange={setRegexListItems}
            showToggleButton
            showDeleteButton
            sortableJsOptions={{ style: { marginTop: '10px' } }}
          />
        )}
      </div>
      <STButton onClick={handleSimulate} className="menu_button">
        {labels.simulateButton}
      </STButton>
      <STTextarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        placeholder={labels.contentPlaceholder}
      />
    </div>
  );
});
