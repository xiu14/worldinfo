import { FC, useState, useEffect, useRef, useCallback } from 'react';
import {
  STButton,
  STTextarea,
  Popup,
  STConnectionProfileSelect,
  STInput,
} from 'sillytavern-utils-lib/components/react';
import {
  ReviseMessage,
  ReviseSession,
  ReviseState,
  EntryRevisionResponse,
  EntryRevisionResponseSchema,
  GlobalRevisionResponse,
  GlobalRevisionResponseSchema,
  REVISE_SCHEMA_NAME,
  CHAT_HISTORY_PLACEHOLDER_ID,
} from '../revise-types.js';
import { makeStructuredRequest } from '../request.js';
import { settingsManager, PromptEngineeringMode, SupportedLanguage } from '../settings.js';
import { st_echo, st_createWorldInfoEntry, selected_group, this_chid } from 'sillytavern-utils-lib/config';
import { CompareStatePopup } from './CompareStatePopup.js';
import { POPUP_TYPE } from 'sillytavern-utils-lib/types/popup';
import { CurrentStatePopup } from './CurrentStatePopup.js';
import { BuildPromptOptions, buildPrompt } from 'sillytavern-utils-lib';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { GlobalStatePopup } from './GlobalStatePopup.js';
import * as Handlebars from 'handlebars';

const globalContext = SillyTavern.getContext();

type ReviseChatLabels = {
  editStateTitle: string;
  saveChanges: string;
  cancel: string;
  fieldName: string;
  fieldTriggers: string;
  fieldContent: string;
  viewState: string;
  editState: string;
  backTooltip: string;
  applyTooltip: string;
  apply: string;
  viewInitialContext: string;
  saveAndFork: string;
  editContextTooltip: string;
  deleteContextTooltip: string;
  editAndForkTooltip: string;
  compareChangesTooltip: string;
  deleteMessageTooltip: string;
  regenerate: string;
  regenerateTooltip: string;
  cancelRequestTooltip: string;
  inputPlaceholder: string;
  editMessageTitle: string;
  editMessageConfirm: string;
  deleteMessageTitle: string;
  deleteInitialConfirm: string;
  deleteMessageConfirm: string;
  manualEditContent: string;
  messageHistoryUpdated: string;
  requestCancelled: string;
  requestFailed: (msg: string) => string;
  noApiSelected: string;
  profileNoApi: string;
  usingFallbackApi: (key: string, name: string) => string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const REVISE_CHAT_LABELS: Record<SupportedLanguage, ReviseChatLabels> = {
  en: {
    editStateTitle: 'Editing Entry State',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    fieldName: 'Name',
    fieldTriggers: 'Triggers (comma-separated)',
    fieldContent: 'Content',
    viewState: 'View State',
    editState: 'Edit State',
    backTooltip: 'Back to sessions',
    applyTooltip: 'Apply Changes and Close',
    apply: 'Apply',
    viewInitialContext: 'View Initial Context',
    saveAndFork: 'Save & Fork',
    editContextTooltip: 'Edit Context',
    deleteContextTooltip: 'Delete Context',
    editAndForkTooltip: 'Edit and Fork',
    compareChangesTooltip: 'Compare changes',
    deleteMessageTooltip: 'Delete Message',
    regenerate: 'Regenerate',
    regenerateTooltip: 'Regenerate response',
    cancelRequestTooltip: 'Cancel Request',
    inputPlaceholder: 'Type your revision instructions...',
    editMessageTitle: 'Edit Message',
    editMessageConfirm:
      'This will fork the conversation from this point, removing all subsequent messages. Continue?',
    deleteMessageTitle: 'Delete Message',
    deleteInitialConfirm: 'Deleting part of the initial context will clear the entire chat history. Are you sure?',
    deleteMessageConfirm: 'This will delete this message and all subsequent messages. Are you sure?',
    manualEditContent: 'I made a change manually.',
    messageHistoryUpdated: 'Message history has been updated.',
    requestCancelled: 'Request was cancelled.',
    requestFailed: (msg: string) => `Request failed: ${msg}`,
    noApiSelected: 'No API selected for this session. Please configure Connection Manager.',
    profileNoApi: 'Profile has no API configured, using ST default.',
    usingFallbackApi: (key: string, name: string) => `Using fallback API: ${key} -> ${name}`,
  },
  'zh-CN': {
    editStateTitle: '编辑条目状态',
    saveChanges: '保存更改',
    cancel: '取消',
    fieldName: '名称',
    fieldTriggers: '触发词（以逗号分隔）',
    fieldContent: '内容',
    viewState: '查看状态',
    editState: '编辑状态',
    backTooltip: '返回会话列表',
    applyTooltip: '应用更改并关闭',
    apply: '应用',
    viewInitialContext: '查看初始上下文',
    saveAndFork: '保存并分叉',
    editContextTooltip: '编辑上下文',
    deleteContextTooltip: '删除上下文',
    editAndForkTooltip: '编辑并分叉',
    compareChangesTooltip: '对比更改',
    deleteMessageTooltip: '删除消息',
    regenerate: '重新生成',
    regenerateTooltip: '重新生成回复',
    cancelRequestTooltip: '取消请求',
    inputPlaceholder: '输入修改指令...',
    editMessageTitle: '编辑消息',
    editMessageConfirm: '这将从此点分叉对话，移除所有后续消息。是否继续？',
    deleteMessageTitle: '删除消息',
    deleteInitialConfirm: '删除初始上下文的一部分将清空整个聊天记录。确定吗？',
    deleteMessageConfirm: '这将删除此消息及所有后续消息。确定吗？',
    manualEditContent: '我手动进行了修改。',
    messageHistoryUpdated: '消息记录已更新。',
    requestCancelled: '请求已取消。',
    requestFailed: (msg: string) => `请求失败：${msg}`,
    noApiSelected: '此会话未选择 API。请配置连接管理器。',
    profileNoApi: '配置文件未配置 API，使用 ST 默认设置。',
    usingFallbackApi: (key: string, name: string) => `使用备用 API：${key} -> ${name}`,
  },
};

const calculateNewState = (prevState: WIEntry, response: EntryRevisionResponse): WIEntry => {
  const newState = structuredClone(prevState);
  newState.comment = response.name;
  newState.key = response.triggers;
  newState.content = response.content;
  return newState;
};

const calculateNewGlobalState = (
  prevState: Record<string, WIEntry[]>,
  response: GlobalRevisionResponse,
): Record<string, WIEntry[]> => {
  const newState = structuredClone(prevState);

  // Process removals
  if (response.remove) {
    for (const op of response.remove) {
      const { worldName, name } = op;
      if (newState[worldName]) {
        newState[worldName] = newState[worldName].filter((e) => e.comment !== name);
      }
    }
  }

  // Process changes
  if (response.change) {
    for (const op of response.change) {
      const { worldName, originalName } = op;
      const entryToChange = newState[worldName]?.find((e) => e.comment === originalName);
      if (entryToChange) {
        if (op.newName !== undefined) entryToChange.comment = op.newName;
        if (op.triggers !== undefined) entryToChange.key = op.triggers;
        if (op.content !== undefined) entryToChange.content = op.content;
      } else {
        console.warn(`[WREC] Could not find entry to change: "${originalName}" in world "${worldName}"`);
        st_echo('warning', `Could not find entry to change: "${originalName}" in world "${worldName}"`);
      }
    }
  }

  // Process additions
  if (response.add) {
    for (const op of response.add) {
      const { worldName, name, triggers, content } = op;
      if (!newState[worldName]) {
        newState[worldName] = [];
      }
      const stFormat = { entries: Object.fromEntries(newState[worldName].map((e) => [e.uid, e])) };
      const newEntry = st_createWorldInfoEntry(worldName, stFormat);
      if (newEntry) {
        newEntry.comment = name;
        newEntry.key = triggers;
        newEntry.content = content;
        newState[worldName].push(newEntry);
      }
    }
  }

  return newState;
};

// A local component for manually editing the state of a single WIEntry.
// Kept here to avoid creating a new file for a component only used in this context.
const EditStatePopup: FC<{
  initialState: WIEntry;
  onSave: (newState: WIEntry) => void;
  onClose: () => void;
}> = ({ initialState, onSave, onClose }) => {
  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = REVISE_CHAT_LABELS[language] ?? REVISE_CHAT_LABELS[DEFAULT_LANGUAGE];

  const [name, setName] = useState(initialState.comment);
  const [triggers, setTriggers] = useState(initialState.key.join(', '));
  const [content, setContent] = useState(initialState.content);

  const handleSave = () => {
    const newState: WIEntry = {
      ...structuredClone(initialState),
      comment: name,
      key: triggers
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      content: content,
    };
    onSave(newState);
  };

  return (
    <div className="current-state-popup">
      <div className="popup_header">
        <h3>{labels.editStateTitle}</h3>
        <div className="popup_header_buttons">
          <STButton onClick={handleSave}>
            <i className="fa-solid fa-check"></i> {labels.saveChanges}
          </STButton>
          <STButton onClick={onClose} className="danger_button">
            <i className="fa-solid fa-times"></i> {labels.cancel}
          </STButton>
        </div>
      </div>
      <div className="current-state-content">
        <div className="state-field">
          <label>{labels.fieldName}</label>
          <STInput type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </div>
        <div className="state-field">
          <label>{labels.fieldTriggers}</label>
          <STTextarea value={triggers} onChange={(e) => setTriggers(e.target.value)} rows={2} />
        </div>
        <div className="state-field">
          <label>{labels.fieldContent}</label>
          <STTextarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
        </div>
      </div>
    </div>
  );
};

interface ReviseSessionChatProps {
  session: ReviseSession;
  onBack: () => void;
  onApply: (newState: ReviseState) => void;
  onSessionUpdate: (updatedSession: ReviseSession) => void;
  initialState: ReviseState;
  chatContextOptions: BuildPromptOptions;
}

export const ReviseSessionChat: FC<ReviseSessionChatProps> = ({
  session,
  onBack,
  onApply,
  onSessionUpdate,
  initialState,
  chatContextOptions,
}) => {
  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = REVISE_CHAT_LABELS[language] ?? REVISE_CHAT_LABELS[DEFAULT_LANGUAGE];

  const [messages, setMessages] = useState<ReviseMessage[]>(session.messages);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [diffData, setDiffData] = useState<{ before: ReviseState; after: ReviseState } | null>(null);
  const [isCurrentStateOpen, setIsCurrentStateOpen] = useState(false);
  const [isEditingState, setIsEditingState] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createAndAddStateUpdateMessage = useCallback(
    (currentMessages: ReviseMessage[], newState: ReviseState, lastState: ReviseState): ReviseMessage[] => {
      if (JSON.stringify(lastState) === JSON.stringify(newState)) {
        return currentMessages;
      }

      const settings = settingsManager.getSettings();
      let content = '';

      if (session.type === 'global') {
        const wrapperTemplate = settings.prompts.reviseGlobalStateUpdate?.content;
        const addedModifiedTemplate = settings.prompts.reviseGlobalStateUpdateAddedModified?.content;
        const removedTemplate = settings.prompts.reviseGlobalStateUpdateRemoved?.content;
        if (!wrapperTemplate || !addedModifiedTemplate || !removedTemplate) return currentMessages;

        const oldState = (lastState as Record<string, WIEntry[]>) || {};
        const newStateData = (newState as Record<string, WIEntry[]>) || {};

        const oldEntriesMap = new Map<string, WIEntry>();
        Object.entries(oldState).forEach(([worldName, entries]) => {
          entries.forEach((entry) => {
            oldEntriesMap.set(`${worldName}::${entry.uid}`, entry);
          });
        });

        const newEntriesMap = new Map<string, WIEntry>();
        Object.entries(newStateData).forEach(([worldName, entries]) => {
          entries.forEach((entry) => {
            newEntriesMap.set(`${worldName}::${entry.uid}`, entry);
          });
        });

        const changedLorebooks: Record<string, WIEntry[]> = {}; // For added/modified
        const removedEntries: { worldName: string; comment: string }[] = [];

        // Find added and modified entries
        newEntriesMap.forEach((newEntry, key) => {
          const [worldName] = key.split('::');
          const oldEntry = oldEntriesMap.get(key);

          let isChanged = false;
          if (!oldEntry) {
            isChanged = true; // Added
          } else {
            const contentChanged = (newEntry.content || '') !== (oldEntry.content || '');
            const commentChanged = (newEntry.comment || '') !== (oldEntry.comment || '');
            const keysChanged = (newEntry.key || []).sort().join(',') !== (oldEntry.key || []).sort().join(',');
            if (contentChanged || commentChanged || keysChanged) {
              isChanged = true; // Modified
            }
          }

          if (isChanged) {
            if (!changedLorebooks[worldName]) changedLorebooks[worldName] = [];
            changedLorebooks[worldName].push(newEntry);
          }
        });

        // Find removed entries
        oldEntriesMap.forEach((oldEntry, key) => {
          if (!newEntriesMap.has(key)) {
            const [worldName] = key.split('::');
            removedEntries.push({ worldName, comment: oldEntry.comment });
          }
        });

        if (Object.keys(changedLorebooks).length === 0 && removedEntries.length === 0) {
          return currentMessages; // No actual changes found
        }

        const addedModifiedContent = Handlebars.compile(addedModifiedTemplate, { noEscape: true })({
          changedLorebooks,
        });
        const removedContent = Handlebars.compile(removedTemplate, { noEscape: true })({ removedEntries });

        content = Handlebars.compile(wrapperTemplate, { noEscape: true })({
          addedModifiedContent,
          removedContent,
        });
      } else {
        // 'entry' type
        const entry = newState as WIEntry;
        content = `The following is the current state of the single lorebook entry you are editing. Base your response on this current state.\n\n## WORLD NAME: ${session.worldName}\n### (NAME: ${entry.comment})\nTriggers: ${(entry.key || []).join(', ')}\nContent: ${entry.content}`;
      }

      content = globalContext.substituteParams(content.trim());

      if (content) {
        const stateUpdateMessage: ReviseMessage = {
          id: `msg-${Date.now()}-state`,
          role: 'system',
          content: content,
          isStateUpdate: true,
        };
        return [...currentMessages, stateUpdateMessage];
      }

      return currentMessages;
    },
    [session.type, session.worldName],
  );

  const sendRequest = useCallback(
    async (
      messagesToSend: ReviseMessage[],
      isRegeneration: boolean,
      optimisticUpdate: () => void,
      revertUpdate: () => void,
    ) => {
      const settings = settingsManager.getSettings();
      if (!session.profileId) {
        st_echo('warning', labels.noApiSelected);
        return;
      }
      abortControllerRef.current = new AbortController();

      optimisticUpdate();
      setIsLoading(true);

      try {
        const finalMessagesForRequest: ReviseMessage[] = [];
        const profile = globalContext.extensionSettings.connectionManager?.profiles?.find(
          (p: any) => p.id === session.profileId,
        );
        // Try to get API from profile, fall back to current ST API if not set
        let selectedApi: string | undefined;

        if (profile?.api && globalContext.CONNECT_API_MAP[profile.api]) {
          selectedApi = globalContext.CONNECT_API_MAP[profile.api].selected;
        } else {
          // Fallback: use SillyTavern's currently active API
          console.warn(`[WorldInfoRecommender] ${labels.profileNoApi}`);

          // Try to find the active API by checking which one is currently selected
          for (const [apiKey, apiValue] of Object.entries(globalContext.CONNECT_API_MAP)) {
            if (apiValue && apiValue.selected) {
              selectedApi = apiValue.selected;
              console.log(`[WorldInfoRecommender] ${labels.usingFallbackApi(apiKey, selectedApi)}`);
              break;
            }
          }
        }

        if (!selectedApi) {
          st_echo('warning', labels.noApiSelected);
          return;
        }

        for (const message of messagesToSend) {
          if (message.id === CHAT_HISTORY_PLACEHOLDER_ID) {
            if (this_chid === undefined && !selected_group) continue;
            const prompt = await buildPrompt(selectedApi, chatContextOptions);
            if (prompt.warnings?.length) prompt.warnings.forEach((w) => st_echo('warning', w));
            finalMessagesForRequest.push(...(prompt.result as ReviseMessage[]));
          } else {
            finalMessagesForRequest.push(message);
          }
        }

        const lastState =
          messagesToSend
            .slice(0, messagesToSend.length - (isRegeneration ? 0 : 1))
            .reverse()
            .find((m) => m.stateSnapshot)?.stateSnapshot ?? initialState;

        let stateContent = '';
        if (session.type === 'global') {
          const template = settings.prompts.currentLorebooks?.content;
          if (template) {
            const templateData = { currentLorebooks: lastState };
            stateContent = Handlebars.compile(template, { noEscape: true })(templateData);
          }
        } else {
          // 'entry'
          const entry = lastState as WIEntry;
          stateContent = `The following is the current state of the single lorebook entry you are editing. Base your response on this current state.\n\n## WORLD NAME: ${session.worldName}\n### (NAME: ${entry.comment})\nTriggers: ${(entry.key || []).join(', ')}\nContent: ${entry.content}`;
        }

        stateContent = globalContext.substituteParams(stateContent.trim());

        if (stateContent) {
          const stateMessage: ReviseMessage = {
            id: `temp-state-${Date.now()}`,
            role: 'system',
            content: stateContent,
          };

          const lastMessage = finalMessagesForRequest.pop();
          finalMessagesForRequest.push(stateMessage);
          if (lastMessage) {
            finalMessagesForRequest.push(lastMessage);
          }
        }

        let newSnapshot: ReviseState;
        let justification: string;

        if (session.type === 'entry') {
          const response = await makeStructuredRequest(
            session.profileId,
            finalMessagesForRequest,
            EntryRevisionResponseSchema,
            REVISE_SCHEMA_NAME.ENTRY,
            session.promptEngineeringMode,
            settings.maxResponseToken,
            abortControllerRef.current.signal,
          );
          newSnapshot = calculateNewState(lastState as WIEntry, response);
          justification = response.justification;
        } else {
          // 'global'
          const response = await makeStructuredRequest(
            session.profileId,
            finalMessagesForRequest,
            GlobalRevisionResponseSchema,
            REVISE_SCHEMA_NAME.GLOBAL,
            session.promptEngineeringMode,
            settings.maxResponseToken,
            abortControllerRef.current.signal,
          );
          newSnapshot = calculateNewGlobalState(lastState as Record<string, WIEntry[]>, response);
          justification = response.justification;
        }

        const assistantMessage: ReviseMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: justification,
          stateSnapshot: newSnapshot,
        };

        let finalMessages = [...messagesToSend, assistantMessage];
        finalMessages = createAndAddStateUpdateMessage(finalMessages, newSnapshot, lastState);

        setMessages(finalMessages);
        onSessionUpdate({ ...session, messages: finalMessages });
      } catch (error: any) {
        if (error.name === 'AbortError') {
          st_echo('info', labels.requestCancelled);
        } else {
          console.error('Revise request failed:', error);
          st_echo('error', labels.requestFailed(error.message));
        }
        revertUpdate();
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [session, onSessionUpdate, initialState, chatContextOptions, createAndAddStateUpdateMessage],
  );

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isLoading) return;
    const userMessage: ReviseMessage = { id: `msg-${Date.now()}`, role: 'user', content: userInput.trim() };
    const previousMessages = messages;

    await sendRequest(
      [...messages, userMessage],
      false,
      () => {
        setMessages([...messages, userMessage]);
        setUserInput('');
      },
      () => setMessages(previousMessages),
    );
  }, [userInput, isLoading, messages, sendRequest]);

  const handleRegenerate = useCallback(async () => {
    if (isLoading || messages.length === 0) return;

    const previousMessages = messages;
    let messagesForRequest = [...messages];

    // Find the last message that is visible to the user.
    const lastVisibleMessageIndex = messages.findLastIndex((m) => !m.isStateUpdate);

    if (lastVisibleMessageIndex > -1) {
      const lastVisibleMessage = messages[lastVisibleMessageIndex];

      // If the last visible message is from the assistant, we are regenerating it.
      // We need to remove it and any hidden state updates that came after it.
      if (lastVisibleMessage.role === 'assistant') {
        messagesForRequest = messages.slice(0, lastVisibleMessageIndex);
      }
    }
    await sendRequest(
      messagesForRequest,
      true,
      () => setMessages(messagesForRequest),
      () => setMessages(previousMessages),
    );
  }, [isLoading, messages, sendRequest]);

  const handleApply = () => {
    const lastState =
      messages
        .slice()
        .reverse()
        .find((m) => m.stateSnapshot)?.stateSnapshot ?? initialState;
    onApply(lastState);
    onBack();
  };

  const handleShowDiff = (messageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    if (msgIndex < 0 || !messages[msgIndex].stateSnapshot) return;

    const after = messages[msgIndex].stateSnapshot!;
    let before = initialState;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].stateSnapshot) {
        before = messages[i].stateSnapshot!;
        break;
      }
    }
    setDiffData({ before, after });
  };

  const handleStartEdit = (msg: ReviseMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId) return;

    const messageIndex = messages.findIndex((m) => m.id === editingMessageId);
    if (messageIndex === -1) return;

    const confirm = await globalContext.Popup.show.confirm(labels.editMessageTitle, labels.editMessageConfirm);
    if (!confirm) return;

    const previousMessages = messages;
    const truncatedMessages = messages.slice(0, messageIndex);
    const editedMessage = { ...messages[messageIndex], content: editingContent };
    const messagesForRequest = [...truncatedMessages, editedMessage];

    handleCancelEdit();

    await sendRequest(
      messagesForRequest,
      false,
      () => setMessages(messagesForRequest),
      () => setMessages(previousMessages),
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const isInitial = !!messages[messageIndex].isInitial;

    const confirm = await globalContext.Popup.show.confirm(
      labels.deleteMessageTitle,
      isInitial ? labels.deleteInitialConfirm : labels.deleteMessageConfirm,
    );
    if (!confirm) return;

    const newMessages = isInitial
      ? messages.filter((m) => m.isInitial && m.id !== messageId)
      : messages.slice(0, messageIndex);

    setMessages(newMessages);
    onSessionUpdate({ ...session, messages: newMessages });
    st_echo('info', labels.messageHistoryUpdated);
  };

  const handleSaveStateEdit = (newState: ReviseState) => {
    const lastState =
      messages
        .slice()
        .reverse()
        .find((m) => m.stateSnapshot)?.stateSnapshot ?? initialState;

    const userEditMessage: ReviseMessage = {
      id: `msg-${Date.now()}-user-edit`,
      role: 'user',
      content: labels.manualEditContent,
      stateSnapshot: newState,
    };

    let finalMessages = [...messages, userEditMessage];
    finalMessages = createAndAddStateUpdateMessage(finalMessages, newState, lastState);

    setMessages(finalMessages);
    onSessionUpdate({ ...session, messages: finalMessages });
    setIsEditingState(false);
  };

  const currentState =
    messages
      .slice()
      .reverse()
      .find((m) => m.stateSnapshot)?.stateSnapshot ?? initialState;

  const visibleMessages = messages.filter((m) => !m.isStateUpdate);
  const initialMsgs = visibleMessages.filter((m) => m.isInitial);
  const chatMsgs = visibleMessages.filter((m) => !m.isInitial);

  return (
    <div className="revise-session-chat">
      <div className="popup_header">
        <h2>{session.name}</h2>
        <div className="popup_header_buttons">
          <STConnectionProfileSelect
            initialSelectedProfileId={session.profileId}
            onChange={(p) => onSessionUpdate({ ...session, profileId: p?.id ?? '' })}
          />
          <select
            className="text_pole"
            value={session.promptEngineeringMode}
            onChange={(e) =>
              onSessionUpdate({ ...session, promptEngineeringMode: e.target.value as PromptEngineeringMode })
            }
            title="Prompt Engineering Mode"
          >
            <option value="native">Native</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
          <STButton onClick={() => setIsCurrentStateOpen(true)} title={labels.viewState}>
            {labels.viewState}
          </STButton>
          {session.type === 'entry' && (
            <STButton onClick={() => setIsEditingState(true)} title={labels.editState}>
              {labels.editState}
            </STButton>
          )}
          <STButton onClick={onBack} title={labels.backTooltip}>
            <i className="fa-solid fa-arrow-left"></i>
          </STButton>
          <STButton onClick={handleApply} title={labels.applyTooltip}>
            <i className="fa-solid fa-check"></i> {labels.apply}
          </STButton>
        </div>
      </div>
      <div className="chat-messages">
        {initialMsgs.length > 0 && (
          <details className="initial-messages-container">
            <summary>{labels.viewInitialContext}</summary>
            <div className="initial-messages-content">
              {initialMsgs.map((msg) =>
                editingMessageId === msg.id ? (
                  <div key={msg.id} className="message-editor">
                    <STTextarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={5} />
                    <div className="editor-buttons">
                      <STButton onClick={handleSaveEdit}>
                        <i className="fa-solid fa-check"></i> {labels.saveAndFork}
                      </STButton>
                      <STButton onClick={handleCancelEdit}>
                        <i className="fa-solid fa-times"></i> {labels.cancel}
                      </STButton>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className={`message-bubble-wrapper initial-context ${msg.role}`}>
                    <div className={`message-bubble ${msg.role} initial`}>
                      <div className="message-content">{msg.content}</div>
                    </div>
                    {!isLoading && msg.id !== CHAT_HISTORY_PLACEHOLDER_ID && (
                      <div className="message-actions">
                        <STButton
                          className="message-action-button"
                          onClick={() => handleStartEdit(msg)}
                          title={labels.editContextTooltip}
                        >
                          <i className="fa-solid fa-pencil"></i>
                        </STButton>
                        <STButton
                          className="message-action-button danger_button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title={labels.deleteContextTooltip}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </STButton>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </details>
        )}
        {chatMsgs.map((msg) =>
          editingMessageId === msg.id ? (
            <div key={msg.id} className="message-editor">
              <STTextarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={3} />
              <div className="editor-buttons">
                <STButton onClick={handleSaveEdit}>
                  <i className="fa-solid fa-check"></i> {labels.saveAndFork}
                </STButton>
                <STButton onClick={handleCancelEdit}>
                  <i className="fa-solid fa-times"></i> {labels.cancel}
                </STButton>
              </div>
            </div>
          ) : (
            <div key={msg.id} className={`message-bubble-wrapper ${msg.role}`}>
              <div className="message-actions">
                {msg.role === 'user' && !msg.stateSnapshot && !isLoading && (
                  <STButton
                    className="message-action-button"
                    onClick={() => handleStartEdit(msg)}
                    title={labels.editAndForkTooltip}
                  >
                    <i className="fa-solid fa-pencil"></i>
                  </STButton>
                )}
                {msg.stateSnapshot && !isLoading && (
                  <STButton
                    className="message-action-button"
                    onClick={() => handleShowDiff(msg.id)}
                    title={labels.compareChangesTooltip}
                  >
                    <i className="fa-solid fa-code-compare"></i>
                  </STButton>
                )}
                {!isLoading && (
                  <STButton
                    className="message-action-button danger_button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    title={labels.deleteMessageTooltip}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </STButton>
                )}
              </div>
              <div className={`message-bubble ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            </div>
          ),
        )}
        {chatMsgs.length > 0 && !isLoading && (
          <div className="regenerate-button-wrapper">
            <STButton onClick={handleRegenerate} title={labels.regenerateTooltip}>
              <i className="fa-solid fa-rotate-right"></i> {labels.regenerate}
            </STButton>
          </div>
        )}
        {isLoading && (
          <div className="message-bubble-wrapper assistant">
            <div className="message-bubble assistant loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
            <STButton
              onClick={() => abortControllerRef.current?.abort()}
              className="danger_button"
              title={labels.cancelRequestTooltip}
            >
              <i className="fa-solid fa-stop"></i>
            </STButton>
          </div>
        )}
        <div ref={chatEndRef}></div>
      </div>
      <div className="chat-input-area">
        <STTextarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={labels.inputPlaceholder}
          rows={3}
          disabled={isLoading || !!editingMessageId}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <STButton onClick={handleSendMessage} disabled={isLoading || !userInput.trim() || !!editingMessageId}>
          <i className="fa-solid fa-paper-plane"></i>
        </STButton>
      </div>

      {diffData && (
        <Popup
          type={POPUP_TYPE.DISPLAY}
          content={<CompareStatePopup sessionType={session.type} before={diffData.before} after={diffData.after} />}
          onComplete={() => setDiffData(null)}
          options={{ wide: true, large: true }}
        />
      )}
      {isCurrentStateOpen && (
        <Popup
          type={POPUP_TYPE.DISPLAY}
          content={
            session.type === 'entry' ? (
              <CurrentStatePopup currentState={currentState as WIEntry} initialState={initialState as WIEntry} />
            ) : (
              <GlobalStatePopup
                currentState={currentState as Record<string, WIEntry[]>}
                initialState={initialState as Record<string, WIEntry[]>}
              />
            )
          }
          onComplete={() => setIsCurrentStateOpen(false)}
          options={{ wide: true, large: true }}
        />
      )}
      {isEditingState && session.type === 'entry' && (
        <Popup
          type={POPUP_TYPE.DISPLAY}
          content={
            <EditStatePopup
              initialState={currentState as WIEntry}
              onSave={(newState) => {
                handleSaveStateEdit(newState);
                setIsEditingState(false);
              }}
              onClose={() => setIsEditingState(false)}
            />
          }
          onComplete={() => setIsEditingState(false)}
          options={{ wide: true, large: true }}
        />
      )}
    </div>
  );
};
