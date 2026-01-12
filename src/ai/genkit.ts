import { genkit } from 'genkit';
import { firebasePlugin } from '@genkit-ai/firebase';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [firebasePlugin(), googleAI()],
});

export const primaryModel = googleAI.model('gemini-2.5-flash-lite');
export const backupModel = googleAI.model('gemini-2.5-flash');
export const embeddingModel = googleAI.model('text-embedding-004');
