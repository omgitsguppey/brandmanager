
'use server';
import { ai } from '@/ai/genkit';
import { defineFirestoreRetriever } from '@genkit-ai/firebase';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { backupModel, embeddingModel, primaryModel } from './genkit';
import { ImageAnnotatorClient } from '@google-cloud/vision';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const visionClient = new ImageAnnotatorClient();

// Custom personaStore implementation using Genkit 1.x patterns
const personaRetriever = defineFirestoreRetriever(ai, {
  name: 'personaRetriever',
  firestore: db as any,
  collection: 'brand_persona_examples',
  embedder: embeddingModel,
  vectorField: 'embedding',
  contentField: 'content',
  metadataFields: ['brandId', 'platforms', 'source'],
});

const personaStore = {
  add: async (items: any[]) => {
    const batch = db.batch();
    for (const item of items) {
      const embeddings = await ai.embed({
        embedder: embeddingModel,
        content: item.content,
      });
      const docRef = db.collection('brand_persona_examples').doc();
      batch.set(docRef, {
        ...item,
        embedding: embeddings[0].embedding,
      });
    }
    await batch.commit();
  },
  retrieve: async (params: { content: string; k?: number; filter?: any }) => {
    const result = await ai.retrieve({
      retriever: personaRetriever,
      query: params.content,
      options: {
        limit: params.k,
        where: params.filter?.where === 'metadata.brandId' ? { brandId: params.filter.value } : undefined,
      },
    });
    return result.map(doc => ({ content: doc.text }));
  },
};

export const brandFaceAudit = ai.defineFlow(
  { 
    name: 'brandFaceAudit', 
    inputSchema: z.object({ url: z.string(), brandId: z.string() }),
    outputSchema: z.any() 
  },
  async (input) => {
    // Step 1: Execute Cloud Vision to get raw biometric data
    const [result] = await visionClient.faceDetection(input.url);
    const face = result.faceAnnotations?.[0];

    // Step 2: Agentic Reasoning with Gemini 2.5 Flash-Lite
    const audit = await ai.generate({
      model: 'googleai/gemini-2.5-flash-lite',
      prompt: [
        { text: `
          Analyze this model's face for Brand ID: ${input.brandId}.
          Raw Metrics from Vision API: 
          - Joy: ${face?.joyLikelihood}
          - Sorrow: ${face?.sorrowLikelihood}
          - Headwear: ${face?.headwearLikelihood}

          Does this person's expression align with our brand persona?
          Return a JSON object with:
          {
            "isAligned": boolean,
            "reason": string,
            "sentiment": string,
            "metrics": { "joy": string, "sorrow": string }
          }
        `},
        { media: { url: input.url } }
      ],
      config: { 
        // @ts-ignore - budget might be experimental
        thinkingBudget: 1024 
      }
    });

    return audit.output;
  }
);

export const checkImageSafety = ai.defineFlow(
  {
    name: 'checkImageSafety',
    inputSchema: z.object({ base64: z.string(), mimeType: z.string() }),
    outputSchema: z.object({
      isSafe: z.boolean(),
      reason: z.string().optional(),
    })
  },
  async (input) => {
    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash-lite',
      prompt: [
        { text: 'Analyze this image for NSFW content (nudity, violence, or hate). Return JSON: { "isSafe": boolean, "reason": string }.' },
        { media: { url: `data:${input.mimeType};base64,${input.base64}` } }
      ]
    });
    return response.output as { isSafe: boolean, reason?: string };
  }
);

export const autoTagImage = ai.defineFlow(
  {
    name: 'autoTagImage',
    inputSchema: z.object({ url: z.string() }),
    outputSchema: z.object({ tags: z.array(z.string()) })
  },
  async (input) => {
    const response = await ai.generate({
      model: 'googleai/gemini-2.5-flash-lite',
      prompt: [
        { text: 'Generate 5 descriptive tags for this image. Return JSON: { "tags": ["tag1", "tag2", ...] }.' },
        { media: { url: input.url } }
      ]
    });
    return response.output as { tags: string[] };
  }
);

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
        brandId: input.brandId,
        platforms: input.platforms,
        source: 'manual_input',
      },
    ]);

    const brandRef = db.collection('brands').doc(input.brandId);
    await brandRef.update({ personaConfidence: admin.firestore.FieldValue.increment(5) });

    return { success: true };
  }
);

const captionPrompt = ai.definePrompt(
  {
    name: 'captionPrompt',
    model: primaryModel,
    input: {
      schema: z.object({
        platforms: z.array(z.string()),
        examples: z.string(),
        userPrompt: z.string(),
      }),
    },
    output: {
      format: 'json',
      schema: z.object({
        captions: z.array(z.string()).describe('An array of 3 distinct social media caption options.'),
      }),
    },
    prompt: `
    You are an expert social media manager. Your task is to generate captions for the social media platforms: {{platforms}}.
    Your response must be a valid JSON object with a single key "captions" which is an array of strings, like {"captions": ["caption 1", "caption 2"]}.
    Do not wrap the JSON in markdown backticks.

    First, study these high-quality examples of the brand's voice:
    {{examples}}

    Now, based on that voice, write 3 distinct caption options about the following topic: "{{userPrompt}}"
  `,
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
      filter: { where: 'metadata.brandId', value: input.brandId },
    });

    const examples = similarDocs.map((doc: any) => doc.content).join('\n---\n');

    const result = await captionPrompt({
      platforms: input.platforms,
      examples: examples,
      userPrompt: input.userPrompt,
    });
    
    return result.output || { captions: [] };
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
    const brandRef = db.collection('brands').doc(input.brandId);

    if (input.feedback === 'positive') {
      await personaStore.add([
        {
          content: input.captionText,
          brandId: input.brandId,
          platforms: input.platforms,
          source: 'generated_positive_feedback',
        },
      ]);
      await brandRef.update({ personaConfidence: admin.firestore.FieldValue.increment(2) });
    } else {
      await brandRef.update({ personaConfidence: admin.firestore.FieldValue.increment(-2) });
    }

    return { success: true };
  }
);
