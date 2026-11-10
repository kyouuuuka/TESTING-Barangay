import net from 'node:net';

// Allow list: localhost + private LAN ranges. Everything else gets 403.
const lan = new net.BlockList();
lan.addSubnet('127.0.0.0', 8);
lan.addSubnet('10.0.0.0', 8);
lan.addSubnet('172.16.0.0', 12);
lan.addSubnet('192.168.0.0', 16);
lan.addAddress('::1', 'ipv6');

export const isLan = (ip) => net.isIP(ip ?? '') !== 0 && lan.check(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4');

export function lanOnly(req, res, next) {
  if (isLan(req.ip)) return next();
  res.status(403).send('This system is only available on the barangay network.');
}
