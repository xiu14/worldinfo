import { FC, useMemo, useState } from 'react';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { CompareStatePopup } from './CompareStatePopup.js';
import { SupportedLanguage, settingsManager } from '../settings.js';

type CurrentStateLabels = {
  titleCurrent: string;
  titleCompare: string;
  compareCheckbox: string;
  fieldName: string;
  fieldTriggers: string;
  fieldContent: string;
  emptyValue: string;
};

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const CURRENT_STATE_LABELS: Record<SupportedLanguage, CurrentStateLabels> = {
  en: {
    titleCurrent: 'Current Entry State',
    titleCompare: 'Comparing with Original State',
    compareCheckbox: 'Compare with Original',
    fieldName: 'Name',
    fieldTriggers: 'Triggers',
    fieldContent: 'Content',
    emptyValue: 'empty',
  },
  'zh-CN': {
    titleCurrent: '当前条目状态',
    titleCompare: '与原始状态对比',
    compareCheckbox: '与原始状态对比',
    fieldName: '名称',
    fieldTriggers: '触发词',
    fieldContent: '内容',
    emptyValue: '空',
  },
};

interface CurrentStatePopupProps {
  currentState: WIEntry;
  initialState: WIEntry;
}

export const CurrentStatePopup: FC<CurrentStatePopupProps> = ({ currentState, initialState }) => {
  const settings = settingsManager.getSettings();
  const language: SupportedLanguage = (settings?.language ?? DEFAULT_LANGUAGE) as SupportedLanguage;
  const labels = CURRENT_STATE_LABELS[language] ?? CURRENT_STATE_LABELS[DEFAULT_LANGUAGE];

  const [showDiff, setShowDiff] = useState(false);

  const fields = useMemo(
    () => [
      { label: labels.fieldName, value: currentState.comment },
      { label: labels.fieldTriggers, value: currentState.key.join(', ') },
      { label: labels.fieldContent, value: currentState.content },
    ],
    [currentState, labels],
  );

  return (
    <div className="current-state-popup">
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
          <CompareStatePopup sessionType="entry" before={initialState} after={currentState} />
        ) : (
          fields.map(({ label, value }) => (
            <div key={label} className="state-field">
              <label>{label}</label>
              <div className="state-value">
                {value || <span className="subtle-text">{labels.emptyValue}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
