import { FC, useState } from 'react';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { CompareStatePopup } from './CompareStatePopup.js';
import { SupportedLanguage, settingsManager } from '../settings.js';

type GlobalStateLabels = {
  titleCurrent: string;
  titleCompare: string;
  compareCheckbox: string;
  noEntries: string;
  fieldName: string;
  fieldTriggers: string;
  fieldContent: string;
  emptyValue: string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const GLOBAL_STATE_LABELS: Record<SupportedLanguage, GlobalStateLabels> = {
  en: {
    titleCurrent: 'Current Suggested Entries',
    titleCompare: 'Comparing with Original State',
    compareCheckbox: 'Compare with Original',
    noEntries: 'No entries in this world.',
    fieldName: 'Name',
    fieldTriggers: 'Triggers',
    fieldContent: 'Content',
    emptyValue: 'empty',
  },
  'zh-CN': {
    titleCurrent: '当前建议条目',
    titleCompare: '与原始状态对比',
    compareCheckbox: '与原始状态对比',
    noEntries: '此世界书中无条目。',
    fieldName: '名称',
    fieldTriggers: '触发词',
    fieldContent: '内容',
    emptyValue: '空',
  },
};

interface GlobalStatePopupProps {
  currentState: Record<string, WIEntry[]>;
  initialState: Record<string, WIEntry[]>;
}

export const GlobalStatePopup: FC<GlobalStatePopupProps> = ({ currentState, initialState }) => {
  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = GLOBAL_STATE_LABELS[language] ?? GLOBAL_STATE_LABELS[DEFAULT_LANGUAGE];

  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="current-state-popup global-state-popup">
      <div className="popup_header">
        <h3>{showDiff ? labels.titleCompare : labels.titleCurrent}</h3>
        <div className="popup_header_buttons">
          <label className="checkbox_label">
            <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
            {labels.compareCheckbox}
          </label>
        </div>
      </div>

      <div className="current-state-content">
        {showDiff ? (
          <CompareStatePopup sessionType="global" before={initialState} after={currentState} />
        ) : (
          Object.entries(currentState).map(([worldName, entries]) => (
            <div key={worldName} className="world-group">
              <h4>{worldName}</h4>
              {entries.length === 0 ? (
                <p className="subtle-text">{labels.noEntries}</p>
              ) : (
                entries.map((entry) => (
                  <div key={entry.uid} className="state-field-group">
                    <div className="state-field">
                      <label>{labels.fieldName}</label>
                      <div className="state-value">
                        {entry.comment || <span className="subtle-text">{labels.emptyValue}</span>}
                      </div>
                    </div>
                    <div className="state-field">
                      <label>{labels.fieldTriggers}</label>
                      <div className="state-value">
                        {(entry.key || []).join(', ') || <span className="subtle-text">{labels.emptyValue}</span>}
                      </div>
                    </div>
                    <div className="state-field">
                      <label>{labels.fieldContent}</label>
                      <div className="state-value">
                        {entry.content || <span className="subtle-text">{labels.emptyValue}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
