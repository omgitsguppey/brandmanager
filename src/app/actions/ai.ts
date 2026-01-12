
'use server';

import { runBrandFaceAudit as _runBrandFaceAudit, runCheckImageSafety as _runCheckImageSafety, runAutoTagImage as _runAutoTagImage } from '@/ai/personaFlows';

export async function runBrandFaceAudit(url: string, brandId: string) {
  return await _runBrandFaceAudit(url, brandId);
}

export async function runCheckImageSafety(base64: string, mimeType: string) {
  return await _runCheckImageSafety(base64, mimeType);
}

export async function runAutoTagImage(url: string) {
  return await _runAutoTagImage(url);
}
