
'use server';
import { ai } from '@/ai/genkit';
import { type Model } from '@genkit-ai/core';
import { getFirebaseVectorStore, getFirestore } from '@genkit-ai/firebase';
import { increment, updateDoc } from 'firebase/firestore';
import { z } from 'zod';
import { backupModel, embeddingModel, primaryModel } from './genkit';

const personaStore = getFirebaseVectorStore({
  collection: 'brand_persona_examples',
  contentField: 'content',
  embedder: { model: embeddingModel },
  metadataFields: ['brandId', 'platforms', 'source'],
});

const trainPersonaFlowInput = z.object({
  brandId: z.string(),
  captionText: z.string(),
  platforms: z.array(z.string()),
});

export const trainPersonaFlow = ai.defineFlow(
  {
    name: 'trainPersonaFlow',
    inputSchema: trainPersonaFlowInput,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    await personaStore.add([
      {
        content: input.captionText,
        metadata: {
          brandId: input.brandId,
          platforms: input.platforms,
          source: 'manual_input',
        },
      },
    ]);

    const db = getFirestore();
    const brandRef = db.collection('brands').doc(input.brandId);
    await updateDoc(brandRef, { personaConfidence: increment(5) });

    return { success: true };
  }
);

const captionPrompt = ai.definePrompt(
  {
    name: 'captionPrompt',
    input: {
      schema: z.object({
        platforms: z.array(z.string()),
        examples: z.string(),
        userPrompt: z.string(),
      }),
    },
    output: {
      schema: z
        .object({
          captions: z
            .array(z.string())
            .describe('An array of 3 distinct social media caption options.'),
        })
        .describe('The required JSON output structure.'),
    },
    prompt: `
    You are an expert social media manager. Your task is to generate captions for the social media platforms: {{{platforms}}}.
    Your response must be a valid JSON object with a single key "captions" which is an array of strings, like {"captions": ["caption 1", "caption 2"]}.
    Do not wrap the JSON in markdown backticks.

    First, study these high-quality examples of the brand's voice:
    {{{examples}}}

    Now, based on that voice, write 3 distinct caption options about the following topic: "{{{userPrompt}}}"
  `,
    config: {
      output: { format: 'json' },
    },
  },
  async (input) => {
    const generate = async (model: Model) => {
      const llmResponse = await model.generate({
        prompt: { ...input },
      });
      return llmResponse.output() as { captions: string[] };
    };

    try {
      return await generate(primaryModel);
    } catch (e) {
      console.error('Primary model failed, trying backup model.', e);
      return await generate(backupModel);
    }
  }
);

const generateCaptionFlowInput = z.object({
  brandId: z.string(),
  userPrompt: z.string(),
  platforms: z.array(z.string()),
});

export const generateCaptionFlow = ai.defineFlow(
  {
    name: 'generateCaptionFlow',
    inputSchema: generateCaptionFlowInput,
    outputSchema: z.object({ captions: z.array(z.string()) }),
  },
  async (input) => {
    const similarDocs = await personaStore.retrieve({
      content: input.userPrompt,
      k: 3,
      filter: { where: 'metadata.brandId', is: '==', value: input.brandId },
    });

    const examples = similarDocs.map((doc: any) => doc.content).join('\n---\n');

    const result = await captionPrompt({
      platforms: input.platforms,
      examples: examples,
      userPrompt: input.userPrompt,
    });
    
    return result || { captions: [] };
  }
);

const recordFeedbackFlowInput = z.object({
  brandId: z.string(),
  captionText: z.string(),
  platforms: z.array(z.string()),
  feedback: z.enum(['positive', 'negative']),
});

export const recordFeedbackFlow = ai.defineFlow(
  {
    name: 'recordFeedbackFlow',
    inputSchema: recordFeedbackFlowInput,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async (input) => {
    const db = getFirestore();
    const brandRef = db.collection('brands').doc(input.brandId);

    if (input.feedback === 'positive') {
      await personaStore.add([
        {
          content: input.captionText,
          metadata: {
            brandId: input.brandId,
            platforms: input.platforms,
            source: 'generated_positive_feedback',
          },
        },
      ]);
      await updateDoc(brandRef, { personaConfidence: increment(2) });
    } else {
      await updateDoc(brandRef, { personaConfidence: increment(-2) });
    }

    return { success: true };
  }
);
