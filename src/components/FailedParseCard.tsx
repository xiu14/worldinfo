import { FC, useState } from 'react';
import { FailedParseRecord } from '../xml.js';
import { STButton } from 'sillytavern-utils-lib/components/react';
import { st_echo } from 'sillytavern-utils-lib/config';

interface FailedParseCardLabels {
    title: string;
    errorLabel: string;
    timestampLabel: string;
    viewRawContent: string;
    hideRawContent: string;
    copyButton: string;
    copySuccess: string;
    removeButton: string;
    partialSuccessInfo: (count: number) => string;
}

const LABELS: Record<'en' | 'zh-CN', FailedParseCardLabels> = {
    en: {
        title: '⚠️ Parse Failed - Raw Content Saved',
        errorLabel: 'Error:',
        timestampLabel: 'Time:',
        viewRawContent: 'View Raw Content',
        hideRawContent: 'Hide Raw Content',
        copyButton: 'Copy',
        copySuccess: 'Copied to clipboard!',
        removeButton: 'Clear Record',
        partialSuccessInfo: (count: number) => `${count} entries partially recovered`,
    },
    'zh-CN': {
        title: '⚠️ 解析失败 - 已保留原始内容',
        errorLabel: '错误信息:',
        timestampLabel: '时间:',
        viewRawContent: '查看原始内容',
        hideRawContent: '隐藏原始内容',
        copyButton: '复制',
        copySuccess: '已复制到剪贴板！',
        removeButton: '清除此记录',
        partialSuccessInfo: (count: number) => `已部分恢复 ${count} 个条目`,
    },
};

interface FailedParseCardProps {
    record: FailedParseRecord;
    language: 'en' | 'zh-CN';
    onRemove: (id: string) => void;
}

export const FailedParseCard: FC<FailedParseCardProps> = ({
    record,
    language,
    onRemove,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const labels = LABELS[language] || LABELS['en'];

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(record.rawContent);
            st_echo('success', labels.copySuccess);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const formatTimestamp = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US');
        } catch {
            return isoString;
        }
    };

    const partialCount = record.partialEntries
        ? Object.values(record.partialEntries).flat().length
        : 0;

    return (
        <div className="failed-parse-card">
            <div className="failed-parse-card__header">
                <span className="failed-parse-card__title">{labels.title}</span>
            </div>

            <div className="failed-parse-card__body">
                <div className="failed-parse-card__info-row">
                    <span className="failed-parse-card__label">{labels.errorLabel}</span>
                    <span className="failed-parse-card__value failed-parse-card__error">
                        {record.errorMessage}
                    </span>
                </div>

                <div className="failed-parse-card__info-row">
                    <span className="failed-parse-card__label">{labels.timestampLabel}</span>
                    <span className="failed-parse-card__value">{formatTimestamp(record.timestamp)}</span>
                </div>

                {partialCount > 0 && (
                    <div className="failed-parse-card__info-row">
                        <span className="failed-parse-card__partial-info">
                            ✓ {labels.partialSuccessInfo(partialCount)}
                        </span>
                    </div>
                )}

                <div className="failed-parse-card__actions">
                    <STButton
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="menu_button interactable"
                    >
                        <i className={isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'}></i>
                        {isExpanded ? labels.hideRawContent : labels.viewRawContent}
                    </STButton>
                    <STButton onClick={handleCopy} className="menu_button interactable">
                        <i className="fa-solid fa-copy"></i>
                        {labels.copyButton}
                    </STButton>
                    <STButton
                        onClick={() => onRemove(record.id)}
                        className="menu_button interactable danger_button"
                    >
                        <i className="fa-solid fa-trash"></i>
                        {labels.removeButton}
                    </STButton>
                </div>

                {isExpanded && (
                    <div className="failed-parse-card__raw-content">
                        <textarea
                            value={record.rawContent}
                            readOnly={true}
                            rows={15}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
