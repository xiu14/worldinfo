import { Generator, Message } from 'sillytavern-utils-lib';
import { ExtractedData, StreamResponse } from 'sillytavern-utils-lib/types';
import { z } from 'zod';
import { st_echo } from 'sillytavern-utils-lib/config';
import { PromptEngineeringMode, settingsManager } from './settings.js';
import * as Handlebars from 'handlebars';
import { schemaToExample } from './schema-to-example.js';
import { parseXMLOwn } from './xml.js';
import { sendDirectApiRequest } from './direct-api.js';

const generator = new Generator();

async function makeRequest(
  profileId: string,
  prompt: Message[],
  maxTokens: number,
  overridePayload: any,
  streamCallbacks?: {
    onStream: (data: { chunk: string; fullText: string }) => Promise<void> | void;
  },
  signal?: AbortSignal,
): Promise<ExtractedData | undefined> {
  const stream = !overridePayload.json_schema && !!streamCallbacks;
  let previousText = '';

  return new Promise((resolve, reject) => {
    const abortController = new AbortController();

    const combinedSignal = signal ?? abortController.signal;
    if (signal) {
      signal.addEventListener('abort', () => abortController.abort(), { once: true });
    }

    generator.generateRequest(
      {
        profileId,
        prompt,
        maxTokens,
        custom: { stream, signal: combinedSignal },
        overridePayload,
      },
      {
        abortController,
        onEntry: stream
          ? async (_requestId, streamData) => {
            const text = (streamData as StreamResponse).text;
            if (text && streamCallbacks) {
              await streamCallbacks.onStream({ chunk: text.slice(previousText.length), fullText: text });
              previousText = text;
            }
          }
          : undefined,
        onFinish: (_requestId, data, error) => {
          if (combinedSignal.aborted) {
            return reject(new DOMException('Request aborted by user', 'AbortError'));
          }
          if (error) return reject(error);

          if (data === undefined && error === undefined) {
            if (stream) {
              return resolve({ content: previousText });
            }
            return reject(new DOMException('Request aborted by user', 'AbortError'));
          }
          if (!data) reject(new Error('No data received from LLM'));
          if (error) return reject(error);
          return streamCallbacks ? resolve({ content: previousText }) : resolve(data as ExtractedData);
        },
      },
    );
  });
}

/**
 * Helper function that checks DirectApi config and routes requests accordingly.
 * If DirectApi is enabled, uses sendDirectApiRequest; otherwise uses makeRequest (ConnectionManager).
 */
async function makeRequestWithDirectApiSupport(
  profileId: string,
  prompt: Message[],
  maxTokens: number,
  overridePayload: any,
  signal?: AbortSignal,
): Promise<ExtractedData | undefined> {
  const directApiConfig = settingsManager.getSettings().directApi;

  if (directApiConfig.enabled) {
    // Use Direct API (bypasses ConnectionManager)
    console.log('[WorldInfoRecommender] makeStructuredRequest using Direct API:', directApiConfig.apiType);
    const directResponse = await sendDirectApiRequest(directApiConfig, prompt, maxTokens, undefined, signal);
    return { content: directResponse.content } as ExtractedData;
  } else {
    // Use ConnectionManager (original behavior)
    return makeRequest(profileId, prompt, maxTokens, overridePayload, undefined, signal);
  }
}

export async function makeStructuredRequest<T extends z.ZodType<any, any, any>>(
  profileId: string,
  baseMessages: Message[],
  schema: T,
  schemaName: string,
  promptEngineeringMode: PromptEngineeringMode,
  maxResponseToken: number,
  signal?: AbortSignal,
): Promise<z.infer<T>> {
  const settings = settingsManager.getSettings();
  let response: ExtractedData | undefined;
  let parsedContent: any;

  const jsonSchema = z.toJSONSchema(schema);

  if (promptEngineeringMode === 'native') {
    response = await makeRequestWithDirectApiSupport(
      profileId,
      baseMessages,
      maxResponseToken,
      {
        json_schema: { name: schemaName, strict: true, value: jsonSchema },
      },
      signal,
    );
    if (!response?.content) {
      throw new Error(`Structured request for ${schemaName} failed to return content.`);
    }
    parsedContent = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
  } else {
    // Manual prompt engineering for JSON or XML
    const format = promptEngineeringMode as 'json' | 'xml';
    const example = schemaToExample(jsonSchema, format);
    const schemaString = JSON.stringify(jsonSchema, null, 2);
    // This assumes revise prompts are added to settings, which needs to be done.
    const promptTemplateKey = format === 'json' ? 'reviseJsonPrompt' : 'reviseXmlPrompt';
    const promptTemplate = settings.prompts[promptTemplateKey as keyof typeof settings.prompts]?.content;

    if (!promptTemplate) {
      throw new Error(`Prompt template for mode "${format}" not found.`);
    }

    const templateContext = {
      example_response: example,
      schema: schemaString,
    };

    const resolvedPrompt = Handlebars.compile(promptTemplate, { noEscape: true, strict: true })(templateContext);
    const instructionMessage: Message = { role: 'system', content: resolvedPrompt };

    response = await makeRequestWithDirectApiSupport(
      profileId,
      [...baseMessages, instructionMessage],
      maxResponseToken,
      {},
      signal,
    );

    if (!response?.content) {
      throw new Error(`Structured request for ${schemaName} failed to return content.`);
    }

    // For XML, the parser returns a different structure than JSON
    if (format === 'xml') {
      const parsedXml = parseXMLOwn(response.content as string);
      // We expect the root to be the schema name, but the AI might just return the fields.
      // And the parser might wrap it in a 'lorebooks' tag.
      const entries = Object.values(parsedXml).flat();
      if (entries.length > 0) {
        // Zod schema expects specific keys, let's remap from the parsed XML
        const firstEntry = entries[0];
        parsedContent = {
          justification: 'Updated via XML.', // Justification is hard with XML parsing this way
          name: firstEntry.comment,
          triggers: firstEntry.key,
          content: firstEntry.content,
        };
      } else {
        throw new Error('Could not find a valid entry in the XML response.');
      }
    } else {
      parsedContent = JSON.parse(response.content as string);
    }
  }

  const validationResult = schema.safeParse(parsedContent);
  if (!validationResult.success) {
    const errorMessage = `Model response failed schema validation for ${schemaName}. Check console for details.`;
    console.error('Zod validation failed:', validationResult.error.issues);
    console.error('Raw content parsed:', parsedContent);
    await st_echo('error', errorMessage);
    throw new Error(errorMessage);
  }

  return validationResult.data;
}
