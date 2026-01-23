/**
 * Direct API Module - Bypasses ConnectionManagerRequestService
 * Supports OpenAI and Gemini API formats with streaming support
 */

import { Message } from 'sillytavern-utils-lib';
import { DirectApiConfig } from './settings.js';

export interface DirectApiResponse {
    content: string;
    error?: string;
}

export interface StreamCallbacks {
    onChunk: (data: { chunk: string; fullText: string; receivedChars: number }) => void;
}

/**
 * Convert SillyTavern messages to OpenAI format
 */
function convertToOpenAIMessages(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
    }));
}

/**
 * Convert SillyTavern messages to Gemini format
 */
function convertToGeminiContents(messages: Message[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
    }));
}

/**
 * Send request using OpenAI format with streaming support
 * POST /v1/chat/completions
 */
async function sendOpenAIRequest(
    config: DirectApiConfig,
    messages: Message[],
    maxTokens: number,
    streamCallbacks?: StreamCallbacks,
    signal?: AbortSignal,
): Promise<DirectApiResponse> {
    // Build the endpoint URL, handling various input formats:
    // - "http://example.com" -> "http://example.com/v1/chat/completions"
    // - "http://example.com/v1" -> "http://example.com/v1/chat/completions"
    // - "http://example.com/v1/chat/completions" -> unchanged
    let baseUrl = config.apiUrl.replace(/\/+$/, ''); // Remove trailing slashes

    let endpoint: string;
    if (baseUrl.endsWith('/chat/completions') || baseUrl.endsWith('chat/completions')) {
        endpoint = baseUrl;
    } else if (baseUrl.endsWith('/v1')) {
        endpoint = `${baseUrl}/chat/completions`;
    } else {
        endpoint = `${baseUrl}/v1/chat/completions`;
    }

    const useStream = !!streamCallbacks;

    // Ensure max_tokens is at least 1024 to avoid Claude Extended Thinking errors
    // (Claude requires max_tokens > thinking.budget_tokens)
    const effectiveMaxTokens = Math.max(maxTokens, 1024);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.modelName,
            messages: convertToOpenAIMessages(messages),
            max_tokens: effectiveMaxTokens,
            stream: useStream,
        }),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    // Handle streaming response
    if (useStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
                    if (!trimmedLine.startsWith('data: ')) continue;

                    try {
                        const jsonStr = trimmedLine.slice(6); // Remove 'data: ' prefix
                        const data = JSON.parse(jsonStr);
                        const delta = data.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            fullText += delta;
                            streamCallbacks.onChunk({
                                chunk: delta,
                                fullText,
                                receivedChars: fullText.length,
                            });
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete JSON
                        console.debug('[WorldInfoRecommender] Stream parse error:', e);
                    }
                }
            }
        } catch (error) {
            if (signal?.aborted) {
                throw new DOMException('Request aborted by user', 'AbortError');
            }
            throw error;
        }

        if (!fullText) {
            throw new Error('No content received from streaming response');
        }

        return { content: fullText };
    }

    // Handle non-streaming response
    const data = await response.json();

    // Log the response for debugging
    console.log('[WorldInfoRecommender] OpenAI API response:', JSON.stringify(data).substring(0, 500));

    // Try multiple response formats
    // Note: We use `=== undefined` instead of `!content` to allow empty strings
    let content = data.choices?.[0]?.message?.content;

    // Some APIs might use different structures
    if (content === undefined && data.choices?.[0]?.text !== undefined) {
        content = data.choices[0].text;
    }
    if (content === undefined && data.content !== undefined) {
        content = data.content;
    }
    if (content === undefined && data.output !== undefined) {
        content = data.output;
    }
    if (content === undefined && data.response !== undefined) {
        content = data.response;
    }
    // For models that return delta in non-streaming mode
    if (content === undefined && data.choices?.[0]?.delta?.content !== undefined) {
        content = data.choices[0].delta.content;
    }

    // Only throw if content is truly undefined (not just empty string)
    // Empty string can happen with very low max_tokens, but the connection is still valid
    if (content === undefined || content === null) {
        console.error('[WorldInfoRecommender] No content found in response. Full data:', JSON.stringify(data));
        throw new Error('No content in OpenAI response');
    }

    return { content };
}

/**
 * Send request using Gemini format with streaming support
 * POST /v1beta/models/{model}:streamGenerateContent or :generateContent
 */
async function sendGeminiRequest(
    config: DirectApiConfig,
    messages: Message[],
    maxTokens: number,
    streamCallbacks?: StreamCallbacks,
    signal?: AbortSignal,
): Promise<DirectApiResponse> {
    // Build the endpoint URL
    const baseUrl = config.apiUrl.replace(/\/$/, '');
    const useStream = !!streamCallbacks;

    let endpoint: string;
    if (baseUrl.includes(':generateContent') || baseUrl.includes(':streamGenerateContent')) {
        endpoint = useStream ? baseUrl.replace(':generateContent', ':streamGenerateContent') : baseUrl;
    } else {
        const action = useStream ? 'streamGenerateContent' : 'generateContent';
        endpoint = `${baseUrl}/v1beta/models/${config.modelName}:${action}`;
    }

    // Add API key as query param if not in URL
    if (!endpoint.includes('key=')) {
        endpoint += `?key=${config.apiKey}`;
    }

    // For streaming, add alt=sse parameter
    if (useStream && !endpoint.includes('alt=')) {
        endpoint += '&alt=sse';
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: convertToGeminiContents(messages),
            generationConfig: {
                maxOutputTokens: maxTokens,
            },
        }),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    // Handle streaming response
    if (useStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    if (!trimmedLine.startsWith('data: ')) continue;

                    try {
                        const jsonStr = trimmedLine.slice(6); // Remove 'data: ' prefix
                        const data = JSON.parse(jsonStr);
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (text) {
                            fullText += text;
                            streamCallbacks.onChunk({
                                chunk: text,
                                fullText,
                                receivedChars: fullText.length,
                            });
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete JSON
                        console.debug('[WorldInfoRecommender] Gemini stream parse error:', e);
                    }
                }
            }
        } catch (error) {
            if (signal?.aborted) {
                throw new DOMException('Request aborted by user', 'AbortError');
            }
            throw error;
        }

        if (!fullText) {
            throw new Error('No content received from Gemini streaming response');
        }

        return { content: fullText };
    }

    // Handle non-streaming response
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
        throw new Error('No content in Gemini response');
    }

    return { content };
}


/**
 * Main entry point - sends request based on API type
 */
export async function sendDirectApiRequest(
    config: DirectApiConfig,
    messages: Message[],
    maxTokens: number,
    streamCallbacks?: StreamCallbacks,
    signal?: AbortSignal,
): Promise<DirectApiResponse> {
    if (!config.apiUrl) {
        throw new Error('API URL is not configured');
    }
    if (!config.apiKey) {
        throw new Error('API Key is not configured');
    }
    if (!config.modelName) {
        throw new Error('Model name is not configured');
    }

    // Filter out messages with empty content and validate
    const validMessages = messages.filter(msg => msg.content && msg.content.trim().length > 0);

    if (validMessages.length === 0) {
        throw new Error('No valid messages to send. Please ensure your prompts are configured correctly.');
    }

    console.log(`[WorldInfoRecommender] Sending direct API request (${config.apiType})${streamCallbacks ? ' with streaming' : ''}, messages: ${validMessages.length}`);

    switch (config.apiType) {
        case 'openai':
            return sendOpenAIRequest(config, validMessages, maxTokens, streamCallbacks, signal);
        case 'gemini':
            return sendGeminiRequest(config, validMessages, maxTokens, streamCallbacks, signal);
        default:
            throw new Error(`Unsupported API type: ${config.apiType}`);
    }
}

/**
 * Test connection to the API
 */
export async function testDirectApiConnection(config: DirectApiConfig): Promise<{ success: boolean; message: string }> {
    try {
        const testMessages: Message[] = [
            { role: 'user', content: 'Hello, please respond with "OK" only.' },
        ];

        await sendDirectApiRequest(config, testMessages, 1024);
        return { success: true, message: 'Connection successful!' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Connection failed' };
    }
}

/**
 * Fetch available models from the API
 */
export async function fetchModelsList(config: DirectApiConfig): Promise<{ success: boolean; models: string[]; message: string }> {
    if (!config.apiUrl) {
        return { success: false, models: [], message: 'API URL is not configured' };
    }
    if (!config.apiKey) {
        return { success: false, models: [], message: 'API Key is not configured' };
    }

    try {
        let baseUrl = config.apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
        let endpoint: string;
        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        switch (config.apiType) {
            case 'openai':
                // OpenAI format: GET /v1/models
                if (baseUrl.endsWith('/v1')) {
                    endpoint = `${baseUrl}/models`;
                } else if (baseUrl.includes('/chat/completions')) {
                    endpoint = baseUrl.replace('/chat/completions', '/models');
                } else {
                    endpoint = `${baseUrl}/v1/models`;
                }
                headers['Authorization'] = `Bearer ${config.apiKey}`;
                break;
            case 'gemini':
                // Gemini format: GET /v1beta/models
                if (baseUrl.includes(':generateContent')) {
                    endpoint = baseUrl.replace(/\/models\/[^/]+:generateContent.*/, '/models');
                } else {
                    endpoint = `${baseUrl}/v1beta/models`;
                }
                endpoint += `?key=${config.apiKey}`;
                break;
            default:
                return { success: false, models: [], message: `Unsupported API type: ${config.apiType}` };
        }

        console.log(`[WorldInfoRecommender] Fetching models from: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, models: [], message: `API error (${response.status}): ${errorText}` };
        }

        const data = await response.json();
        let models: string[] = [];

        // Parse response based on API type
        if (config.apiType === 'gemini') {
            // Gemini format: { models: [{ name: "models/gemini-pro", ... }] }
            if (Array.isArray(data.models)) {
                models = data.models.map((m: any) => {
                    const name = m.name || m.id || '';
                    // Remove "models/" prefix if present
                    return name.replace(/^models\//, '');
                }).filter((m: string) => m);
            }
        } else {
            // OpenAI format: { data: [{ id: "gpt-4", ... }] }
            if (Array.isArray(data.data)) {
                models = data.data.map((m: any) => m.id || m.name || '').filter((m: string) => m);
            } else if (Array.isArray(data.models)) {
                models = data.models.map((m: any) => m.id || m.name || '').filter((m: string) => m);
            } else if (Array.isArray(data)) {
                models = data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name || '')).filter((m: string) => m);
            }
        }

        // Sort models alphabetically
        models.sort();

        if (models.length === 0) {
            console.log('[WorldInfoRecommender] Models response:', JSON.stringify(data));
            return { success: false, models: [], message: 'No models found. Check console for raw response.' };
        }

        return { success: true, models, message: `Found ${models.length} models` };
    } catch (error: any) {
        console.error('[WorldInfoRecommender] Error fetching models:', error);
        return { success: false, models: [], message: error.message || 'Failed to fetch models' };
    }
}
