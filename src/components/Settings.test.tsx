import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmMock, echoMock, getSettingsState, resetSettingsState, saveSettingsMock } = vi.hoisted(() => {
  const confirmMock = vi.fn().mockResolvedValue(false);
  const echoMock = vi.fn();
  const saveSettingsMock = vi.fn();

  const baseSettings = {
    version: '1.0.0',
    formatVersion: 'F_1.5',
    profileId: '',
    maxContextType: 'profile' as const,
    maxContextValue: 16384,
    maxResponseToken: 1024,
    contextToSend: {
      stDescription: true,
      messages: {
        type: 'all' as const,
        first: 10,
        last: 10,
        range: {
          start: 0,
          end: 10,
        },
      },
      charCard: true,
      authorNote: true,
      worldInfo: true,
      suggestedEntries: true,
    },
    defaultPromptEngineeringMode: 'native' as const,
    language: 'en' as const,
    prompts: {
      systemPrompt: {
        label: 'System Prompt',
        content: 'Default system prompt',
        isDefault: true,
      },
    },
    promptPreset: 'default',
    promptPresets: {
      default: {
        content: '',
      },
    },
    mainContextTemplatePreset: 'default',
    mainContextTemplatePresets: {
      default: {
        prompts: [
          {
            promptName: 'systemPrompt',
            enabled: true,
            role: 'system' as const,
          },
        ],
      },
    },
  };

  let settingsState = structuredClone(baseSettings);

  (globalThis as any).SillyTavern = {
    getContext: () => ({
      Popup: {
        show: {
          confirm: confirmMock,
        },
      },
    }),
  };

  return {
    confirmMock,
    echoMock,
    saveSettingsMock,
    getSettingsState: () => settingsState,
    resetSettingsState: () => {
      settingsState = structuredClone(baseSettings);
    },
  };
});

vi.mock('sillytavern-utils-lib/config', () => ({
  st_echo: echoMock,
}));

vi.mock('sillytavern-utils-lib/components/react', () => ({
  STButton: ({ children, onClick, title, className }: any) => (
    <button type="button" onClick={onClick} title={title} className={className}>
      {children}
    </button>
  ),
  STPresetSelect: ({ label, items, value, onChange }: any) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {items.map((item: any) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  ),
  STSortableList: ({ items }: any) => (
    <ul>
      {items.map((item: any) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  ),
  STTextarea: ({ value, onChange, ...rest }: any) => <textarea value={value} onChange={onChange} {...rest} />,
}));

vi.mock('../settings.js', () => {
  const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const;
  const DEFAULT_PROMPT_CONTENTS = {
    systemPrompt: 'Default system prompt',
  };

  const defaultPreset = {
    prompts: [
      {
        promptName: 'systemPrompt',
        enabled: true,
        role: 'system' as const,
      },
    ],
  };

  return {
    SUPPORTED_LANGUAGES: [...SUPPORTED_LANGUAGES],
    settingsManager: {
      getSettings: getSettingsState,
      saveSettings: saveSettingsMock,
      resetSettings: () => {
        resetSettingsState();
      },
    },
    DEFAULT_PROMPT_CONTENTS,
    DEFAULT_SETTINGS: {
      mainContextTemplatePresets: {
        default: structuredClone(defaultPreset),
      },
    },
    SYSTEM_PROMPT_KEYS: ['systemPrompt'],
    convertToVariableName: (value: string) => value.replace(/\s+/g, ''),
  };
});

import { WorldInfoRecommenderSettings } from './Settings.js';

describe('WorldInfoRecommenderSettings - language select', () => {
  beforeEach(() => {
    resetSettingsState();
    echoMock.mockClear();
    confirmMock.mockClear();
    saveSettingsMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the language select dropdown with the current language', () => {
    render(<WorldInfoRecommenderSettings />);

    const select = screen.getByRole('combobox', { name: /Language/ });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('en');
  });

  it('switches language when selecting from dropdown', () => {
    render(<WorldInfoRecommenderSettings />);

    const select = screen.getByRole('combobox', { name: /Language/ });
    fireEvent.change(select, { target: { value: 'zh-CN' } });

    expect(getSettingsState().language).toBe('zh-CN');
    expect(saveSettingsMock).toHaveBeenCalled();
    expect(echoMock).toHaveBeenCalledWith('info', '已切换为 中文');
  });
});
