/// <reference lib="WebWorker" />

import { start } from './alloy-server-start.js';

declare const self: DedicatedWorkerGlobalScope;

start(self, 'alloy-server');
