
'use server';

import { brandFaceAudit, checkImageSafety, autoTagImage } from '@/ai/personaFlows';

export async function runBrandFaceAudit(url: string, brandId: string) {
  return await brandFaceAudit({ url, brandId });
}

export async function runCheckImageSafety(base64: string, mimeType: string) {
  return await checkImageSafety({ base64, mimeType });
}

export async function runAutoTagImage(url: string) {
  return await autoTagImage({ url });
}
