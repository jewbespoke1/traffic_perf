import { NextResponse } from 'next/server';

import {
  generateInitialSnapshot,
  getEmphasisWeights,
  initTrafficModel,
  setCircadianProfile,
  setSubdomainWeights,
  setTrafficRate,
} from '@/lib/dataGenerator';

export async function GET() {
  initTrafficModel(Date.now());
  setTrafficRate(10_000);
  setCircadianProfile(true);
  setSubdomainWeights(getEmphasisWeights());
  const snapshot = generateInitialSnapshot(5);

  return NextResponse.json({ snapshot });
}

