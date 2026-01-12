import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});

export const primaryModel = googleAI.model('gemini-2.5-flash-lite');
export const backupModel = googleAI.model('gemini-2.5-flash');
export const embeddingModel = googleAI.embedder('text-embedding-004');
