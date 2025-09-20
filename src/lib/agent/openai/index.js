/**
 * OpenAI Integration Main Export
 * Converted from TypeScript for SvelteKit with JSDoc types
 *
 * Main export point for OpenAI integration
 *
 * @fileoverview OpenAI integration exports and setup
 */

// Re-export service and tools
export { openAIService } from './service.js';
export { openaiTools, openaiToolDefinitions } from './tools/index.js';
export { generateSystemPromptOpenAI } from './prompt.js';
export { processOpenAIStream } from './streaming.js';