const { Resolver } = require('dns').promises;
const resolver = new Resolver();

// use google DNS servers
resolver.setServers(['8.8.8.8', '8.8.4.4']);

export async function getIpAddressesForHostName (hostname: string): Promise<string[]> {
  let addresses: string[] = [];

  let IPv4Addresses = await resolver.resolve4(hostname);

  console.log(`found ${IPv4Addresses.length} IPv4 addresse(s)`, IPv4Addresses);
  addresses = addresses.concat(IPv4Addresses);

  // wrap in try catch, if no ipv6 is found it will throw an error otherwise.
  try {
    let IPv6Addresses = await resolver.resolve6(hostname);
    console.log(`found ${IPv6Addresses.length} IPv6 addresse(s)`, IPv6Addresses);
    addresses = addresses.concat(IPv6Addresses);
  } catch (error) {
    if (error.code !== 'ENODATA') {
      throw error;
    }
    console.log('could not find any IPv6 addresses');
  }

  console.log(`Found a total of ${addresses.length} IPAddress for hostname ${hostname}`);
  return addresses;
}
