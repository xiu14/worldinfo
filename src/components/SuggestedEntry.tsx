import { FC, useState, useMemo, useRef } from 'react';
import showdown from 'showdown';
import { STButton, Popup, STTextarea } from 'sillytavern-utils-lib/components/react';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { RegexScriptData } from 'sillytavern-utils-lib/types/regex';
import { POPUP_TYPE } from 'sillytavern-utils-lib/types/popup';
import { CompareEntryPopup } from './CompareEntryPopup.js';
import { EditEntryPopup, EditEntryPopupRef } from './EditEntryPopup.js';
import { ReviseSessionManager } from './ReviseSessionManager.js';
import { Session } from '../generate.js';
import { ExtensionSettings, SupportedLanguage, settingsManager } from '../settings.js';

const converter = new showdown.Converter();

type SuggestedEntryLabels = {
  addUpdate: string;
  addNew: string;
  reviseSessionButton: string;
  reviseSessionTooltip: string;
  continueLabelIdle: string;
  continueLabelBusy: string;
  continueTooltip: string;
  reviseLabelIdle: string;
  reviseLabelBusy: string;
  reviseTooltip: string;
  editButton: string;
  compareButton: string;
  blacklistButton: string;
  removeButton: string;
  instructionsPlaceholder: string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const SUGGESTED_ENTRY_LABELS: Record<SupportedLanguage, SuggestedEntryLabels> = {
  en: {
    addUpdate: 'Update',
    addNew: 'Add',
    reviseSessionButton: 'Revise',
    reviseSessionTooltip: 'Revise this entry with a chat-based AI session.',
    continueLabelIdle: 'Continue',
    continueLabelBusy: '...',
    continueTooltip: 'Continue writing this entry. You can provide instructions in the textbox below.',
    reviseLabelIdle: 'Revise',
    reviseLabelBusy: '...',
    reviseTooltip: 'Request changes to this entry. Provide instructions in the textbox below.',
    editButton: 'Edit',
    compareButton: 'Compare',
    blacklistButton: 'Blacklist',
    removeButton: 'Remove',
    instructionsPlaceholder:
      "Optional instructions to continue or revise this entry. Then press 'Continue' or 'Revise'.",
  },
  'zh-CN': {
    addUpdate: '更新',
    addNew: '添加',
    reviseSessionButton: '对话修改',
    reviseSessionTooltip: '通过与 AI 对话会话来修改此条目。',
    continueLabelIdle: '续写',
    continueLabelBusy: '...',
    continueTooltip: '继续撰写此条目，可在下方输入续写说明。',
    reviseLabelIdle: '修改',
    reviseLabelBusy: '...',
    reviseTooltip: '根据下方说明请求修改此条目。',
    editButton: '手动编辑',
    compareButton: '对比',
    blacklistButton: '拉黑此建议',
    removeButton: '移除',
    instructionsPlaceholder: '在此填写续写或修改说明，然后点击“续写”或“修改”。',
  },
};

export interface SuggestedEntryProps {
  initialWorldName: string;
  entry: WIEntry;
  allWorldNames: string[];
  existingEntry?: WIEntry;
  sessionRegexIds: Record<string, Partial<RegexScriptData>>;
  entriesGroupByWorldName: Record<string, WIEntry[]>;
  sessionForContext: Session;
  contextToSend: ExtensionSettings['contextToSend'];
  onAdd: (entry: WIEntry, initialWorldName: string, selectedTargetWorld: string) => void;
  onRemove: (entry: WIEntry, initialWorldName: string, isBlacklist: boolean) => void;
  onContinue: (continueFrom: {
    worldName: string;
    entry: WIEntry;
    prompt: string;
    mode: 'continue' | 'revise';
  }) => void;
  onUpdate: (
    worldName: string,
    originalEntry: WIEntry,
    updatedEntry: WIEntry,
    updatedRegexIds: Record<string, Partial<RegexScriptData>>,
  ) => void;
}

export const SuggestedEntry: FC<SuggestedEntryProps> = ({
  initialWorldName,
  entry,
  allWorldNames,
  existingEntry,
  sessionRegexIds,
  onAdd,
  onRemove,
  onContinue,
  onUpdate,
  entriesGroupByWorldName,
  sessionForContext,
  contextToSend,
}) => {
  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = SUGGESTED_ENTRY_LABELS[language] ?? SUGGESTED_ENTRY_LABELS[DEFAULT_LANGUAGE];

  const [selectedWorld, setSelectedWorld] = useState(() => {
    const initial = allWorldNames.find((w) => w === initialWorldName);
    return initial ?? allWorldNames[0] ?? '';
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isReviseSessionManagerOpen, setIsReviseSessionManagerOpen] = useState(false);
  const [updatePrompt, setUpdatePrompt] = useState('');

  const editPopupRef = useRef<EditEntryPopupRef>(null);

  const isUpdate = useMemo(
    () => !!entriesGroupByWorldName[selectedWorld]?.find((e) => e.uid === entry.uid),
    [selectedWorld, entry.uid, entriesGroupByWorldName],
  );

  const isActing = isContinuing || isRevising;

  const handleAddClick = async () => {
    setIsAdding(true);
    await onAdd(entry, initialWorldName, selectedWorld);
    setIsAdding(false);
  };

  const handleContinueClick = async () => {
    setIsContinuing(true);
    await onContinue({ worldName: initialWorldName, entry, prompt: updatePrompt, mode: 'continue' });
    setIsContinuing(false);
  };

  const handleReviseClick = async () => {
    setIsRevising(true);
    await onContinue({ worldName: initialWorldName, entry, prompt: updatePrompt, mode: 'revise' });
    setIsRevising(false);
  };

  const handleApplyReviseSession = (args: any) => {
    // ReviseSessionManager passes an object wrapper for 'entry' type sessions
    // args: { worldName: string; originalEntry: WIEntry; updatedEntry: WIEntry }
    // We need to extract the actual updated entry from it.
    const updatedEntry = args.updatedEntry ? args.updatedEntry : args;
    onUpdate(initialWorldName, entry, updatedEntry as WIEntry, sessionRegexIds);
  };

  return (
    <>
      <div className="entry">
        <div className="menu">
          <select
            className="world-select text_pole"
            value={selectedWorld}
            onChange={(e) => setSelectedWorld(e.target.value)}
          >
            {allWorldNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <STButton onClick={handleAddClick} disabled={isAdding || isActing} className="menu_button interactable add">
            {isUpdate ? labels.addUpdate : labels.addNew}
          </STButton>
          <STButton
            onClick={() => setIsReviseSessionManagerOpen(true)}
            disabled={isActing}
            className="menu_button interactable"
            title={labels.reviseSessionTooltip}
          >
            <i className="fa-solid fa-comments"></i> {labels.reviseSessionButton}
          </STButton>
          <STButton
            onClick={handleContinueClick}
            disabled={isActing}
            className="menu_button interactable continue"
            title={labels.continueTooltip}
          >
            {isContinuing ? labels.continueLabelBusy : labels.continueLabelIdle}
          </STButton>
          <STButton
            onClick={handleReviseClick}
            disabled={isActing}
            className="menu_button interactable revise"
            title={labels.reviseTooltip}
          >
            {isRevising ? labels.reviseLabelBusy : labels.reviseLabelIdle}
          </STButton>
          <STButton onClick={() => setIsEditing(true)} disabled={isActing} className="menu_button interactable edit">
            {labels.editButton}
          </STButton>
          {isUpdate && (
            <STButton
              onClick={() => setIsComparing(true)}
              disabled={isActing}
              className="menu_button interactable compare"
            >
              {labels.compareButton}
            </STButton>
          )}
          <STButton
            onClick={() => onRemove(entry, initialWorldName, true)}
            disabled={isActing}
            className="menu_button interactable blacklist"
          >
            {labels.blacklistButton}
          </STButton>
          <STButton
            onClick={() => onRemove(entry, initialWorldName, false)}
            disabled={isActing}
            className="menu_button interactable remove"
          >
            {labels.removeButton}
          </STButton>
        </div>
        <h4 className="comment">{entry.comment}</h4>
        <div className="key">{(entry.key || []).join(', ')}</div>
        <p className="content" dangerouslySetInnerHTML={{ __html: converter.makeHtml(entry.content ?? '') }}></p>
        <div className="continue-prompt-section" style={{ marginTop: '10px' }}>
          <STTextarea
            value={updatePrompt}
            onChange={(e) => setUpdatePrompt(e.target.value)}
            placeholder={labels.instructionsPlaceholder}
            rows={2}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {isEditing && (
        <Popup
          type={POPUP_TYPE.CONFIRM}
          content={<EditEntryPopup ref={editPopupRef} entry={entry} initialRegexIds={sessionRegexIds} />}
          onComplete={(confirmed) => {
            if (confirmed && editPopupRef.current) {
              const { updatedEntry, updatedRegexIds } = editPopupRef.current.getFormData();
              onUpdate(initialWorldName, entry, updatedEntry, updatedRegexIds);
            }
            setIsEditing(false);
          }}
        />
      )}

      {isComparing && existingEntry && (
        <Popup
          type={POPUP_TYPE.DISPLAY}
          content={<CompareEntryPopup originalEntry={existingEntry} newEntry={entry} />}
          onComplete={() => setIsComparing(false)}
        />
      )}

      {isReviseSessionManagerOpen && (
        <Popup
          type={POPUP_TYPE.DISPLAY}
          content={
            <ReviseSessionManager
              target={{ type: 'entry', worldName: initialWorldName, entry: entry }}
              initialState={entry}
              onClose={() => setIsReviseSessionManagerOpen(false)}
              onApply={handleApplyReviseSession}
              sessionForContext={sessionForContext}
              allEntries={entriesGroupByWorldName}
              contextToSend={contextToSend}
            />
          }
          onComplete={() => setIsReviseSessionManagerOpen(false)}
          options={{ wide: true, large: true }}
        />
      )}
    </>
  );
};
