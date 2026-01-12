/**
 * Direct API Module - Bypasses ConnectionManagerRequestService
 * Supports OpenAI, Gemini, and Antigravity API formats
 */

import { Message } from 'sillytavern-utils-lib';
import { DirectApiConfig } from './settings.js';

export interface DirectApiResponse {
    content: string;
    error?: string;
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
 * Send request using OpenAI format
 * POST /v1/chat/completions
 */
async function sendOpenAIRequest(
    config: DirectApiConfig,
    messages: Message[],
    maxTokens: number,
): Promise<DirectApiResponse> {
    const url = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    const endpoint = url.endsWith('chat/completions') || url.endsWith('chat/completions/')
        ? url
        : `${url}v1/chat/completions`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.modelName,
            messages: convertToOpenAIMessages(messages),
            max_tokens: maxTokens,
            stream: false,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('No content in OpenAI response');
    }

    return { content };
}

/**
 * Send request using Gemini format
 * POST /v1beta/models/{model}:generateContent
 */
async function sendGeminiRequest(
    config: DirectApiConfig,
    messages: Message[],
    maxTokens: number,
): Promise<DirectApiResponse> {
    // Build the endpoint URL
    let endpoint: string;
    const baseUrl = config.apiUrl.replace(/\/$/, '');

    if (baseUrl.includes(':generateContent')) {
        endpoint = baseUrl;
    } else {
        endpoint = `${baseUrl}/v1beta/models/${config.modelName}:generateContent`;
    }

    // Add API key as query param if not in URL
    if (!endpoint.includes('key=')) {
        endpoint += `?key=${config.apiKey}`;
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
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
        throw new Error('No content in Gemini response');
    }

    return { content };
}

/**
 * Send request using Antigravity format (Google Cloud Code sandbox)
 * Uses Gemini-like format with Bearer token auth
 * POST /v1internal:generateContent
 */
async function sendAntigravityRequest(
    config: DirectApiConfig,
    messages: Message[],
    maxTokens: number,
): Promise<DirectApiResponse> {
    // Build the endpoint URL
    let endpoint: string;
    const baseUrl = config.apiUrl.replace(/\/$/, '');

    if (baseUrl.includes(':generateContent')) {
        endpoint = baseUrl;
    } else {
        // Antigravity uses /v1beta for standard Gemini format with Bearer auth
        endpoint = `${baseUrl}/v1beta/models/${config.modelName}:generateContent`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            contents: convertToGeminiContents(messages),
            generationConfig: {
                maxOutputTokens: maxTokens,
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Antigravity API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
        throw new Error('No content in Antigravity response');
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

    console.log(`[WorldInfoRecommender] Sending direct API request (${config.apiType})`);

    switch (config.apiType) {
        case 'openai':
            return sendOpenAIRequest(config, messages, maxTokens);
        case 'gemini':
            return sendGeminiRequest(config, messages, maxTokens);
        case 'antigravity':
            return sendAntigravityRequest(config, messages, maxTokens);
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

        await sendDirectApiRequest(config, testMessages, 10);
        return { success: true, message: 'Connection successful!' };
    } catch (error: any) {
        return { success: false, message: error.message || 'Connection failed' };
    }
}
