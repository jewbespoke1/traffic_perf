/// <reference lib="webworker" />

import {
  getEmphasisWeights,
  initTrafficModel,
  nextRequestBatch,
  randomBurst,
  setCircadianProfile,
  setSubdomainWeights,
  setTrafficRate,
} from '../lib/dataGenerator';
import { RequestEvent } from '../lib/types';

declare const self: DedicatedWorkerGlobalScope;

const ctx: DedicatedWorkerGlobalScope = self;
const INTERVAL_MS = 100;
const BATCH_CAP = 20_000;

let timer: number | null = null;
let dropped = 0;

ctx.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const message = event.data;
  switch (message.type) {
    case 'start':
      startLoop(message);
      break;
    case 'setRate':
      setTrafficRate(message.rps);
      break;
    case 'setProfile':
      setCircadianProfile(message.enabled);
      break;
    case 'stop':
      stopLoop();
      break;
    default:
      break;
  }
};

function startLoop(params: WorkerStartMessage) {
  stopLoop();
  initTrafficModel(params.seed ?? Date.now());
  setTrafficRate(params.rps);
  setCircadianProfile(params.profile);
  randomBurst(params.burst?.probabilityPerSec ?? 0.04, params.burst?.multiplier ?? 2.5);
  setSubdomainWeights(getEmphasisWeights());
  timer = ctx.setInterval(() => {
    const events = nextRequestBatch(INTERVAL_MS);
    let payload: RequestEvent[];
    if (events.length > BATCH_CAP) {
      dropped += events.length - BATCH_CAP;
      payload = events.slice(0, BATCH_CAP);
    } else {
      payload = events;
    }
    ctx.postMessage({ type: 'batch', events: payload, dropped });
  }, INTERVAL_MS);
}

function stopLoop() {
  if (timer !== null) {
    ctx.clearInterval(timer);
    timer = null;
  }
}

type WorkerStartMessage = {
  type: 'start';
  rps: number;
  profile: boolean;
  seed?: number;
  burst?: { probabilityPerSec: number; multiplier: number };
};

type WorkerInbound =
  | WorkerStartMessage
  | { type: 'setRate'; rps: number }
  | { type: 'setProfile'; enabled: boolean }
  | { type: 'stop' };

type WorkerOutbound = { type: 'batch'; events: RequestEvent[]; dropped: number };

export type { WorkerOutbound };
