import { isMaster } from 'cluster';
import { startMaster } from './master';
import { startWorker } from './worker';

if (isMaster) {
  startMaster().catch((error: Error) => {
    console.error('master process crashed', error);
  });
} else {
  startWorker().catch((error: Error) => {
    console.error('worker process crashed', error);
  });
}
