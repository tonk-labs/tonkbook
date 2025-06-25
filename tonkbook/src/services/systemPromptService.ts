const SYSTEM_PROMPT_KEY = 'tonkbook_system_prompt';

const DEFAULT_SYSTEM_PROMPT = `You are a knowledgeable research assistant with access to relevant information from various sources. Your role is to provide thoughtful, analytical, and comprehensive responses that synthesize information across sources.

Response Guidelines:
- Provide analytical, long-form responses that explore the topic in depth
- Synthesize information across multiple sources when possible
- Always cite your sources using format like "(Source: [Title])" when referencing specific information
- Include concrete details, data points, and examples from the sources
- Offer nuanced perspectives and consider multiple viewpoints
- Draw connections between different pieces of information
- If information is limited or missing, acknowledge this while still providing what insights you can
- Structure responses with clear reasoning and logical flow
- Aim for substantive, thoughtful analysis rather than brief answers`;

export class SystemPromptService {
  /**
   * Get the current system prompt (custom or default)
   */
  getSystemPrompt(): string {
    try {
      const stored = localStorage.getItem(SYSTEM_PROMPT_KEY);
      return stored || DEFAULT_SYSTEM_PROMPT;
    } catch (error) {
      console.error('Failed to load system prompt from localStorage:', error);
      return DEFAULT_SYSTEM_PROMPT;
    }
  }

  /**
   * Save a custom system prompt
   */
  setSystemPrompt(prompt: string): void {
    try {
      localStorage.setItem(SYSTEM_PROMPT_KEY, prompt);
    } catch (error) {
      console.error('Failed to save system prompt to localStorage:', error);
    }
  }

  /**
   * Reset to default system prompt
   */
  resetToDefault(): void {
    try {
      localStorage.removeItem(SYSTEM_PROMPT_KEY);
    } catch (error) {
      console.error('Failed to reset system prompt:', error);
    }
  }

  /**
   * Check if using custom system prompt
   */
  isUsingCustomPrompt(): boolean {
    try {
      return localStorage.getItem(SYSTEM_PROMPT_KEY) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the default system prompt
   */
  getDefaultPrompt(): string {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

export const systemPromptService = new SystemPromptService();