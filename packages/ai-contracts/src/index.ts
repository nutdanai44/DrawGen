export type Provider = 'openai' | 'anthropic';
export type AIIntent = 'DISCUSS' | 'CREATE' | 'UPDATE';
export interface ChatRequest { prompt: string; provider: Provider; mode: 'discuss' | 'auto' | 'review'; baseRevision: number; }
export interface ChatResponse { intent: AIIntent; message: string; changes?: unknown; }
