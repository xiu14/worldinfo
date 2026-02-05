import { XMLParser } from 'fast-xml-parser';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';

const parser = new XMLParser();

function createRandomNumber(length: number): number {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface XmlParseOptions {
  previousContent?: string;
}

/**
 * 解析失败记录
 */
export interface FailedParseRecord {
  id: string;
  timestamp: string;
  rawContent: string;
  errorMessage: string;
  partialEntries?: Record<string, WIEntry[]>;
}

/**
 * 解析结果（包含成功的条目和失败记录）
 */
export interface ParseResult {
  entries: Record<string, WIEntry[]>;
  failedRecord?: FailedParseRecord;
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 尝试从原始内容中提取单个 entry
 */
function tryParseEntry(entryContent: string): WIEntry | null {
  try {
    // 包装成完整的 XML 结构
    const wrappedXml = `<entry>${entryContent}</entry>`;
    const parsed = parser.parse(wrappedXml);
    const entry = parsed.entry;

    if (!entry || !entry.worldName) {
      return null;
    }

    return {
      uid: entry.id ?? createRandomNumber(6),
      key: entry.triggers?.split(',').map((t: string) => t.trim()) ?? [],
      content: entry.content ?? '',
      comment: entry.name ?? '',
      disable: false,
      keysecondary: [],
    };
  } catch {
    return null;
  }
}

/**
 * 从原始内容中提取世界名称
 */
function extractWorldName(entryContent: string): string | null {
  const match = entryContent.match(/<worldName>([^<]*)<\/worldName>/);
  return match ? match[1].trim() : null;
}

/**
 * 主解析函数 - 带容错能力
 * 尝试解析 XML，即使部分失败也会返回成功的条目
 */
export function parseXMLOwn(xml: string, options: XmlParseOptions = {}): ParseResult {
  let processedXml = xml;
  const { previousContent } = options;

  // Remove code blocks
  processedXml = processedXml.replace(/```xml/g, '').replace(/```/g, '');

  // Merge with previous content if exists
  if (previousContent) {
    processedXml = previousContent + processedXml.trimEnd();
  }

  const entriesByWorldName: Record<string, WIEntry[]> = {};

  // 首先尝试标准解析
  try {
    const rawResponse = parser.parse(processedXml);

    if (!rawResponse.lorebooks) {
      // 没有 lorebooks 标签
      // 检查原始内容是否有实际内容（非空白），如果有则视为解析失败
      const hasContent = processedXml.trim().length > 0;
      if (hasContent) {
        const failedRecord: FailedParseRecord = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          rawContent: processedXml,
          errorMessage: 'AI 返回的内容中没有找到有效的 lorebooks 标签',
        };
        return { entries: entriesByWorldName, failedRecord };
      }
      return { entries: entriesByWorldName };
    }

    const entries = rawResponse.lorebooks.entry?.content !== undefined
      ? [rawResponse.lorebooks.entry]
      : (Array.isArray(rawResponse.lorebooks.entry) ? rawResponse.lorebooks.entry : [rawResponse.lorebooks.entry]);

    for (const entry of entries) {
      if (!entry) continue;

      const worldName = entry.worldName;
      if (!worldName) {
        continue;
      }
      if (!entriesByWorldName[worldName]) {
        entriesByWorldName[worldName] = [];
      }
      entriesByWorldName[worldName].push({
        uid: entry.id ?? createRandomNumber(6),
        key: entry.triggers?.split(',').map((t: string) => t.trim()) ?? [],
        content: entry.content ?? '',
        comment: entry.name ?? '',
        disable: false,
        keysecondary: [],
      });
    }

    // 检查是否有任何有效条目
    const totalEntries = Object.values(entriesByWorldName).reduce((sum, arr) => sum + arr.length, 0);
    if (totalEntries === 0 && processedXml.trim().length > 0) {
      // 有内容但没有有效条目，创建 failedRecord
      console.warn('[WorldInfoRecommender] Parsed but no valid entries found, creating failedRecord');
      const failedRecord: FailedParseRecord = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        rawContent: processedXml,
        errorMessage: 'AI 返回的内容中没有找到有效的条目（缺少 worldName 或格式不正确）',
      };
      return { entries: entriesByWorldName, failedRecord };
    }

    return { entries: entriesByWorldName };
  } catch (standardError: any) {
    console.warn('[WorldInfoRecommender] Standard XML parse failed, trying partial recovery...', standardError.message);

    // 标准解析失败，尝试部分恢复
    const partialEntries: Record<string, WIEntry[]> = {};
    let successCount = 0;
    let failCount = 0;

    // 使用正则表达式提取所有 <entry>...</entry> 块
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(processedXml)) !== null) {
      const entryContent = match[1];
      const worldName = extractWorldName(entryContent);

      if (!worldName) {
        failCount++;
        continue;
      }

      const parsedEntry = tryParseEntry(entryContent);
      if (parsedEntry) {
        if (!partialEntries[worldName]) {
          partialEntries[worldName] = [];
        }
        partialEntries[worldName].push(parsedEntry);
        successCount++;
      } else {
        failCount++;
      }
    }

    // 如果完全没有找到任何 entry 标签，尝试查找不完整的 entry
    if (successCount === 0 && failCount === 0) {
      // 检查是否有不完整的 entry（缺少结束标签）
      const incompleteEntryMatch = processedXml.match(/<entry>([\s\S]*?)$/);
      if (incompleteEntryMatch) {
        failCount = 1; // 标记有不完整的条目
      }
    }

    // 如果部分成功，返回成功的条目 + 失败记录
    if (successCount > 0 || failCount > 0) {
      const failedRecord: FailedParseRecord = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        rawContent: processedXml,
        errorMessage: successCount > 0
          ? `部分解析成功：${successCount} 个条目成功，${failCount} 个条目失败`
          : `解析失败：${standardError.message || 'XML 格式无效'}`,
        partialEntries: successCount > 0 ? partialEntries : undefined,
      };

      return {
        entries: partialEntries,
        failedRecord: failCount > 0 ? failedRecord : undefined,
      };
    }

    // 完全失败，返回错误记录
    const failedRecord: FailedParseRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      rawContent: processedXml,
      errorMessage: standardError.message || 'Model response is not valid XML',
    };

    return {
      entries: {},
      failedRecord,
    };
  }
}

/**
 * 旧版兼容函数 - 只返回条目，解析失败则抛出错误
 * @deprecated 请使用 parseXMLOwn 获取更详细的结果
 */
export function parseXMLOwnLegacy(xml: string, options: XmlParseOptions = {}): Record<string, WIEntry[]> {
  const result = parseXMLOwn(xml, options);
  if (Object.keys(result.entries).length === 0 && result.failedRecord) {
    throw new Error(result.failedRecord.errorMessage);
  }
  return result.entries;
}

export function getPrefilledXML(worldName: string, entry: WIEntry): string {
  return `
<lorebooks>
  <entry>
    <worldName>${worldName}</worldName>
    <id>${entry.uid}</id>
    <name>${entry.comment}</name>
    <triggers>${entry.key.join(',')}</triggers>
    <content>${entry.content}`;
}

export function getFullXML(worldName: string, entry: WIEntry): string {
  return `
<lorebooks>
  <entry>
    <worldName>${worldName}</worldName>
    <id>${entry.uid}</id>
    <name>${entry.comment}</name>
    <triggers>${entry.key.join(',')}</triggers>
    <content>${entry.content}</content>
  </entry>
</lorebooks>`;
}
