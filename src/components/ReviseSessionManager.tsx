import { FC, useState, useEffect, useMemo } from 'react';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { ReviseSession, ReviseState } from '../revise-types.js';
import { STButton } from 'sillytavern-utils-lib/components/react';
import { ReviseSessionChat } from './ReviseSessionChat.js';
import { ExtensionSettings, SupportedLanguage, settingsManager } from '../settings.js';
import { buildInitialReviseMessages } from '../revise-prompt-builder.js';
import { st_echo, selected_group, this_chid } from 'sillytavern-utils-lib/config';
import { BuildPromptOptions } from 'sillytavern-utils-lib';
import { Session } from '../generate.js';

const globalContext = SillyTavern.getContext();
const REVISE_SESSIONS_KEY = 'worldInfoRecommender_reviseSessions';

type ReviseManagerLabels = {
  titleEntry: (name: string) => string;
  titleGlobal: string;
  loading: string;
  noSessions: string;
  newSessionButton: string;
  newSessionPopupTitle: string;
  newSessionDefaultNameEntry: (name: string, date: string) => string;
  newSessionDefaultNameGlobal: (date: string) => string;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  needProfileWarning: string;
  createError: (msg: string) => string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const REVISE_MANAGER_LABELS: Record<SupportedLanguage, ReviseManagerLabels> = {
  en: {
    titleEntry: (name: string) => `Revise Sessions for "${name}"`,
    titleGlobal: 'Global Revise Sessions',
    loading: 'Loading sessions...',
    noSessions: 'No sessions found. Create one to get started.',
    newSessionButton: 'New Session',
    newSessionPopupTitle: 'New Session Name',
    newSessionDefaultNameEntry: (name: string, date: string) => `Revise "${name}" - ${date}`,
    newSessionDefaultNameGlobal: (date: string) => `Global Revise - ${date}`,
    deleteConfirmTitle: 'Delete Session',
    deleteConfirmMessage: 'Are you sure? This cannot be undone.',
    needProfileWarning: 'Please select a connection profile in the main popup first.',
    createError: (msg: string) => `Failed to create session: ${msg}`,
  },
  'zh-CN': {
    titleEntry: (name: string) => `"${name}" 的修改会话`,
    titleGlobal: '全局修改会话',
    loading: '正在加载会话...',
    noSessions: '未找到会话。请创建一个新会话以开始。',
    newSessionButton: '新建会话',
    newSessionPopupTitle: '新会话名称',
    newSessionDefaultNameEntry: (name: string, date: string) => `修改 "${name}" - ${date}`,
    newSessionDefaultNameGlobal: (date: string) => `全局修改 - ${date}`,
    deleteConfirmTitle: '删除会话',
    deleteConfirmMessage: '确定要删除吗？此操作无法撤销。',
    needProfileWarning: '请先在主弹窗中选择一个连接配置。',
    createError: (msg: string) => `创建会话失败：${msg}`,
  },
};

interface ReviseSessionManagerProps {
  target: { type: 'global' } | { type: 'entry'; worldName: string; entry: WIEntry };
  initialState: ReviseState;
  onClose: () => void;
  onApply:
    | ((newState: Record<string, WIEntry[]>) => void)
    | ((args: { worldName: string; originalEntry: WIEntry; updatedEntry: WIEntry }) => void);
  sessionForContext: Session;
  allEntries: Record<string, WIEntry[]>;
  contextToSend: ExtensionSettings['contextToSend'];
}

export const ReviseSessionManager: FC<ReviseSessionManagerProps> = ({
  target,
  initialState,
  onClose,
  onApply,
  sessionForContext,
  allEntries,
  contextToSend,
}) => {
  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = REVISE_MANAGER_LABELS[language] ?? REVISE_MANAGER_LABELS[DEFAULT_LANGUAGE];

  const [allSessions, setAllSessions] = useState<ReviseSession[]>([]);
  const [activeSession, setActiveSession] = useState<ReviseSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const targetIdentifier = useMemo(() => {
    if (target.type === 'entry') {
      return `${target.worldName}::${target.entry.uid}::${target.entry.comment}`;
    }
    return 'global';
  }, [target]);

  useEffect(() => {
    const sessionsFromStorage: ReviseSession[] = JSON.parse(localStorage.getItem(REVISE_SESSIONS_KEY) || '[]');
    setAllSessions(sessionsFromStorage);
    setIsLoading(false);
  }, []);

  const filteredSessions = useMemo(() => {
    if (target.type === 'entry') {
      return allSessions
        .filter((s) => s.type === 'entry' && s.targetEntryIdentifier === targetIdentifier)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return allSessions
      .filter((s) => s.type === 'global')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allSessions, target.type, targetIdentifier]);

  const saveAllSessions = (updatedSessions: ReviseSession[]) => {
    localStorage.setItem(REVISE_SESSIONS_KEY, JSON.stringify(updatedSessions));
    setAllSessions(updatedSessions);
  };

  const handleCreateNewSession = async () => {
    const dateStr = new Date().toLocaleDateString();
    const defaultName =
      target.type === 'entry'
        ? labels.newSessionDefaultNameEntry(target.entry.comment, dateStr)
        : labels.newSessionDefaultNameGlobal(dateStr);

    const name = await globalContext.Popup.show.input(labels.newSessionPopupTitle, defaultName);
    if (!name) return;

    try {
      const currentSettings = settingsManager.getSettings();
      if (!currentSettings.profileId) {
        st_echo('warning', labels.needProfileWarning);
        return;
      }

      const initialMsgs = await buildInitialReviseMessages(
        initialState,
        target.type,
        target.type === 'entry' ? target.worldName : undefined,
        currentSettings.mainContextTemplatePreset,
        contextToSend,
        sessionForContext,
        allEntries,
      );

      const newSession: ReviseSession = {
        id: `rs-${Date.now()}`,
        name,
        type: target.type,
        targetEntryIdentifier: target.type === 'entry' ? targetIdentifier : undefined,
        worldName: target.type === 'entry' ? target.worldName : undefined,
        createdAt: new Date().toISOString(),
        messages: initialMsgs,
        context: { mainContextTemplatePreset: currentSettings.mainContextTemplatePreset },
        profileId: currentSettings.profileId,
        promptEngineeringMode: currentSettings.defaultPromptEngineeringMode,
      };

      setActiveSession(newSession);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to create session:', error);
      st_echo('error', labels.createError(message));
    }
  };

  const handleSelectSession = (session: ReviseSession) => {
    setActiveSession(session);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirm = await globalContext.Popup.show.confirm(labels.deleteConfirmTitle, labels.deleteConfirmMessage);
    if (confirm) {
      const updatedSessions = allSessions.filter((s) => s.id !== sessionId);
      saveAllSessions(updatedSessions);
    }
  };

  const handleSessionUpdate = (updatedSession: ReviseSession) => {
    const index = allSessions.findIndex((s) => s.id === updatedSession.id);
    const newAllSessions = [...allSessions];
    if (index !== -1) {
      newAllSessions[index] = updatedSession;
    } else {
      newAllSessions.push(updatedSession);
    }
    saveAllSessions(newAllSessions);
    setActiveSession(updatedSession);
  };

  const handleApplyAndClose = (newState: ReviseState) => {
    if (target.type === 'entry') {
      (onApply as (args: { worldName: string; originalEntry: WIEntry; updatedEntry: WIEntry }) => void)({
        worldName: target.worldName,
        originalEntry: initialState as WIEntry,
        updatedEntry: newState as WIEntry,
      });
    } else {
      (onApply as (newState: Record<string, WIEntry[]>) => void)(newState as Record<string, WIEntry[]>);
    }
    onClose();
  };

  if (activeSession) {
    const profile = globalContext.extensionSettings.connectionManager?.profiles?.find(
      (p) => p.id === activeSession.profileId,
    );
    const msgContext = contextToSend.messages;
    const chatContextOptions: BuildPromptOptions = {
      targetCharacterId: this_chid,
      ignoreCharacterFields: !contextToSend.charCard,
      ignoreWorldInfo: true,
      ignoreAuthorNote: !contextToSend.authorNote,
      includeNames: !!selected_group,
      presetName: profile?.preset,
      contextName: profile?.context,
      instructName: profile?.instruct,
    };

    if (!this_chid && !selected_group) {
      chatContextOptions.messageIndexesBetween = { start: -1, end: -1 };
    } else {
      switch (msgContext.type) {
        case 'none':
          chatContextOptions.messageIndexesBetween = { start: -1, end: -1 };
          break;
        case 'first':
          chatContextOptions.messageIndexesBetween = { start: 0, end: msgContext.first ?? 10 };
          break;
        case 'last': {
          const chatLength = globalContext.chat?.length ?? 0;
          const lastCount = msgContext.last ?? 10;
          chatContextOptions.messageIndexesBetween = {
            end: Math.max(0, chatLength - 1),
            start: Math.max(0, chatLength - lastCount),
          };
          break;
        }
        case 'range':
          if (msgContext.range) {
            chatContextOptions.messageIndexesBetween = {
              start: msgContext.range.start,
              end: msgContext.range.end,
            };
          }
          break;
        case 'all':
        default:
          break;
      }
    }

    return (
      <ReviseSessionChat
        session={activeSession}
        onBack={() => setActiveSession(null)}
        onApply={handleApplyAndClose}
        onSessionUpdate={handleSessionUpdate}
        initialState={initialState}
        chatContextOptions={chatContextOptions}
      />
    );
  }

  const title = target.type === 'entry' ? labels.titleEntry(target.entry.comment) : labels.titleGlobal;

  return (
    <div className="revise-session-manager">
      <div className="popup_header">
        <h2>{title}</h2>
      </div>
      <div className="session-list">
        {isLoading ? (
          <p className="subtle" style={{ textAlign: 'center' }}>
            {labels.loading}
          </p>
        ) : filteredSessions.length === 0 ? (
          <p className="subtle" style={{ textAlign: 'center' }}>
            {labels.noSessions}
          </p>
        ) : (
          filteredSessions.map((session) => (
            <div key={session.id} className="session-item">
              <div className="session-info" onClick={() => handleSelectSession(session)}>
                <span className="session-name">{session.name}</span>
                <span className="session-date">{new Date(session.createdAt).toLocaleString()}</span>
              </div>
              <STButton className="danger_button" onClick={() => handleDeleteSession(session.id)}>
                <i className="fa-solid fa-trash-can"></i>
              </STButton>
            </div>
          ))
        )}
      </div>
      <div className="session-actions">
        <STButton onClick={handleCreateNewSession} className="menu_button">
          <i className="fa-solid fa-plus"></i> {labels.newSessionButton}
        </STButton>
      </div>
    </div>
  );
};
