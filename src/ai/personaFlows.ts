
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

// Only initialize Vision Client if strictly needed, and handle missing creds gracefully
let visionClient: ImageAnnotatorClient | null = null;
try {
  visionClient = new ImageAnnotatorClient();
} catch (e) {
  console.warn('Google Cloud Vision Client could not be initialized. Visual audits may fail.', e);
}

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
    console.log('personaStore.add: Starting embedding...');
    const batch = db.batch();
    for (const item of items) {
      try {
        const embeddings = await ai.embed({
          embedder: embeddingModel,
          content: item.content,
        });
        console.log('personaStore.add: Embedding generated.');
        const docRef = db.collection('brand_persona_examples').doc();
        batch.set(docRef, {
          ...item,
          embedding: embeddings[0].embedding,
        });
      } catch (err) {
        console.error('personaStore.add: Error generating embedding', err);
        throw err;
      }
    }
    console.log('personaStore.add: Committing batch...');
    await batch.commit();
    console.log('personaStore.add: Batch committed.');
  },
  retrieve: async (params: { content: string; k?: number; filter?: any }) => {
    console.log('personaStore.retrieve: Retrieving...', params);
    const result = await ai.retrieve({
      retriever: personaRetriever,
      query: params.content,
      options: {
        limit: params.k,
        where: params.filter?.where === 'metadata.brandId' ? { brandId: params.filter.value } : undefined,
      },
    });
    console.log('personaStore.retrieve: Found docs', result.length);
    return result.map(doc => ({ content: doc.text }));
  },
};

// --- INTERNAL FLOW DEFINITIONS ---

const brandFaceAuditDef = ai.defineFlow(
  { 
    name: 'brandFaceAudit', 
    inputSchema: z.object({ url: z.string(), brandId: z.string() }),
    outputSchema: z.any() 
  },
  async (input) => {
    if (!visionClient) throw new Error("Vision Client not available");
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
         // @ts-ignore
        thinkingBudget: 1024 
      }
    });

    return audit.output;
  }
);

const checkImageSafetyDef = ai.defineFlow(
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

const autoTagImageDef = ai.defineFlow(
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

const generateCaptionFlowDef = ai.defineFlow(
  {
    name: 'generateCaptionFlow',
    inputSchema: z.object({
        brandId: z.string(),
        userPrompt: z.string(),
        platforms: z.array(z.string()),
    }),
    outputSchema: z.object({ captions: z.array(z.string()) }),
  },
  async (input) => {
    console.log('generateCaptionFlow: Retrieving examples...');
    const similarDocs = await personaStore.retrieve({
      content: input.userPrompt,
      k: 3,
      filter: { where: 'metadata.brandId', value: input.brandId },
    });
    console.log('generateCaptionFlow: Examples retrieved:', similarDocs.length);

    const examples = similarDocs.map((doc: any) => doc.content).join('\n---\n');

    console.log('generateCaptionFlow: Generating prompt...');
    const result = await captionPrompt({
      platforms: input.platforms,
      examples: examples,
      userPrompt: input.userPrompt,
    });
    
    return result.output || { captions: [] };
  }
);

const recordFeedbackFlowDef = ai.defineFlow(
  {
    name: 'recordFeedbackFlow',
    inputSchema: z.object({
        brandId: z.string(),
        captionText: z.string(),
        platforms: z.array(z.string()),
        feedback: z.enum(['positive', 'negative']),
    }),
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

const trainPersonaFlowDef = ai.defineFlow(
    {
      name: 'trainPersonaFlow',
      inputSchema: z.object({
        brandId: z.string(),
        captionText: z.string(),
        platforms: z.array(z.string()),
      }),
      outputSchema: z.object({ success: z.boolean() }),
    },
    async (input) => {
      console.log('trainPersonaFlow: Adding to store...');
      await personaStore.add([
        {
          content: input.captionText,
          brandId: input.brandId,
          platforms: input.platforms,
          source: 'manual_input',
        },
      ]);
      console.log('trainPersonaFlow: Updating confidence...');
  
      const brandRef = db.collection('brands').doc(input.brandId);
      await brandRef.update({ personaConfidence: admin.firestore.FieldValue.increment(5) });
  
      return { success: true };
    }
);


// --- EXPORTED SERVER ACTIONS ---

export async function runBrandFaceAudit(url: string, brandId: string) {
    console.log('Action: runBrandFaceAudit');
    return await brandFaceAuditDef({ url, brandId });
}

export async function runCheckImageSafety(base64: string, mimeType: string) {
    console.log('Action: runCheckImageSafety');
    return await checkImageSafetyDef({ base64, mimeType });
}

export async function runAutoTagImage(url: string) {
    console.log('Action: runAutoTagImage');
    return await autoTagImageDef({ url });
}

export async function trainPersonaFlow(input: { brandId: string, captionText: string, platforms: string[] }) {
    console.log('Action: trainPersonaFlow', input);
    try {
        const res = await trainPersonaFlowDef(input);
        return res;
    } catch (e) {
        console.error('Action Error: trainPersonaFlow', e);
        throw e;
    }
}

export async function generateCaptionFlow(input: { brandId: string, userPrompt: string, platforms: string[] }) {
    console.log('Action: generateCaptionFlow', input);
    try {
        const res = await generateCaptionFlowDef(input);
        return res;
    } catch (e) {
        console.error('Action Error: generateCaptionFlow', e);
        throw e;
    }
}

export async function recordFeedbackFlow(input: { brandId: string, captionText: string, platforms: string[], feedback: 'positive' | 'negative' }) {
    console.log('Action: recordFeedbackFlow');
    try {
        const res = await recordFeedbackFlowDef(input);
        return res;
    } catch (e) {
        console.error('Action Error: recordFeedbackFlow', e);
        throw e;
    }
}
