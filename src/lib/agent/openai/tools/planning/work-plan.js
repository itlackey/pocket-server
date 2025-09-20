/**
 * OpenAI Work Plan Tool
 */

export const name = 'work_plan';

export const definition = {
  type: 'function',
  name,
  description: 'Create a structured work plan for complex tasks.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', description: 'Title of the work plan' },
      steps: {
        type: 'array',
        description: 'List of steps in the work plan',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Step title' },
            description: { type: 'string', description: 'Step description' },
            estimated_time: { type: 'string', description: 'Estimated time to complete' },
          },
          required: ['title', 'description'],
        },
      },
    },
    required: ['title', 'steps'],
  },
};

export async function run(input, { workingDir, sessionId }) {
  // Work plan tool doesn't need external service calls
  // It's primarily for organizing and presenting structured plans
  return {
    title: input.title,
    steps: input.steps,
    createdAt: new Date().toISOString(),
    workingDir,
    sessionId,
  };
}