import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  STButton,
  STConnectionProfileSelect,
  STFancyDropdown,
  STPresetSelect,
  STTextarea,
  PresetItem,
  DropdownItem as FancyDropdownItem,
  Popup,
} from 'sillytavern-utils-lib/components/react';
import { BuildPromptOptions, getWorldInfos } from 'sillytavern-utils-lib';
import {
  groups,
  selected_group,
  st_createWorldInfoEntry,
  st_echo,
  st_getCharaFilename,
  this_chid,
  world_names,
} from 'sillytavern-utils-lib/config';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { runWorldInfoRecommendation, Session } from '../generate.js';
import { ExtensionSettings, SUPPORTED_LANGUAGES, SupportedLanguage, settingsManager } from '../settings.js';
import { Character } from 'sillytavern-utils-lib/types';
import { RegexScriptData } from 'sillytavern-utils-lib/types/regex';
import { SuggestedEntry } from './SuggestedEntry.js';
import * as Handlebars from 'handlebars';
import { useForceUpdate } from '../hooks/useForceUpdate.js';
import { SelectEntriesPopup, SelectEntriesPopupRef } from './SelectEntriesPopup.js';
import { POPUP_TYPE } from 'sillytavern-utils-lib/types/popup';
import { ReviseSessionManager } from './ReviseSessionManager.js';

if (!Handlebars.helpers['join']) {
  Handlebars.registerHelper('join', function (array: any, separator: any) {
    if (Array.isArray(array)) {
      return array.join(typeof separator === 'string' ? separator : ', ');
    }
    return '';
  });
}

if (!Handlebars.helpers['is_not_empty']) {
  Handlebars.registerHelper('is_not_empty', function (this: any, value: any, options: any) {
    if (!value) {
      return options.inverse(this);
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? options.fn(this) : options.inverse(this);
    }
    if (typeof value === 'object' && Object.keys(value).length > 0) {
      return options.fn(this);
    }
    if (typeof value !== 'object' && !Array.isArray(value)) {
      return options.fn(this);
    }
    return options.inverse(this);
  });
}

const globalContext = SillyTavern.getContext();

type UILabels = {
  loadingText: string;
  title: string;
  connectionProfileTitle: string;
  contextToSendTitle: string;
  descriptionCheckbox: string;
  messagesTitle: string;
  messagesDropdown: {
    none: string;
    all: string;
    first: string;
    last: string;
    range: string;
  };
  messagesFirstLabelBeforeInput: string;
  messagesFirstLabelAfterInput: string;
  messagesLastLabelBeforeInput: string;
  messagesLastLabelAfterInput: string;
  rangeLabel: string;
  rangeConnector: string;
  messageCountPlaceholders: {
    start: string;
    end: string;
  };
  selectCharacterTitle: string;
  selectCharacterTooltip: string;
  charCardLabel: string;
  authorNoteLabel: string;
  worldInfoLabel: string;
  lorebooksTitle: string;
  selectEntriesButton: string;
  selectEntriesTooltip: string;
  selectedEntriesSummary: (count: number) => string;
  existingSuggestionsLabel: string;
  maxContextLabel: string;
  maxContextOptions: {
    profile: string;
    sampler: string;
    custom: string;
  };
  maxContextPlaceholder: string;
  maxResponseTokensLabel: string;
  maxResponseTokensPlaceholder: string;
  promptSectionTitle: string;
  promptPresetLabel: string;
  promptPlaceholder: string;
  sendPromptButton: string;
  generatingButton: string;
  retryButton: string;
  suggestedEntriesTitle: string;
  addAllButton: string;
  globalReviseButton: string;
  globalReviseTooltip: string;
  importEntryButton: string;
  importEntryTooltip: string;
  resetButton: string;
  emptyStateMessage: string;
  selectEntriesDialogTitle: string;
  importEntriesDialogTitle: string;
  languageButtonLabel: (languageLabel: string) => string;
  languageButtonTooltip: string;
};

type UIMessages = {
  needProfile: string;
  needPrompt: string;
  noResults: string;
  noEntriesToAdd: string;
  requestTimeout: string;
  addAllConfirmTitle: string;
  addAllConfirmMessage: (count: number) => string;
  resetConfirmTitle: string;
  resetConfirmMessage: string;
  resetSuccess: string;
  entryUnchanged: (comment: string) => string;
  entryAdded: string;
  entryUpdated: string;
  entryAddFailed: (comment: string) => string;
  entryProcessFailed: (comment: string) => string;
  worldSaveFailed: (worldName: string) => string;
  addAllResult: (added: number, updated: number, unchanged: number) => string;
  languageSwitched: (languageLabel: string) => string;
  importSuccess: (count: number) => string;
  globalReviseApplied: string;
};

const REQUEST_TIMEOUT_MS = 300000;

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  'zh-CN': '中文',
};

const UI_LABELS: Record<SupportedLanguage, UILabels> = {
  en: {
    loadingText: 'Loading...',
    title: 'World Info Recommender',
    connectionProfileTitle: 'Connection Profile',
    contextToSendTitle: 'Context to Send',
    descriptionCheckbox: 'Description of SillyTavern and Lorebook',
    messagesTitle: 'Messages to Include',
    messagesDropdown: {
      none: 'None',
      all: 'All Messages',
      first: 'First X Messages',
      last: 'Last X Messages',
      range: 'Range',
    },
    messagesFirstLabelBeforeInput: 'First ',
    messagesFirstLabelAfterInput: ' Messages',
    messagesLastLabelBeforeInput: 'Last ',
    messagesLastLabelAfterInput: ' Messages',
    rangeLabel: 'Range: ',
    rangeConnector: ' to ',
    messageCountPlaceholders: {
      start: 'Start',
      end: 'End',
    },
    selectCharacterTitle: 'Select Character',
    selectCharacterTooltip: 'Select character for your group.',
    charCardLabel: 'Char Card',
    authorNoteLabel: 'Author Note',
    worldInfoLabel: 'World Info',
    lorebooksTitle: 'Lorebooks to Include',
    selectEntriesButton: 'Select Entries',
    selectEntriesTooltip: 'Select specific entries from the chosen lorebooks',
    selectedEntriesSummary: (count: number) => (count > 0 ? `${count} selected` : 'All entries included'),
    existingSuggestionsLabel: 'Existing Suggestions',
    maxContextLabel: 'Max Context',
    maxContextOptions: {
      profile: 'Use profile preset',
      sampler: 'Use active preset in sampler settings',
      custom: 'Custom',
    },
    maxContextPlaceholder: 'Enter max tokens',
    maxResponseTokensLabel: 'Max Response Tokens',
    maxResponseTokensPlaceholder: 'Enter max response tokens',
    promptSectionTitle: 'Your Prompt',
    promptPresetLabel: 'Prompt Preset',
    promptPlaceholder: "e.g., 'Suggest entries for places {{user}} visited.'",
    sendPromptButton: 'Send Prompt',
    generatingButton: 'Generating...',
    retryButton: 'Retry',
    suggestedEntriesTitle: 'Suggested Entries',
    addAllButton: 'Add All',
    globalReviseButton: 'Global Revise',
    globalReviseTooltip: 'Revise all selected existing entries and current suggestions in a single chat session',
    importEntryButton: 'Import Entry',
    importEntryTooltip: 'Import existing entries to continue/revise them',
    resetButton: 'Reset',
    emptyStateMessage: 'No suggestions yet. Send a prompt to get started!',
    selectEntriesDialogTitle: 'Select Entries to Include in Context',
    importEntriesDialogTitle: 'Select Entries to Import for Revision',
    languageButtonLabel: (languageLabel: string) => `Language: ${languageLabel}`,
    languageButtonTooltip: 'Switch interface language',
  },
  'zh-CN': {
    loadingText: '加载中...',
    title: '世界信息推荐器',
    connectionProfileTitle: '连接配置',
    contextToSendTitle: '发送上下文',
    descriptionCheckbox: 'SillyTavern 与世界书信息说明',
    messagesTitle: '包含的消息',
    messagesDropdown: {
      none: '不包含',
      all: '全部消息',
      first: '最前 X 条消息',
      last: '最后 X 条消息',
      range: '指定范围',
    },
    messagesFirstLabelBeforeInput: '前',
    messagesFirstLabelAfterInput: ' 条消息',
    messagesLastLabelBeforeInput: '后',
    messagesLastLabelAfterInput: ' 条消息',
    rangeLabel: '范围：',
    rangeConnector: ' 至 ',
    messageCountPlaceholders: {
      start: '起始',
      end: '结束',
    },
    selectCharacterTitle: '选择角色',
    selectCharacterTooltip: '为小队选择角色。',
    charCardLabel: '角色卡片',
    authorNoteLabel: '作者附注',
    worldInfoLabel: '世界信息',
    lorebooksTitle: '包含的世界书',
    selectEntriesButton: '选择条目',
    selectEntriesTooltip: '从已选择的世界书中精确勾选条目',
    selectedEntriesSummary: (count: number) => (count > 0 ? `已选择 ${count} 条` : '包含所有条目'),
    existingSuggestionsLabel: '现有建议',
    maxContextLabel: '最大上下文',
    maxContextOptions: {
      profile: '使用配置预设',
      sampler: '使用采样器设置中的活动预设',
      custom: '自定义',
    },
    maxContextPlaceholder: '输入最大上下文长度',
    maxResponseTokensLabel: '最大回复 Token',
    maxResponseTokensPlaceholder: '输入最大回复 Token',
    promptSectionTitle: '你的提示词',
    promptPresetLabel: '提示词预设',
    promptPlaceholder: '例如："为 {{user}} 去过的地方推荐条目"。',
    sendPromptButton: '发送提示词',
    generatingButton: '生成中...',
    retryButton: '重新生成',
    suggestedEntriesTitle: '推荐条目',
    addAllButton: '全部添加',
    globalReviseButton: '全局修改',
    globalReviseTooltip: '在单个会话中修改所有已选条目和当前建议',
    importEntryButton: '导入条目',
    importEntryTooltip: '导入现有条目以继续/修改',
    resetButton: '重置',
    emptyStateMessage: '尚无建议，发送提示词以开始吧！',
    selectEntriesDialogTitle: '选择要写入上下文的条目',
    importEntriesDialogTitle: '选择要导入修改的条目',
    languageButtonLabel: (languageLabel: string) => `界面语言：${languageLabel}`,
    languageButtonTooltip: '切换界面语言',
  },
};

const UI_MESSAGES: Record<SupportedLanguage, UIMessages> = {
  en: {
    needProfile: 'Please select a connection profile.',
    needPrompt: 'Please enter a prompt.',
    noResults: 'No results from AI',
    noEntriesToAdd: 'No entries to add.',
    requestTimeout: 'Request timed out. Please check your network or proxy settings.',
    addAllConfirmTitle: 'Add All',
    addAllConfirmMessage: (count: number) => `Are you sure you want to add/update all ${count} suggested entries?`,
    resetConfirmTitle: 'Reset',
    resetConfirmMessage: 'Clear all suggestions and reset lorebook selection?',
    resetSuccess: 'Reset successful',
    entryUnchanged: (comment: string) => `No changes detected for "${comment}". Entry was not updated.`,
    entryAdded: 'Entry added',
    entryUpdated: 'Entry updated',
    entryAddFailed: (comment: string) => `Failed to add entry: ${comment}`,
    entryProcessFailed: (comment: string) => `Failed to process entry: ${comment}`,
    worldSaveFailed: (worldName: string) => `Failed to save world: ${worldName}`,
    addAllResult: (added: number, updated: number, unchanged: number) =>
      `Processed: ${added} new, ${updated} updated, ${unchanged} unchanged.`,
    languageSwitched: (languageLabel: string) => `Language switched to ${languageLabel}.`,
    importSuccess: (count: number) => `Imported ${count} entries for revision.`,
    globalReviseApplied: 'Changes from global revise session applied.',
  },
  'zh-CN': {
    needProfile: '请先选择一个连接配置。',
    needPrompt: '请输入提示词。',
    noResults: 'AI 没有返回结果',
    noEntriesToAdd: '没有可添加的条目。',
    requestTimeout: '请求超时，请检查网络或代理设置。',
    addAllConfirmTitle: '添加全部',
    addAllConfirmMessage: (count: number) => `确定要添加或更新全部 ${count} 个推荐条目吗？`,
    resetConfirmTitle: '重置',
    resetConfirmMessage: '确认清空所有建议并重置世界书选择？',
    resetSuccess: '已成功重置',
    entryUnchanged: (comment: string) => `条目“${comment}”未检测到变更，未进行更新。`,
    entryAdded: '条目已添加',
    entryUpdated: '条目已更新',
    entryAddFailed: (comment: string) => `添加条目失败：${comment}`,
    entryProcessFailed: (comment: string) => `处理条目失败：${comment}`,
    worldSaveFailed: (worldName: string) => `保存世界书失败：${worldName}`,
    addAllResult: (added: number, updated: number, unchanged: number) =>
      `处理完成：新增 ${added} 条，更新 ${updated} 条，未变化 ${unchanged} 条。`,
    languageSwitched: (languageLabel: string) => `界面语言已切换为 ${languageLabel}。`,
    importSuccess: (count: number) => `已导入 ${count} 条条目用于修改。`,
    globalReviseApplied: '全局修改的内容已应用。',
  },
};

const getAvatar = () => (this_chid ? st_getCharaFilename(this_chid) : selected_group);

export const MainPopup: FC = () => {
  const forceUpdate = useForceUpdate();
  const settings = settingsManager.getSettings();
  const fallbackLanguage = SUPPORTED_LANGUAGES.includes(settings.language) ? settings.language : DEFAULT_LANGUAGE;
  const labels = UI_LABELS[fallbackLanguage];
  const messages = UI_MESSAGES[fallbackLanguage];
  const currentLanguageLabel = LANGUAGE_LABELS[fallbackLanguage];
  const [session, setSession] = useState<Session>({
    suggestedEntries: {},
    blackListedEntries: [],
    selectedWorldNames: [],
    selectedEntryUids: {},
    regexIds: {},
  });
  const [allWorldNames, setAllWorldNames] = useState<string[]>([]);
  const [entriesGroupByWorldName, setEntriesGroupByWorldName] = useState<Record<string, WIEntry[]>>({});
  const [groupMembers, setGroupMembers] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelectingEntries, setIsSelectingEntries] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGlobalReviseOpen, setIsGlobalReviseOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const selectEntriesPopupRef = useRef<SelectEntriesPopupRef>(null);
  const importPopupRef = useRef<SelectEntriesPopupRef>(null);

  const avatarKey = useMemo(() => getAvatar() ?? '_global', [this_chid, selected_group]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setEntriesGroupByWorldName({});
        setAllWorldNames([]);
        setGroupMembers([]);

        const avatar = getAvatar();
        const key = `worldInfoRecommend_${avatarKey}`;

        let savedSession: Partial<Session> = {};
        try {
          savedSession = JSON.parse(localStorage.getItem(key) ?? '{}');
        } catch (e) {
          console.error('Failed to parse saved session:', e);
        }

        const initialSession: Session = {
          suggestedEntries: savedSession.suggestedEntries ?? {},
          blackListedEntries: savedSession.blackListedEntries ?? [],
          selectedWorldNames: savedSession.selectedWorldNames ?? [],
          selectedEntryUids: savedSession.selectedEntryUids ?? {},
          regexIds: savedSession.regexIds ?? {},
        };

        let loadedEntries: Record<string, WIEntry[]> = {};
        if (avatar) {
          if (selected_group) {
            const groupWorldInfo = await getWorldInfos(['chat', 'persona', 'global'], true);
            if (groupWorldInfo) loadedEntries = groupWorldInfo;

            const group = groups.find((g: any) => g.id === selected_group);
            if (group) {
              for (const member of group.members) {
                const index = globalContext.characters.findIndex((c: Character) => c.avatar === member);
                if (index !== -1) {
                  const worldInfo = await getWorldInfos(['character'], true, index);
                  if (worldInfo) loadedEntries = { ...loadedEntries, ...worldInfo };
                }
              }
            }
          } else {
            loadedEntries = await getWorldInfos(['all'], true, this_chid);
          }
        } else {
          for (const worldName of world_names) {
            const worldInfo = await globalContext.loadWorldInfo(worldName);
            if (worldInfo) loadedEntries[worldName] = Object.values(worldInfo.entries);
          }
        }
        setEntriesGroupByWorldName(loadedEntries);
        const loadedWorldNames = Object.keys(loadedEntries);
        setAllWorldNames(loadedWorldNames);

        if (initialSession.selectedWorldNames.length === 0 && avatarKey !== '_global') {
          initialSession.selectedWorldNames = [...loadedWorldNames];
        } else {
          initialSession.selectedWorldNames = initialSession.selectedWorldNames.filter((name) =>
            loadedWorldNames.includes(name),
          );
        }

        const validEntryUids: Record<string, number[]> = {};
        if (initialSession.selectedEntryUids) {
          for (const [worldName, uids] of Object.entries(initialSession.selectedEntryUids)) {
            if (loadedEntries[worldName]) {
              const worldEntryUids = new Set(loadedEntries[worldName].map((e) => e.uid));
              const validUids = uids.filter((uid) => worldEntryUids.has(uid));
              if (validUids.length > 0) {
                validEntryUids[worldName] = validUids;
              }
            }
          }
        }
        initialSession.selectedEntryUids = validEntryUids;
        setSession(initialSession);

        if (selected_group) {
          const group = groups.find((g: any) => g.id === selected_group);
          if (group?.generation_mode === 0) {
            const members = group.members
              .map((memberAvatar: string) => globalContext.characters.find((c: Character) => c.avatar === memberAvatar))
              .filter((c?: Character): c is Character => !!c);
            setGroupMembers(members);
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        st_echo('error', 'Failed to load World Info Recommender data. Check console for details.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [avatarKey]);

  useEffect(() => {
    if (isLoading) return;
    const key = `worldInfoRecommend_${avatarKey}`;
    localStorage.setItem(key, JSON.stringify(session));
  }, [session, avatarKey, isLoading]);

  const updateSetting = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    settingsManager.getSettings()[key] = value;
    settingsManager.saveSettings();
    forceUpdate();
  };

  const updateContextToSend = <K extends keyof ExtensionSettings['contextToSend']>(
    key: K,
    value: ExtensionSettings['contextToSend'][K],
  ) => {
    settingsManager.getSettings().contextToSend[key] = value;
    settingsManager.saveSettings();
    forceUpdate();
  };

  const handleLanguageToggle = () => {
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(fallbackLanguage);
    const nextLanguage = SUPPORTED_LANGUAGES[(currentIndex + 1) % SUPPORTED_LANGUAGES.length];
    const nextLabel = LANGUAGE_LABELS[nextLanguage];
    const messageTemplate = UI_MESSAGES[nextLanguage]?.languageSwitched ?? messages.languageSwitched;
    updateSetting('language', nextLanguage);
    st_echo('info', messageTemplate(nextLabel));
  };

  const addEntry = useCallback(
    async (
      entry: WIEntry,
      selectedWorldName: string,
      skipSave: boolean = false,
    ): Promise<'added' | 'updated' | 'unchanged'> => {
      const worldInfoCopy = structuredClone(entriesGroupByWorldName);
      if (!worldInfoCopy[selectedWorldName]) {
        worldInfoCopy[selectedWorldName] = [];
      }

      const existingEntry = worldInfoCopy[selectedWorldName].find((e) => e.uid === entry.uid);
      const isUpdate = !!existingEntry;
      let targetEntry: WIEntry;

      if (isUpdate) {
        // Safety check: prevent overwriting with empty content if original had content
        if ((!entry.content && existingEntry!.content) || (!entry.comment && existingEntry!.comment)) {
          st_echo(
            'warning',
            '新条目内容或名称为空，已取消更新以防止数据丢失。请检查 AI 生成结果或切换到 JSON 模式。',
          );
          return 'unchanged';
        }

        // This is an update. Check if anything actually changed.
        const contentChanged = (entry.content || '') !== (existingEntry!.content || '');
        const commentChanged = (entry.comment || '') !== (existingEntry!.comment || '');
        const keysChanged =
          (entry.key || []).slice().sort().join(',') !== (existingEntry!.key || []).slice().sort().join(',');

        if (!contentChanged && !commentChanged && !keysChanged) {
          return 'unchanged'; // Nothing to do.
        }
        targetEntry = existingEntry!;
      } else {
        const stFormat = { entries: Object.fromEntries(worldInfoCopy[selectedWorldName].map((e) => [e.uid, e])) };
        const newEntry = st_createWorldInfoEntry(selectedWorldName, stFormat);
        if (!newEntry) throw new Error('Failed to create new World Info entry.');
        targetEntry = newEntry;
        worldInfoCopy[selectedWorldName].push(targetEntry);
      }

      Object.assign(targetEntry, {
        key: entry.key || [],
        content: entry.content || '',
        comment: entry.comment || '',
      });
      setEntriesGroupByWorldName(worldInfoCopy);

      if (!skipSave) {
        const finalFormat = { entries: Object.fromEntries(worldInfoCopy[selectedWorldName].map((e) => [e.uid, e])) };
        await globalContext.saveWorldInfo(selectedWorldName, finalFormat);
        globalContext.reloadWorldInfoEditor(selectedWorldName, true);
      }

      return isUpdate ? 'updated' : 'added';
    },
    [entriesGroupByWorldName],
  );

  const handleGeneration = useCallback(
    async (continueFrom?: { worldName: string; entry: WIEntry; prompt: string; mode: 'continue' | 'revise' }) => {
      if (!settings.profileId) return st_echo('warning', messages.needProfile);

      const userPrompt = continueFrom?.prompt ?? settings.promptPresets[settings.promptPreset].content;

      if (!continueFrom && !userPrompt) {
        return st_echo('warning', messages.needPrompt);
      }

      setLastError(null);
      setIsGenerating(true);
      try {
        const profile = globalContext.extensionSettings.connectionManager?.profiles?.find(
          (p) => p.id === settings.profileId,
        );
        if (!profile) throw new Error('Connection profile not found.');

        const avatar = getAvatar();
        const buildPromptOptions: BuildPromptOptions = {
          presetName: profile.preset,
          contextName: profile.context,
          instructName: profile.instruct,
          syspromptName: profile.sysprompt,
          ignoreCharacterFields: !settings.contextToSend.charCard,
          ignoreWorldInfo: true,
          ignoreAuthorNote: !settings.contextToSend.authorNote,
          maxContext:
            settings.maxContextType === 'custom'
              ? settings.maxContextValue
              : settings.maxContextType === 'profile'
                ? 'preset'
                : 'active',
          includeNames: !!selected_group,
        };

        if (!avatar) {
          buildPromptOptions.messageIndexesBetween = { start: -1, end: -1 };
        } else {
          switch (settings.contextToSend.messages.type) {
            case 'none':
              buildPromptOptions.messageIndexesBetween = { start: -1, end: -1 };
              break;
            case 'first':
              buildPromptOptions.messageIndexesBetween = { start: 0, end: settings.contextToSend.messages.first ?? 10 };
              break;
            case 'last': {
              const lastCount = settings.contextToSend.messages.last ?? 10;
              const chatLength = globalContext.chat?.length ?? 0;
              buildPromptOptions.messageIndexesBetween = {
                end: Math.max(0, chatLength - 1),
                start: Math.max(0, chatLength - lastCount),
              };
              break;
            }
            case 'range':
              if (settings.contextToSend.messages.range)
                buildPromptOptions.messageIndexesBetween = settings.contextToSend.messages.range;
              break;
          }
        }

        const promptSettings = structuredClone(settings.prompts);
        if (!settings.contextToSend.stDescription) delete (promptSettings as any).stDescription;
        if (!settings.contextToSend.worldInfo || session.selectedWorldNames.length === 0)
          delete (promptSettings as any).currentLorebooks;
        const anySuggestedEntries = Object.values(session.suggestedEntries).some((e) => e.length > 0);
        if (!settings.contextToSend.suggestedEntries || !anySuggestedEntries)
          delete (promptSettings as any).suggestedLorebooks;
        if (session.blackListedEntries.length === 0) delete (promptSettings as any).blackListedEntries;

        const continueFromPayload = continueFrom
          ? { worldName: continueFrom.worldName, entry: continueFrom.entry, mode: continueFrom.mode }
          : undefined;

        const resultingEntries = await new Promise<Record<string, WIEntry[]>>((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            reject(new Error(messages.requestTimeout));
          }, REQUEST_TIMEOUT_MS);

          runWorldInfoRecommendation({
            profileId: settings.profileId,
            userPrompt: userPrompt,
            buildPromptOptions,
            session,
            entriesGroupByWorldName,
            promptSettings,
            mainContextList: settings.mainContextTemplatePresets[settings.mainContextTemplatePreset].prompts
              .filter((p) => p.enabled)
              .map((p) => ({ promptName: p.promptName, role: p.role })),
            maxResponseToken: settings.maxResponseToken,
            continueFrom: continueFromPayload,
          })
            .then((result) => {
              clearTimeout(timeoutId);
              resolve(result);
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });

        if (Object.keys(resultingEntries).length > 0) {
          if (continueFrom) {
            setSession((prev) => {
              const newSuggested = structuredClone(prev.suggestedEntries);
              const worldName = continueFrom.worldName;
              const updatedEntry = resultingEntries[worldName]?.[0];

              if (newSuggested[worldName] && updatedEntry) {
                const entryIndex = newSuggested[worldName].findIndex(
                  (e) => e.uid === continueFrom.entry.uid && e.comment === continueFrom.entry.comment,
                );

                if (entryIndex !== -1) {
                  newSuggested[worldName][entryIndex] = updatedEntry;
                }
              }
              return { ...prev, suggestedEntries: newSuggested };
            });
          } else {
            setSession((prev) => {
              const newSuggested = structuredClone(prev.suggestedEntries);
              for (const [worldName, entries] of Object.entries(resultingEntries)) {
                if (!newSuggested[worldName]) newSuggested[worldName] = [];
                for (const entry of entries) {
                  if (!newSuggested[worldName].some((e) => e.uid === entry.uid && e.comment === entry.comment)) {
                    newSuggested[worldName].push(entry);
                  }
                }
              }
              return { ...prev, suggestedEntries: newSuggested };
            });
          }
        } else {
          st_echo('warning', messages.noResults);
        }
      } catch (error: any) {
        console.error('[WorldInfoRecommender] Generation error:', error);
        
        let friendlyMessage: string;
        const rawMessage = error instanceof Error ? error.message : String(error);
        
        // Check if it's a timeout error
        if (rawMessage === messages.requestTimeout) {
          friendlyMessage = messages.requestTimeout;
        } else if (rawMessage.includes('CORS') || rawMessage.includes('fetch')) {
          friendlyMessage = `网络请求失败。可能是 CORS 或网络问题。请检查：1) API 端点是否可访问 2) 连接配置是否正确 3) 是否需要代理设置。详细错误: ${rawMessage}`;
        } else if (rawMessage.includes('timeout') || rawMessage.includes('timed out')) {
          friendlyMessage = messages.requestTimeout;
        } else {
          friendlyMessage = `请求失败: ${rawMessage}`;
        }
        
        setLastError(friendlyMessage);
        st_echo('error', friendlyMessage);
      } finally {
        setIsGenerating(false);
      }
    },
    [settings, session, entriesGroupByWorldName, messages],
  );

  const handleAddSingleEntry = useCallback(
    async (entry: WIEntry, worldName: string, selectedTargetWorld: string) => {
      try {
        const status = await addEntry(entry, selectedTargetWorld);
        if (status === 'unchanged') {
          st_echo('info', messages.entryUnchanged(entry.comment));
        } else {
          st_echo('success', status === 'added' ? messages.entryAdded : messages.entryUpdated);
        }

        setSession((prev) => {
          const newSuggested = { ...prev.suggestedEntries };
          if (newSuggested[worldName]) {
            newSuggested[worldName] = newSuggested[worldName].filter(
              (e) => !(e.uid === entry.uid && e.comment === entry.comment),
            );
          }
          return { ...prev, suggestedEntries: newSuggested };
        });
      } catch (error: any) {
        console.error(error);
        const extra = error?.message ? ` (${error.message})` : '';
        st_echo('error', `${messages.entryAddFailed(entry.comment)}${extra}`);
      }
    },
    [addEntry, messages],
  );

  const handleAddAll = async () => {
    const totalEntries = Object.values(session.suggestedEntries).flat().length;
    if (totalEntries === 0) return st_echo('warning', messages.noEntriesToAdd);

    const confirm = await globalContext.Popup.show.confirm(
      messages.addAllConfirmTitle,
      messages.addAllConfirmMessage(totalEntries),
    );
    if (!confirm) return;

    setIsGenerating(true);
    let addedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const modifiedWorlds = new Set<string>();
    const entriesToAdd: { worldName: string; entry: WIEntry }[] = [];

    Object.entries(session.suggestedEntries).forEach(([worldName, entries]) => {
      entries.forEach((entry) => {
        const targetWorldName = allWorldNames.includes(worldName) ? worldName : (allWorldNames[0] ?? '');
        if (targetWorldName) entriesToAdd.push({ worldName: targetWorldName, entry });
      });
    });

    // Clone the current state once
    const worldInfoCopy = structuredClone(entriesGroupByWorldName);

    for (const { worldName, entry } of entriesToAdd) {
      try {
        if (!worldInfoCopy[worldName]) {
          worldInfoCopy[worldName] = [];
        }

        const existingEntry = worldInfoCopy[worldName].find((e) => e.uid === entry.uid);
        const isUpdate = !!existingEntry;
        let targetEntry: WIEntry | undefined;
        let status: 'added' | 'updated' | 'unchanged' = 'unchanged';

        if (isUpdate) {
          const contentChanged = (entry.content || '') !== (existingEntry!.content || '');
          const commentChanged = (entry.comment || '') !== (existingEntry!.comment || '');
          const keysChanged =
            (entry.key || []).slice().sort().join(',') !== (existingEntry!.key || []).slice().sort().join(',');

          if (contentChanged || commentChanged || keysChanged) {
            targetEntry = existingEntry!;
            status = 'updated';
          }
        } else {
          const stFormat = { entries: Object.fromEntries(worldInfoCopy[worldName].map((e) => [e.uid, e])) };
          const newEntry = st_createWorldInfoEntry(worldName, stFormat);
          if (!newEntry) throw new Error('Failed to create new World Info entry.');

          targetEntry = newEntry;
          worldInfoCopy[worldName].push(targetEntry);
          status = 'added';
        }

        if (status !== 'unchanged' && targetEntry) {
          Object.assign(targetEntry, {
            key: entry.key || [],
            content: entry.content || '',
            comment: entry.comment || '',
          });
          modifiedWorlds.add(worldName);
        }

        if (status === 'added') addedCount++;
        else if (status === 'updated') updatedCount++;
        else unchangedCount++;
      } catch (error) {
        console.error(error);
        st_echo('error', messages.entryProcessFailed(entry.comment));
      }
    }

    // Update state once
    setEntriesGroupByWorldName(worldInfoCopy);

    // Save modified worlds
    for (const worldName of modifiedWorlds) {
      try {
        const finalFormat = { entries: Object.fromEntries(worldInfoCopy[worldName].map((e) => [e.uid, e])) };
        await globalContext.saveWorldInfo(worldName, finalFormat);
        globalContext.reloadWorldInfoEditor(worldName, true);
      } catch (error) {
        st_echo('error', messages.worldSaveFailed(worldName));
      }
    }

    setSession((prev) => ({ ...prev, suggestedEntries: {} }));
    st_echo('success', messages.addAllResult(addedCount, updatedCount, unchangedCount));
    setIsGenerating(false);
  };

  const handleReset = async () => {
    const confirm = await globalContext.Popup.show.confirm(messages.resetConfirmTitle, messages.resetConfirmMessage);
    if (confirm) {
      setSession((prev) => ({
        ...prev,
        suggestedEntries: {},
        blackListedEntries: [],
        selectedWorldNames: getAvatar() ? [...allWorldNames] : [],
        selectedEntryUids: {},
      }));
      st_echo('success', messages.resetSuccess);
    }
  };

  const handleRemoveEntry = (entry: WIEntry, worldName: string, isBlacklist: boolean) => {
    setSession((prev) => {
      const newSession = { ...prev };
      if (isBlacklist) {
        newSession.blackListedEntries = [...newSession.blackListedEntries, `${worldName} (${entry.comment})`];
      }
      const newSuggested = { ...newSession.suggestedEntries };
      if (newSuggested[worldName]) {
        newSuggested[worldName] = newSuggested[worldName].filter(
          (e) => !(e.uid === entry.uid && e.comment === entry.comment),
        );
      }
      newSession.suggestedEntries = newSuggested;
      return newSession;
    });
  };

  const handleUpdateEntry = (
    worldName: string,
    originalEntry: WIEntry,
    updatedEntry: WIEntry,
    updatedRegexIds?: Record<string, Partial<RegexScriptData>>,
  ) => {
    setSession((prev) => {
      const newSuggested = { ...prev.suggestedEntries };
      if (newSuggested[worldName]) {
        const entryIndex = newSuggested[worldName].findIndex(
          (e) => e.uid === originalEntry.uid && e.comment === originalEntry.comment,
        );

        if (entryIndex !== -1) {
          // Ensure UID is preserved to maintain the link to the original entry
          const finalUpdatedEntry = { ...updatedEntry };
          if (originalEntry.uid !== undefined) {
            finalUpdatedEntry.uid = originalEntry.uid;
          }
          newSuggested[worldName][entryIndex] = finalUpdatedEntry;
        }
      }
      const newSessionState = { ...prev, suggestedEntries: newSuggested };
      if (updatedRegexIds) {
        newSessionState.regexIds = updatedRegexIds;
      }
      return newSessionState;
    });
  };

  const handleImportEntries = useCallback(
    (selection: Record<string, number[]>) => {
      setSession((prev) => {
        const newSuggested = structuredClone(prev.suggestedEntries);
        let importCount = 0;

        for (const [worldName, uids] of Object.entries(selection)) {
          if (!entriesGroupByWorldName[worldName]) continue;
          if (!newSuggested[worldName]) {
            newSuggested[worldName] = [];
          }

          for (const uid of uids) {
            const alreadySuggested = newSuggested[worldName].some((e) => e.uid === uid);
            if (alreadySuggested) continue;

            const entryToImport = entriesGroupByWorldName[worldName].find((e) => e.uid === uid);
            if (entryToImport) {
              newSuggested[worldName].push(structuredClone(entryToImport));
              importCount++;
            }
          }
        }
        if (importCount > 0) {
          st_echo('success', messages.importSuccess(importCount));
        }
        return { ...prev, suggestedEntries: newSuggested };
      });
    },
    [entriesGroupByWorldName, messages],
  );

  const entriesForSelectionPopup = useMemo(() => {
    const result: Record<string, WIEntry[]> = {};
    session.selectedWorldNames.forEach((worldName) => {
      if (entriesGroupByWorldName[worldName]) {
        result[worldName] = entriesGroupByWorldName[worldName];
      }
    });
    return result;
  }, [session.selectedWorldNames, entriesGroupByWorldName]);

  const entriesForGlobalRevise = useMemo(() => {
    const mergedState: Record<string, WIEntry[]> = JSON.parse(JSON.stringify(entriesForSelectionPopup));
    const suggestedByUid = new Map<number, { worldName: string; entry: WIEntry }>();

    Object.entries(session.suggestedEntries).forEach(([worldName, entries]) => {
      entries.forEach((entry) => {
        if (entry.uid) {
          suggestedByUid.set(entry.uid, { worldName, entry });
        }
      });
    });

    Object.entries(mergedState).forEach(([, entries]) => {
      entries.forEach((existingEntry, index) => {
        if (existingEntry.uid && suggestedByUid.has(existingEntry.uid)) {
          entries[index] = suggestedByUid.get(existingEntry.uid)!.entry;
          suggestedByUid.delete(existingEntry.uid);
        }
      });
    });

    suggestedByUid.forEach(({ worldName, entry }) => {
      if (!mergedState[worldName]) {
        mergedState[worldName] = [];
      }
      if (!mergedState[worldName].some((e) => e.uid === entry.uid)) {
        mergedState[worldName].push(entry);
      }
    });

    return mergedState;
  }, [entriesForSelectionPopup, session.suggestedEntries]);

  const handleApplyGlobalRevise = (newState: Record<string, WIEntry[]>) => {
    // Create a map of all original entries for efficient lookup. Key is "worldName::uid".
    const originalEntriesMap = new Map<string, WIEntry>();
    Object.entries(entriesGroupByWorldName).forEach(([worldName, entries]) => {
      entries.forEach((entry) => {
        originalEntriesMap.set(`${worldName}::${entry.uid}`, entry);
      });
    });

    const newSuggestedEntries: Record<string, WIEntry[]> = {};

    // Iterate through the state returned by the revise session.
    Object.entries(newState).forEach(([worldName, entries]) => {
      entries.forEach((revisedEntry) => {
        const compositeKey = `${worldName}::${revisedEntry.uid}`;
        const originalEntry = originalEntriesMap.get(compositeKey);

        let isSuggestion = false;
        if (!originalEntry) {
          // The entry is new; it didn't exist in the original lorebooks.
          isSuggestion = true;
        } else {
          // The entry existed. We must check if it was modified.
          const contentChanged = (revisedEntry.content || '') !== (originalEntry.content || '');
          const commentChanged = (revisedEntry.comment || '') !== (originalEntry.comment || '');
          const keysChanged =
            (revisedEntry.key || []).slice().sort().join(',') !== (originalEntry.key || []).slice().sort().join(',');

          if (contentChanged || commentChanged || keysChanged) {
            isSuggestion = true;
          }
        }

        // If the entry is new or modified, add it to our list of suggestions.
        if (isSuggestion) {
          if (!newSuggestedEntries[worldName]) {
            newSuggestedEntries[worldName] = [];
          }
          newSuggestedEntries[worldName].push(revisedEntry);
        }
      });
    });

    setSession((prev) => ({ ...prev, suggestedEntries: newSuggestedEntries }));
    st_echo('success', messages.globalReviseApplied);
  };

  const promptPresetItems = useMemo(
    (): PresetItem[] => Object.keys(settings.promptPresets).map((key) => ({ value: key, label: key })),
    [settings.promptPresets],
  );

  const worldInfoDropdownItems = useMemo(
    (): FancyDropdownItem[] => allWorldNames.map((name) => ({ value: name, label: name })),
    [allWorldNames],
  );

  const totalSelectedEntries = useMemo(
    () => Object.values(session.selectedEntryUids).reduce((sum, uids) => sum + uids.length, 0),
    [session.selectedEntryUids],
  );

  if (isLoading) {
    return <div>{labels.loadingText}</div>;
  }

  const suggestedEntriesList = Object.entries(session.suggestedEntries).flatMap(([worldName, entries]) =>
    entries.map((entry) => ({ worldName, entry })),
  );

  return (
    <>
      <div id="worldInfoRecommenderPopup">
        <div className="popup_header">
          <h2>{labels.title}</h2>
          <div className="popup_header_buttons">
            <STButton
              className="menu_button language-toggle"
              onClick={handleLanguageToggle}
              title={labels.languageButtonTooltip}
            >
              <span style={{ fontSize: '1.1em', marginRight: '6px' }}>🌐</span>
              <span>{labels.languageButtonLabel(currentLanguageLabel)}</span>
            </STButton>
          </div>
        </div>
        <div className="container">
          <div className="column">
            <div className="card">
              <h3>{labels.connectionProfileTitle}</h3>
              <STConnectionProfileSelect
                initialSelectedProfileId={settings.profileId}
                // @ts-ignore
                onChange={(profile) => updateSetting('profileId', profile?.id)}
              />
            </div>
            <div className="card">
              <h3>{labels.contextToSendTitle}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label className="checkbox_label">
                  <input
                    type="checkbox"
                    checked={settings.contextToSend.stDescription}
                    onChange={(e) => updateContextToSend('stDescription', e.target.checked)}
                  />
                  {labels.descriptionCheckbox}
                </label>
                {avatarKey !== '_global' && (
                  <div className="message-options">
                    <h4>{labels.messagesTitle}</h4>
                    <select
                      className="text_pole"
                      value={settings.contextToSend.messages.type}
                      onChange={(e) =>
                        updateContextToSend('messages', {
                          ...settings.contextToSend.messages,
                          type: e.target.value as any,
                        })
                      }
                    >
                      <option value="none">{labels.messagesDropdown.none}</option>
                      <option value="all">{labels.messagesDropdown.all}</option>
                      <option value="first">{labels.messagesDropdown.first}</option>
                      <option value="last">{labels.messagesDropdown.last}</option>
                      <option value="range">{labels.messagesDropdown.range}</option>
                    </select>
                    {settings.contextToSend.messages.type === 'first' && (
                      <div style={{ marginTop: '10px' }}>
                        <label>
                          {labels.messagesFirstLabelBeforeInput}
                          <input
                            type="number"
                            className="text_pole small message-input"
                            min="1"
                            value={settings.contextToSend.messages.first ?? 10}
                            onChange={(e) =>
                              updateContextToSend('messages', {
                                ...settings.contextToSend.messages,
                                first: parseInt(e.target.value) || 10,
                              })
                            }
                          />
                          {labels.messagesFirstLabelAfterInput}
                        </label>
                      </div>
                    )}
                    {settings.contextToSend.messages.type === 'last' && (
                      <div style={{ marginTop: '10px' }}>
                        <label>
                          {labels.messagesLastLabelBeforeInput}
                          <input
                            type="number"
                            className="text_pole small message-input"
                            min="1"
                            value={settings.contextToSend.messages.last ?? 10}
                            onChange={(e) =>
                              updateContextToSend('messages', {
                                ...settings.contextToSend.messages,
                                last: parseInt(e.target.value) || 10,
                              })
                            }
                          />
                          {labels.messagesLastLabelAfterInput}
                        </label>
                      </div>
                    )}
                    {settings.contextToSend.messages.type === 'range' && (
                      <div style={{ marginTop: '10px' }}>
                        <label>
                          {labels.rangeLabel}
                          <input
                            type="number"
                            className="text_pole small message-input"
                            min="0"
                            placeholder={labels.messageCountPlaceholders.start}
                            value={settings.contextToSend.messages.range?.start ?? 0}
                            onChange={(e) =>
                              updateContextToSend('messages', {
                                ...settings.contextToSend.messages,
                                range: {
                                  ...settings.contextToSend.messages.range!,
                                  start: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                          />
                          {labels.rangeConnector}
                          <input
                            type="number"
                            className="text_pole small message-input"
                            min="1"
                            placeholder={labels.messageCountPlaceholders.end}
                            value={settings.contextToSend.messages.range?.end ?? 10}
                            onChange={(e) =>
                              updateContextToSend('messages', {
                                ...settings.contextToSend.messages,
                                range: {
                                  ...settings.contextToSend.messages.range!,
                                  end: parseInt(e.target.value) || 10,
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
                <label className="checkbox_label">
                  <input
                    type="checkbox"
                    checked={settings.contextToSend.charCard}
                    onChange={(e) => updateContextToSend('charCard', e.target.checked)}
                  />
                  {labels.charCardLabel}
                </label>
                {groupMembers.length > 0 && (
                  <div>
                    <h4>{labels.selectCharacterTitle}</h4>
                    <select className="text_pole" title={labels.selectCharacterTooltip}>
                      {groupMembers.map((member) => (
                        <option key={member.avatar} value={member.avatar}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <label className="checkbox_label">
                  <input
                    type="checkbox"
                    checked={settings.contextToSend.authorNote}
                    onChange={(e) => updateContextToSend('authorNote', e.target.checked)}
                  />
                  {labels.authorNoteLabel}
                </label>
                <label className="checkbox_label">
                  <input
                    type="checkbox"
                    checked={settings.contextToSend.worldInfo}
                    onChange={(e) => updateContextToSend('worldInfo', e.target.checked)}
                  />
                  {labels.worldInfoLabel}
                </label>
                <div>
                  <h4>{labels.lorebooksTitle}</h4>
                  <STFancyDropdown
                    items={worldInfoDropdownItems}
                    value={session.selectedWorldNames}
                    onChange={(newValues) => {
                      setSession((prev) => {
                        const newSelectedEntryUids = { ...prev.selectedEntryUids };
                        const removedWorlds = prev.selectedWorldNames.filter((w) => !newValues.includes(w));
                        removedWorlds.forEach((w) => delete newSelectedEntryUids[w]);
                        return { ...prev, selectedWorldNames: newValues, selectedEntryUids: newSelectedEntryUids };
                      });
                    }}
                    multiple
                    enableSearch
                  />
                </div>
                {session.selectedWorldNames.length > 0 && (
                  <div className="entry-selection-control">
                    <STButton
                      className="menu_button"
                      onClick={() => setIsSelectingEntries(true)}
                      title={labels.selectEntriesTooltip}
                    >
                      <i className="fa-solid fa-list-check"></i>
                      {labels.selectEntriesButton}
                    </STButton>
                    <span>{labels.selectedEntriesSummary(totalSelectedEntries)}</span>
                  </div>
                )}
                <label className="checkbox_label">
                  <input
                    type="checkbox"
                    checked={settings.contextToSend.suggestedEntries}
                    onChange={(e) => updateContextToSend('suggestedEntries', e.target.checked)}
                  />
                  {labels.existingSuggestionsLabel}
                </label>
              </div>
            </div>
            <div className="card">
              <label>
                {labels.maxContextLabel}
                <select
                  className="text_pole"
                  title={labels.maxContextLabel}
                  value={settings.maxContextType}
                  onChange={(e) => updateSetting('maxContextType', e.target.value as any)}
                >
                  <option value="profile">{labels.maxContextOptions.profile}</option>
                  <option value="sampler">{labels.maxContextOptions.sampler}</option>
                  <option value="custom">{labels.maxContextOptions.custom}</option>
                </select>
              </label>
              {settings.maxContextType === 'custom' && (
                <label style={{ marginTop: '10px' }}>
                  <input
                    type="number"
                    className="text_pole"
                    min="1"
                    step="1"
                    placeholder={labels.maxContextPlaceholder}
                    value={settings.maxContextValue}
                    onChange={(e) => updateSetting('maxContextValue', parseInt(e.target.value) || 2048)}
                  />
                </label>
              )}
              <label style={{ display: 'block', marginTop: '10px' }}>
                {labels.maxResponseTokensLabel}
                <input
                  type="number"
                  className="text_pole"
                  min="1"
                  step="1"
                  placeholder={labels.maxResponseTokensPlaceholder}
                  value={settings.maxResponseToken}
                  onChange={(e) => updateSetting('maxResponseToken', parseInt(e.target.value) || 256)}
                />
              </label>
            </div>
          </div>
          <div className="wide-column">
            <div className="card">
              <h3>{labels.promptSectionTitle}</h3>
              <STPresetSelect
                label={labels.promptPresetLabel}
                items={promptPresetItems}
                value={settings.promptPreset}
                readOnlyValues={['default']}
                onChange={(newValue) => updateSetting('promptPreset', newValue ?? 'default')}
                onItemsChange={(newItems) => {
                  const newPresets = newItems.reduce(
                    (acc, item) => {
                      acc[item.value] = settings.promptPresets[item.value] ?? { content: '' };
                      return acc;
                    },
                    {} as Record<string, { content: string }>,
                  );
                  updateSetting('promptPresets', newPresets);
                }}
                enableCreate
                enableRename
                enableDelete
              />
              <STTextarea
                value={settings.promptPresets[settings.promptPreset]?.content ?? ''}
                onChange={(e) => {
                  const newPresets = { ...settings.promptPresets };
                  if (newPresets[settings.promptPreset]) {
                    newPresets[settings.promptPreset].content = e.target.value;
                    updateSetting('promptPresets', newPresets);
                  }
                }}
                placeholder={labels.promptPlaceholder}
                rows={4}
                style={{ marginTop: '5px', width: '100%' }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
                {!lastError ? (
                  <STButton
                    onClick={() => handleGeneration()}
                    disabled={isGenerating}
                    className="menu_button interactable"
                  >
                    {isGenerating ? labels.generatingButton : labels.sendPromptButton}
                  </STButton>
                ) : (
                  <STButton
                    onClick={() => handleGeneration()}
                    disabled={isGenerating}
                    className="menu_button interactable"
                    title={lastError}
                  >
                    <i className="fa-solid fa-rotate-right"></i> {labels.retryButton}
                  </STButton>
                )}
              </div>
              {lastError && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'var(--black30a)', borderRadius: '5px', border: '1px solid var(--red)' }}>
                  <p style={{ margin: '0', color: 'var(--SmartThemeBodyColor)', fontSize: '0.9em', wordBreak: 'break-word' }}>
                    <strong style={{ color: 'var(--red)' }}>错误:</strong> {lastError}
                  </p>
                </div>
              )}
            </div>
            <div className="card">
              <h3>{labels.suggestedEntriesTitle}</h3>
              <div className="actions">
                <STButton
                  onClick={handleAddAll}
                  disabled={isGenerating || suggestedEntriesList.length === 0}
                  className="menu_button interactable"
                >
                  {labels.addAllButton}
                </STButton>
                <STButton
                  onClick={() => setIsGlobalReviseOpen(true)}
                  disabled={isGenerating}
                  className="menu_button interactable"
                  title={labels.globalReviseTooltip}
                >
                  <i className="fa-solid fa-comments"></i> {labels.globalReviseButton}
                </STButton>
                <STButton
                  onClick={() => setIsImporting(true)}
                  disabled={isGenerating}
                  className="menu_button interactable"
                  title={labels.importEntryTooltip}
                >
                  {labels.importEntryButton}
                </STButton>
                <STButton onClick={handleReset} disabled={isGenerating} className="menu_button interactable">
                  {labels.resetButton}
                </STButton>
              </div>
              <div>
                {suggestedEntriesList.length === 0 && <p>{labels.emptyStateMessage}</p>}
                {suggestedEntriesList.map(({ worldName, entry }) => (
                  <SuggestedEntry
                    key={`${worldName}-${entry.uid}-${entry.comment}`}
                    initialWorldName={worldName}
                    entry={entry}
                    allWorldNames={allWorldNames}
                    existingEntry={entriesGroupByWorldName[worldName]?.find((e) => e.uid === entry.uid)}
                    sessionRegexIds={session.regexIds}
                    onAdd={handleAddSingleEntry}
                    onRemove={handleRemoveEntry}
                    onContinue={handleGeneration}
                    onUpdate={handleUpdateEntry}
                    entriesGroupByWorldName={entriesGroupByWorldName}
                    sessionForContext={session}
                    contextToSend={settings.contextToSend}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isSelectingEntries && (
        <Popup
          type={POPUP_TYPE.CONFIRM}
          content={
            <SelectEntriesPopup
              ref={selectEntriesPopupRef}
              entriesByWorldName={entriesForSelectionPopup}
              initialSelectedUids={session.selectedEntryUids}
              title={labels.selectEntriesDialogTitle}
            />
          }
          onComplete={(confirmed) => {
            if (confirmed && selectEntriesPopupRef.current) {
              const newSelection = selectEntriesPopupRef.current.getSelection();
              setSession((prev) => ({ ...prev, selectedEntryUids: newSelection }));
            }
            setIsSelectingEntries(false);
          }}
          options={{ wide: true }}
        />
      )}
      {isImporting && (
        <Popup
          type={POPUP_TYPE.CONFIRM}
          content={
            <SelectEntriesPopup
              ref={importPopupRef}
              entriesByWorldName={entriesGroupByWorldName}
              initialSelectedUids={{}}
              title={labels.importEntriesDialogTitle}
            />
          }
          onComplete={(confirmed) => {
            if (confirmed && importPopupRef.current) {
              const selection = importPopupRef.current.getSelection();
              handleImportEntries(selection);
            }
            setIsImporting(false);
          }}
          options={{ wide: true }}
        />
      )}
      {isGlobalReviseOpen && (
        <Popup
          type={POPUP_TYPE.DISPLAY}
          content={
            <ReviseSessionManager
              target={{ type: 'global' }}
              initialState={entriesForGlobalRevise}
              onClose={() => setIsGlobalReviseOpen(false)}
              onApply={handleApplyGlobalRevise}
              sessionForContext={session}
              allEntries={entriesGroupByWorldName}
              contextToSend={settings.contextToSend}
            />
          }
          onComplete={() => setIsGlobalReviseOpen(false)}
          options={{ wide: true, large: true }}
        />
      )}
    </>
  );
};
