import { buildPrompt, BuildPromptOptions, ExtensionSettingsManager, Message } from 'sillytavern-utils-lib';
import { ExtractedData } from 'sillytavern-utils-lib/types';
import { getFullXML, getPrefilledXML, parseXMLOwn } from './xml.js';
import { WIEntry } from 'sillytavern-utils-lib/types/world-info';
import { st_createWorldInfoEntry } from 'sillytavern-utils-lib/config';
import { ExtensionSettings, MessageRole, settingsManager } from './settings.js';
import { RegexScriptData } from 'sillytavern-utils-lib/types/regex';
import { sendDirectApiRequest } from './direct-api.js';

import * as Handlebars from 'handlebars';

export const globalContext = SillyTavern.getContext();

export interface Session {
  suggestedEntries: Record<string, WIEntry[]>;
  blackListedEntries: string[];
  selectedWorldNames: string[];
  selectedEntryUids: Record<string, number[]>;
  regexIds: Record<string, Partial<RegexScriptData>>;
}

// @ts-ignore
const dumbSettings = new ExtensionSettingsManager<ExtensionSettings>('dumb', {}).getSettings();

export interface RunWorldInfoRecommendationParams {
  profileId: string;
  userPrompt: string;
  buildPromptOptions: BuildPromptOptions;
  session: Session;
  entriesGroupByWorldName: Record<string, WIEntry[]>;
  promptSettings: typeof dumbSettings.prompts;
  mainContextList: {
    promptName: string;
    role: MessageRole;
  }[];
  maxResponseToken: number;
  continueFrom?: { worldName: string; entry: WIEntry; mode: 'continue' | 'revise' };
}

export async function runWorldInfoRecommendation({
  profileId,
  userPrompt,
  buildPromptOptions,
  session,
  entriesGroupByWorldName,
  promptSettings,
  mainContextList,
  maxResponseToken,
  continueFrom,
}: RunWorldInfoRecommendationParams): Promise<Record<string, WIEntry[]>> {
  if (!profileId) {
    throw new Error('No connection profile selected.');
  }
  const context = SillyTavern.getContext();
  const profile = context.extensionSettings.connectionManager?.profiles?.find((profile) => profile.id === profileId);
  if (!profile) {
    throw new Error(`Connection profile with ID "${profileId}" not found.`);
  }

  // Try to get API from profile, fall back to current ST API if not set
  let selectedApi: string | undefined;

  if (profile.api && globalContext.CONNECT_API_MAP[profile.api]) {
    selectedApi = globalContext.CONNECT_API_MAP[profile.api].selected;
  } else {
    // Fallback: use SillyTavern's currently active API
    console.warn(`[WorldInfoRecommender] Profile "${profile.name}" has no API configured, using ST default.`);

    // Try to find the active API by checking which one is currently selected
    for (const [apiKey, apiValue] of Object.entries(globalContext.CONNECT_API_MAP)) {
      if (apiValue && apiValue.selected) {
        selectedApi = apiValue.selected;
        console.log(`[WorldInfoRecommender] Using fallback API: ${apiKey} -> ${selectedApi}`);
        break;
      }
    }
  }

  if (!selectedApi) {
    throw new Error(`Could not determine API for profile "${profile.name}". Please configure an API in Connection Manager or select a valid profile.`);
  }

  const templateData: Record<string, any> = {};
  templateData['user'] = '{{user}}'; // ST going to replace this with the actual user name
  templateData['char'] = '{{char}}'; // ST going to replace this with the actual character name
  templateData['persona'] = '{{persona}}'; // ST going to replace this with the actual persona description

  templateData['blackListedEntries'] = session.blackListedEntries;
  const finalUserPrompt = userPrompt.trim();

  // If we are revising, the main userInstructions in the system prompt will be empty.
  // The actual instructions will be added as a separate user message later.
  if (continueFrom && continueFrom.mode === 'revise') {
    templateData['userInstructions'] = '';
  } else {
    templateData['userInstructions'] = Handlebars.compile(finalUserPrompt, { noEscape: true })(templateData);
  }

  {
    const lorebooks: Record<string, WIEntry[]> = {};
    Object.entries(entriesGroupByWorldName)
      .filter(
        ([worldName, entries]) =>
          entries.length > 0 && session.selectedWorldNames.includes(worldName) && entries.some((e) => !e?.disable),
      )
      .forEach(([worldName, entries]) => {
        let filteredEntries = entries.filter((e) => !e?.disable);

        const selectedUidsForWorld = session.selectedEntryUids?.[worldName];
        // If there's a selection for this specific world and it's not empty, filter by it.
        if (selectedUidsForWorld && selectedUidsForWorld.length > 0) {
          const selectedUids = new Set(selectedUidsForWorld);
          filteredEntries = filteredEntries.filter((e) => selectedUids.has(e.uid));
        }

        if (filteredEntries.length > 0) {
          lorebooks[worldName] = filteredEntries;
        }
      });

    templateData['currentLorebooks'] = lorebooks;
  }

  {
    const lorebooks: Record<string, WIEntry[]> = {};
    Object.entries(session.suggestedEntries)
      .filter(([_, entries]) => entries.length > 0)
      .forEach(([worldName, entries]) => {
        lorebooks[worldName] = entries.filter(
          (e) =>
            !(
              worldName === continueFrom?.worldName &&
              e.uid === continueFrom.entry.uid &&
              e.comment === continueFrom.entry.comment
            ),
        );
      });

    templateData['suggestedLorebooks'] = lorebooks;
  }

  const messages: Message[] = [];
  {
    for (const mainContext of mainContextList) {
      // Chat history is exception, since it is not a template
      if (mainContext.promptName === 'chatHistory') {
        messages.push(...(await buildPrompt(selectedApi, buildPromptOptions)).result);
        continue;
      }

      const prompt = promptSettings[mainContext.promptName];
      if (!prompt) {
        continue;
      }
      const message: Message = {
        role: mainContext.role,
        content: Handlebars.compile(prompt.content, { noEscape: true })(templateData),
      };
      message.content = globalContext.substituteParams(message.content);
      if (message.content) {
        messages.push(message);
      }
    }

    if (continueFrom) {
      if (continueFrom.mode === 'continue') {
        // Add the incomplete XML to prompt for completion.
        messages.push({
          role: 'assistant',
          content: getPrefilledXML(continueFrom.worldName, continueFrom.entry),
        });
      } else if (continueFrom.mode === 'revise') {
        // Add the full XML of the existing entry as an assistant message.
        messages.push({
          role: 'assistant',
          content: getFullXML(continueFrom.worldName, continueFrom.entry),
        });
        // Then, add the user's revision instructions as a new user message.
        if (finalUserPrompt) {
          messages.push({
            role: 'user',
            content: finalUserPrompt,
          });
        }
      }
    }
  }

  // console.log("Sending messages:", messages);

  let response: ExtractedData;
  const directApiConfig = settingsManager.getSettings().directApi;

  try {
    if (directApiConfig.enabled) {
      // Use Direct API (bypasses ConnectionManager)
      console.log('[WorldInfoRecommender] Using Direct API:', directApiConfig.apiType);
      const directResponse = await sendDirectApiRequest(directApiConfig, messages, maxResponseToken);
      response = { content: directResponse.content } as ExtractedData;
    } else {
      // Use ConnectionManager (original behavior)
      response = (await globalContext.ConnectionManagerRequestService.sendRequest(
        profileId,
        messages,
        maxResponseToken,
      )) as ExtractedData;
    }
  } catch (error: any) {
    console.error('[WorldInfoRecommender] Request failed:', error);

    // Provide more detailed error information
    let errorMessage = 'Request failed';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    if (error.status) {
      errorMessage += ` (HTTP ${error.status})`;
    }
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage += '. This might be a network or CORS issue. Please check your connection profile settings and ensure the API endpoint is accessible.';
    }

    throw new Error(errorMessage);
  }

  // console.log("Received content:", response.content);

  const assistantMessageForContinue = messages.find((m) => m.role === 'assistant');
  if (!response.content) {
    return {};
  }
  let parsedEntries = parseXMLOwn(response.content, {
    // Only merge with previous content if we are in 'continue' mode.
    previousContent:
      continueFrom && continueFrom.mode === 'continue' ? assistantMessageForContinue?.content : undefined,
  });

  if (Object.keys(parsedEntries).length === 0) {
    return {};
  }

  // Set "key" and "comment" if missing, using the passed entriesGroupByWorldName
  Object.entries(parsedEntries).forEach(([worldName, entries]) => {
    if (!entriesGroupByWorldName[worldName]) {
      return;
    }
    entries.forEach((entry) => {
      const existentWI = entriesGroupByWorldName[worldName]?.find((e) => e.uid === entry.uid);
      if (existentWI) {
        if (entry.key.length === 0) {
          entry.key = existentWI.key;
        }
        if (!entry.comment) {
          entry.comment = existentWI.comment;
        }
      }
      // Ensure comment is at least an empty string if somehow still missing
      if (entry.comment === null || entry.comment === undefined) {
        entry.comment = '';
      }
    });
  });

  parsedEntries = continueFrom
    ? { [continueFrom.worldName]: [parsedEntries[continueFrom.worldName][0]] }
    : parsedEntries;

  return parsedEntries;
}

/**
 * Adds or updates a World Info entry in memory. Does NOT save immediately.
 * @param entry The entry data to add/update.
 * @param targetWorldName The name of the world to add/update the entry in.
 * @param entriesGroupByWorldName The current state of all world info entries.
 * @returns The modified entry and its status ('added' or 'updated').
 * @throws Error if entry creation fails.
 */
export function prepareEntryModification(
  entry: WIEntry,
  targetWorldName: string,
  entriesGroupByWorldName: Record<string, WIEntry[]>,
): { modifiedEntry: WIEntry; status: 'added' | 'updated' } {
  if (!entriesGroupByWorldName[targetWorldName]) {
    // If the target world doesn't exist in the current context, create it in memory
    entriesGroupByWorldName[targetWorldName] = [];
    // Note: This doesn't create the actual lorebook file if it's brand new.
    // The save operation later should handle this, assuming the name is valid.
  }

  const worldEntries = entriesGroupByWorldName[targetWorldName];
  const existingEntryIndex = worldEntries.findIndex((e) => e.uid === entry.uid);
  let targetEntry: WIEntry;
  const isUpdate = existingEntryIndex !== -1;

  if (isUpdate) {
    targetEntry = worldEntries[existingEntryIndex];
  } else {
    // Create a temporary structure mimicking ST's format for st_createWorldInfoEntry
    const stFormat: { entries: Record<number, WIEntry> } = { entries: {} };
    worldEntries.forEach((e) => (stFormat.entries[e.uid] = e));

    const newEntry = st_createWorldInfoEntry(targetWorldName, stFormat); // Pass the temporary format
    if (!newEntry) {
      throw new Error(`Failed to create a new entry structure in world "${targetWorldName}"`);
    }
    // Find the last entry to potentially copy some default properties (like scan_depth etc)
    const lastEntry = worldEntries.length > 0 ? worldEntries[worldEntries.length - 1] : undefined;
    if (lastEntry) {
      // Copy properties BUT keep the new UID
      const newUid = newEntry.uid;
      Object.assign(newEntry, lastEntry);
      newEntry.uid = newUid;
    }
    targetEntry = newEntry;
    // Add the newly created entry structure to our in-memory list for this world
    worldEntries.push(targetEntry);
  }

  // Update entry properties from the suggestion
  targetEntry.key = entry.key;
  targetEntry.content = entry.content;
  targetEntry.comment = entry.comment;
  // Optionally update other fields if the AI could suggest them, e.g.,
  // targetEntry.scan_depth = entry.scan_depth ?? targetEntry.scan_depth;
  // targetEntry.selective = entry.selective ?? targetEntry.selective;
  // ... etc.

  return { modifiedEntry: targetEntry, status: isUpdate ? 'updated' : 'added' };
}

// Helper for slash command enum provider
export function provideConnectionProfiles() {
  const profiles = globalContext.extensionSettings?.connectionManager?.profiles ?? [];
  return profiles.map((p) => ({
    value: p.name ?? p.id,
    valueProvider: (value: string) => {
      return profiles.find((p) => p.name?.includes(value))?.name;
    },
  }));
}
