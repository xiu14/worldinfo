import React, { FC, useState, useMemo, useCallback } from 'react';
import { st_echo } from 'sillytavern-utils-lib/config';
import {
  PresetItem,
  SortableListItemData,
  STButton,
  STPresetSelect,
  STSortableList,
  STTextarea,
} from 'sillytavern-utils-lib/components/react';

import {
  convertToVariableName,
  DEFAULT_PROMPT_CONTENTS,
  DEFAULT_SETTINGS,
  DirectApiType,
  ExtensionSettings,
  MainContextPromptBlock,
  MainContextTemplatePreset,
  MessageRole,
  PromptSetting,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  settingsManager,
  SYSTEM_PROMPT_KEYS,
} from '../settings.js';
import { useForceUpdate } from '../hooks/useForceUpdate.js';
import { testDirectApiConnection } from '../direct-api.js';

type UILabels = {
  languageLabel: string;
  languageDescription: string;
  languageToggleButtonLabel: (languageLabel: string) => string;
  languageToggleButtonTooltip: string;
  languageSwitched: (languageLabel: string) => string;
  mainContextTitle: string;
  restoreMainContextTooltip: string;
  restoreMainContextConfirmTitle: string;
  restoreMainContextConfirmMessage: string;
  mainContextTemplateLabel: string;
  promptTemplatesTitle: string;
  restorePromptTooltip: string;
  promptLabel: string;
  restorePromptConfirmTitle: string;
  restorePromptConfirmMessage: (promptLabel: string) => string;
  promptEditorPlaceholder: string;
  resetEverythingButton: string;
  resetEverythingConfirmTitle: string;
  resetEverythingConfirmMessage: string;
  resetEverythingSuccess: string;
  noPromptSelectedWarning: string;
  // Direct API strings
  directApiTitle: string;
  directApiEnabled: string;
  directApiType: string;
  directApiUrl: string;
  directApiKey: string;
  directApiModel: string;
  directApiTest: string;
  directApiTestSuccess: string;
  directApiTestFail: string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  'zh-CN': '中文',
};

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = SUPPORTED_LANGUAGES.map((lang) => ({
  value: lang,
  label: LANGUAGE_LABELS[lang],
}));

const UI_STRINGS: Record<SupportedLanguage, UILabels> = {
  en: {
    languageLabel: 'Language',
    languageDescription: 'Choose the language for the extension interface.',
    languageToggleButtonLabel: (languageLabel: string) => `Language: ${languageLabel}`,
    languageToggleButtonTooltip: 'Switch interface language',
    languageSwitched: (languageLabel: string) => `Language switched to ${languageLabel}.`,
    mainContextTitle: 'Main Context Template',
    restoreMainContextTooltip: 'Restore main context template to default',
    restoreMainContextConfirmTitle: 'Restore default',
    restoreMainContextConfirmMessage: 'Are you sure?',
    mainContextTemplateLabel: 'Template',
    promptTemplatesTitle: 'Prompt Templates',
    restorePromptTooltip: 'Restore selected prompt to default',
    promptLabel: 'Prompt',
    restorePromptConfirmTitle: 'Restore default',
    restorePromptConfirmMessage: (promptLabel: string) => `Restore default for "${promptLabel}"?`,
    promptEditorPlaceholder: 'Edit the selected system prompt template here...',
    resetEverythingButton: 'I messed up, reset everything',
    resetEverythingConfirmTitle: 'Reset Everything',
    resetEverythingConfirmMessage: 'Are you sure? This cannot be undone.',
    resetEverythingSuccess: 'Settings reset. The UI has been updated.',
    noPromptSelectedWarning: 'No prompt selected.',
    // Direct API strings
    directApiTitle: 'Direct API Configuration',
    directApiEnabled: 'Use Direct API (bypass Connection Manager)',
    directApiType: 'API Format',
    directApiUrl: 'API URL',
    directApiKey: 'API Key / Token',
    directApiModel: 'Model Name',
    directApiTest: 'Test Connection',
    directApiTestSuccess: 'Connection successful!',
    directApiTestFail: 'Connection failed',
  },
  'zh-CN': {
    languageLabel: '语言',
    languageDescription: '切换界面语言',
    languageToggleButtonLabel: (languageLabel: string) => `语言：${languageLabel}`,
    languageToggleButtonTooltip: '切换界面语言',
    languageSwitched: (languageLabel: string) => `已切换为 ${languageLabel}`,
    mainContextTitle: '主要上下文模板',
    restoreMainContextTooltip: '恢复默认',
    restoreMainContextConfirmTitle: '恢复默认',
    restoreMainContextConfirmMessage: '确定要恢复默认设置吗？',
    mainContextTemplateLabel: '模板',
    promptTemplatesTitle: '提示词模板',
    restorePromptTooltip: '恢复默认',
    promptLabel: '提示词',
    restorePromptConfirmTitle: '恢复默认',
    restorePromptConfirmMessage: (promptLabel: string) => `确定要恢复“${promptLabel}”为默认值吗？`,
    promptEditorPlaceholder: '在此编辑所选系统提示词模板...',
    resetEverythingButton: '重置所有设置',
    resetEverythingConfirmTitle: '全部重置',
    resetEverythingConfirmMessage: '确定要重置所有设置吗？此操作无法撤销。',
    resetEverythingSuccess: '设置已重置，界面已更新。',
    noPromptSelectedWarning: '未选择任何提示词。',
    // Direct API strings
    directApiTitle: '直接 API 配置',
    directApiEnabled: '使用直接 API（绕过 Connection Manager）',
    directApiType: 'API 格式',
    directApiUrl: 'API 地址',
    directApiKey: 'API Key / Token',
    directApiModel: '模型名称',
    directApiTest: '测试连接',
    directApiTestSuccess: '连接成功！',
    directApiTestFail: '连接失败',
  },
};

const isSupportedLanguage = (value: string): value is SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);

const globalContext = SillyTavern.getContext();

/**
 * A React component to manage the World Info Recommender settings UI.
 * This component replaces the vanilla TS setup script.
 */
export const WorldInfoRecommenderSettings: FC = () => {
  // --- State Management ---
  const forceUpdate = useForceUpdate();
  const settings = settingsManager.getSettings();

  // Debug logging
  console.log('[WorldInfoRecommender] Settings loaded:', {
    hasSettings: !!settings,
    language: settings?.language,
    hasPrompts: !!settings?.prompts,
  });

  if (!settings) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: Settings not loaded</div>;
  }

  const selectedLanguage = isSupportedLanguage(settings.language) ? settings.language : DEFAULT_LANGUAGE;
  const t = UI_STRINGS[selectedLanguage] ?? UI_STRINGS[DEFAULT_LANGUAGE];
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<string>(SYSTEM_PROMPT_KEYS[0]);

  // Centralized function to update state and persist settings
  const updateAndRefresh = useCallback(
    (updater: (currentSettings: ExtensionSettings) => void) => {
      const currentSettings = settingsManager.getSettings();
      updater(currentSettings);
      settingsManager.saveSettings();
      forceUpdate();
    },
    [forceUpdate],
  );

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    if (!isSupportedLanguage(newValue) || newValue === settings.language) {
      return;
    }
    updateAndRefresh((s) => {
      s.language = newValue;
    });
    const languageLabel = LANGUAGE_LABELS[newValue];
    const languageStrings = UI_STRINGS[newValue] ?? t;
    st_echo('info', languageStrings.languageSwitched(languageLabel));
  };

  // --- Derived Data for UI (Memoized for performance) ---
  const mainContextPresetItems = useMemo(
    (): PresetItem[] =>
      Object.keys(settings.mainContextTemplatePresets).map((key) => ({
        value: key,
        label: key,
      })),
    [settings.mainContextTemplatePresets],
  );

  const systemPromptItems = useMemo(
    (): PresetItem[] =>
      Object.keys(settings.prompts).map((key) => {
        const prompt = settings.prompts[key as keyof typeof settings.prompts];
        return {
          value: key,
          label: prompt ? `${prompt.label} (${key})` : key,
        };
      }),
    [settings.prompts],
  );

  const mainContextListItems = useMemo((): SortableListItemData[] => {
    const preset = settings.mainContextTemplatePresets[settings.mainContextTemplatePreset];
    if (!preset) return [];
    return preset.prompts.map((prompt) => {
      const promptSetting = settings.prompts[prompt.promptName as keyof typeof settings.prompts];
      const label = promptSetting ? `${promptSetting.label} (${prompt.promptName})` : prompt.promptName;
      return {
        id: prompt.promptName,
        label,
        enabled: prompt.enabled,
        selectValue: prompt.role,
        selectOptions: [
          { value: 'user', label: 'User' },
          { value: 'assistant', label: 'Assistant' },
          { value: 'system', label: 'System' },
        ],
      };
    });
  }, [settings.mainContextTemplatePreset, settings.mainContextTemplatePresets, settings.prompts]);

  // --- Handlers for Main Context Template ---
  const handleMainContextPresetChange = (newValue?: string) => {
    updateAndRefresh((s) => {
      s.mainContextTemplatePreset = newValue ?? 'default';
    });
  };

  const handleMainContextPresetsChange = (newItems: PresetItem[]) => {
    updateAndRefresh((s) => {
      const newPresets: Record<string, MainContextTemplatePreset> = {};
      const oldPresets = s.mainContextTemplatePresets;
      newItems.forEach((item) => {
        newPresets[item.value] =
          oldPresets[item.value] ?? structuredClone(oldPresets[s.mainContextTemplatePreset] ?? oldPresets['default']);
      });
      s.mainContextTemplatePresets = newPresets;
    });
  };

  const handleMainContextListChange = (newListItems: SortableListItemData[]) => {
    updateAndRefresh((s) => {
      const newPrompts: MainContextPromptBlock[] = newListItems.map((item) => ({
        promptName: item.id,
        enabled: item.enabled,
        role: (item.selectValue as MessageRole) ?? 'user',
      }));

      //  Create a new preset object and a new presets object
      // instead of mutating the existing one. This ensures useMemo detects the change.
      const updatedPreset = {
        ...s.mainContextTemplatePresets[s.mainContextTemplatePreset],
        prompts: newPrompts,
      };

      s.mainContextTemplatePresets = {
        ...s.mainContextTemplatePresets,
        [s.mainContextTemplatePreset]: updatedPreset,
      };
    });
  };

  const handleRestoreMainContextDefault = async () => {
    const confirm = await globalContext.Popup.show.confirm(
      t.restoreMainContextConfirmTitle,
      t.restoreMainContextConfirmMessage,
    );
    if (!confirm) return;

    updateAndRefresh((s) => {
      // Create a new presets object instead of mutating a property on the old one.
      s.mainContextTemplatePresets = {
        ...s.mainContextTemplatePresets,
        default: structuredClone(DEFAULT_SETTINGS.mainContextTemplatePresets['default']),
      };
      s.mainContextTemplatePreset = 'default';
    });
  };

  // --- Handlers for System Prompts ---
  const handleSystemPromptsChange = (newItems: PresetItem[]) => {
    updateAndRefresh((s) => {
      const newPrompts: Record<string, PromptSetting> = {};
      const oldPrompts = s.prompts;
      const oldKeys = Object.keys(oldPrompts);
      const newKeys = newItems.map((item) => item.value);

      // Rebuild the prompts list from newItems
      newKeys.forEach((key) => {
        newPrompts[key] = oldPrompts[key] ?? { content: '', isDefault: false, label: key };
      });

      // @ts-ignore
      s.prompts = newPrompts; // This part is correct and immutable.

      // Identify deleted prompts
      const deletedKeys = oldKeys.filter((key) => !newKeys.includes(key));
      if (deletedKeys.length > 0) {
        //  Create a new main context presets object with updated prompt arrays.
        const updatedPresets = Object.fromEntries(
          Object.entries(s.mainContextTemplatePresets).map(([presetName, preset]) => [
            presetName,
            {
              ...preset,
              prompts: preset.prompts.filter((p) => !deletedKeys.includes(p.promptName)),
            },
          ]),
        );
        s.mainContextTemplatePresets = updatedPresets;
      }
    });
  };

  const handleSystemPromptCreate = (value: string) => {
    const variableName = convertToVariableName(value);
    if (!variableName) {
      st_echo('error', `Invalid prompt name: ${value}`);
      return { confirmed: false };
    }
    if (settings.prompts[variableName]) {
      st_echo('error', `Prompt name already exists: ${variableName}`);
      return { confirmed: false };
    }

    updateAndRefresh((s) => {
      // Create a new prompts object.
      s.prompts = {
        ...s.prompts,
        [variableName]: {
          content: s.prompts[selectedSystemPrompt as keyof typeof s.prompts]?.content ?? '',
          isDefault: false,
          label: value,
        },
      };

      // Create a new presets object where each preset has a new, updated prompts array.
      s.mainContextTemplatePresets = Object.fromEntries(
        Object.entries(s.mainContextTemplatePresets).map(([presetName, preset]) => [
          presetName,
          {
            ...preset,
            prompts: [...preset.prompts, { enabled: true, promptName: variableName, role: 'user' }],
          },
        ]),
      );
    });
    setSelectedSystemPrompt(variableName);
    return { confirmed: true, value: variableName };
  };

  const handleSystemPromptRename = (oldValue: string, newValue: string) => {
    const variableName = convertToVariableName(newValue);
    if (!variableName) {
      st_echo('error', `Invalid prompt name: ${newValue}`);
      return { confirmed: false };
    }
    if (settings.prompts[variableName]) {
      st_echo('error', `Prompt name already exists: ${variableName}`);
      return { confirmed: false };
    }

    updateAndRefresh((s) => {
      // Create a new prompts object by removing the old key and adding the new one.
      const { [oldValue]: renamedPrompt, ...restPrompts } = s.prompts;
      // @ts-ignore
      s.prompts = {
        ...restPrompts,
        [variableName]: { ...renamedPrompt, label: newValue },
      };

      // Create a new presets object with updated prompt names.
      s.mainContextTemplatePresets = Object.fromEntries(
        Object.entries(s.mainContextTemplatePresets).map(([presetName, preset]) => [
          presetName,
          {
            ...preset,
            prompts: preset.prompts.map((p) => (p.promptName === oldValue ? { ...p, promptName: variableName } : p)),
          },
        ]),
      );
    });
    setSelectedSystemPrompt(variableName);
    return { confirmed: true, value: variableName };
  };

  const handleSystemPromptContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    updateAndRefresh((s) => {
      const prompt = s.prompts[selectedSystemPrompt as keyof typeof s.prompts];
      if (prompt) {
        // Create a new prompts object with an updated prompt object.
        s.prompts = {
          ...s.prompts,
          [selectedSystemPrompt]: {
            ...prompt,
            content: newContent,
            isDefault: SYSTEM_PROMPT_KEYS.includes(selectedSystemPrompt as any)
              ? DEFAULT_PROMPT_CONTENTS[selectedSystemPrompt as keyof typeof DEFAULT_PROMPT_CONTENTS] === newContent
              : false,
          },
        };
      }
    });
  };

  const handleRestoreSystemPromptDefault = async () => {
    const prompt = settings.prompts[selectedSystemPrompt as keyof typeof settings.prompts];
    if (!prompt) return st_echo('warning', t.noPromptSelectedWarning);

    const confirm = await globalContext.Popup.show.confirm(
      t.restorePromptConfirmTitle,
      t.restorePromptConfirmMessage(prompt.label),
    );
    if (confirm) {
      updateAndRefresh((s) => {
        // Create a new prompts object with the restored content.
        s.prompts = {
          ...s.prompts,
          [selectedSystemPrompt]: {
            ...s.prompts[selectedSystemPrompt as keyof typeof s.prompts],
            content: DEFAULT_PROMPT_CONTENTS[selectedSystemPrompt as keyof typeof DEFAULT_PROMPT_CONTENTS],
          },
        };
      });
    }
  };

  // --- Reset Handler ---
  const handleResetEverything = async () => {
    const confirm = await globalContext.Popup.show.confirm(
      t.resetEverythingConfirmTitle,
      t.resetEverythingConfirmMessage,
    );
    if (confirm) {
      settingsManager.resetSettings(); // This saves automatically
      // forceUpdate is sufficient here because the next render will get a completely new settings object.
      forceUpdate();
      st_echo('success', t.resetEverythingSuccess);
    }
  };

  const selectedPromptContent = settings.prompts[selectedSystemPrompt as keyof typeof settings.prompts]?.content ?? '';
  // @ts-ignore
  const isDefaultSystemPromptSelected = SYSTEM_PROMPT_KEYS.includes(selectedSystemPrompt);

  return (
    <div className="world-info-recommender-settings">
      <div className="settings-language" style={{ marginTop: '10px' }}>
        <label htmlFor="world-info-recommender-language-select">{t.languageLabel}</label>
        <select
          id="world-info-recommender-language-select"
          className="settings-language__select"
          value={selectedLanguage}
          onChange={handleLanguageChange}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="settings-language__description">{t.languageDescription}</p>
      </div>

      {/* Direct API Configuration */}
      <div style={{ marginTop: '15px', padding: '10px', border: '1px solid var(--SmartThemeBorderColor)', borderRadius: '5px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>{t.directApiTitle}</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={settings.directApi.enabled}
            onChange={(e) => {
              updateAndRefresh((s) => {
                s.directApi.enabled = e.target.checked;
              });
            }}
          />
          <span>{t.directApiEnabled}</span>
        </label>

        {settings.directApi.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ minWidth: '100px' }}>{t.directApiType}:</label>
              <select
                value={settings.directApi.apiType}
                onChange={(e) => {
                  updateAndRefresh((s) => {
                    s.directApi.apiType = e.target.value as DirectApiType;
                  });
                }}
                style={{ flex: 1 }}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="antigravity">Antigravity</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ minWidth: '100px' }}>{t.directApiUrl}:</label>
              <input
                type="text"
                value={settings.directApi.apiUrl}
                onChange={(e) => {
                  updateAndRefresh((s) => {
                    s.directApi.apiUrl = e.target.value;
                  });
                }}
                placeholder="https://api.example.com/v1"
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ minWidth: '100px' }}>{t.directApiKey}:</label>
              <input
                type="password"
                value={settings.directApi.apiKey}
                onChange={(e) => {
                  updateAndRefresh((s) => {
                    s.directApi.apiKey = e.target.value;
                  });
                }}
                placeholder="sk-..."
                style={{ flex: 1 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ minWidth: '100px' }}>{t.directApiModel}:</label>
              <input
                type="text"
                value={settings.directApi.modelName}
                onChange={(e) => {
                  updateAndRefresh((s) => {
                    s.directApi.modelName = e.target.value;
                  });
                }}
                placeholder="gpt-4 / gemini-pro / ..."
                style={{ flex: 1 }}
              />
            </div>

            <STButton
              style={{ marginTop: '5px' }}
              onClick={async () => {
                const result = await testDirectApiConnection(settings.directApi);
                if (result.success) {
                  st_echo('success', t.directApiTestSuccess);
                } else {
                  st_echo('error', `${t.directApiTestFail}: ${result.message}`);
                }
              }}
            >
              <i className="fa-solid fa-plug" style={{ marginRight: '5px' }} />
              {t.directApiTest}
            </STButton>
          </div>
        )}
      </div>

      <div style={{ marginTop: '10px' }}>
        <div className="title_restorable">
          <span>{t.mainContextTitle}</span>
          <div className="title_restorable_actions">
            <STButton
              title={t.restoreMainContextTooltip}
              onClick={handleRestoreMainContextDefault}
            >
              <i className="fa-solid fa-undo" />
            </STButton>
          </div>
        </div>
        <STPresetSelect
          label={t.mainContextTemplateLabel}
          items={mainContextPresetItems}
          value={settings.mainContextTemplatePreset}
          readOnlyValues={['default']}
          onChange={handleMainContextPresetChange}
          onItemsChange={handleMainContextPresetsChange}
          enableCreate
          enableRename
          enableDelete
        />
        <div style={{ marginTop: '5px' }}>
          <STSortableList
            items={mainContextListItems}
            onItemsChange={handleMainContextListChange}
            showSelectInput
            showToggleButton
          />
        </div>
      </div>

      <hr style={{ margin: '10px 0' }} />

      <div style={{ marginTop: '10px' }}>
        <div className="title_restorable">
          <span>{t.promptTemplatesTitle}</span>
          {isDefaultSystemPromptSelected && (
            <STButton
              title={t.restorePromptTooltip}
              onClick={handleRestoreSystemPromptDefault}
            >
              <i className="fa-solid fa-undo" />
            </STButton>
          )}
        </div>
        <STPresetSelect
          label={t.promptLabel}
          items={systemPromptItems}
          value={selectedSystemPrompt}
          readOnlyValues={SYSTEM_PROMPT_KEYS as string[]}
          onChange={(newValue) => setSelectedSystemPrompt(newValue ?? '')}
          onItemsChange={handleSystemPromptsChange}
          enableCreate
          enableRename
          enableDelete
          onCreate={handleSystemPromptCreate}
          onRename={handleSystemPromptRename}
        />
        <STTextarea
          value={selectedPromptContent}
          onChange={handleSystemPromptContentChange}
          placeholder={t.promptEditorPlaceholder}
          rows={6}
          style={{ marginTop: '5px', width: '100%' }}
        />
      </div>

      <hr style={{ margin: '15px 0' }} />

      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <STButton className="danger_button" style={{ width: 'auto' }} onClick={handleResetEverything}>
          <i style={{ marginRight: '10px' }} className="fa-solid fa-triangle-exclamation" />
          <span>{t.resetEverythingButton}</span>
        </STButton>
      </div>
    </div>
  );
};
