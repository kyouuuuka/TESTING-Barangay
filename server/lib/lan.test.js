import test from 'node:test';
import assert from 'node:assert/strict';
import { isLan } from './lan.js';

test('LAN allow list', () => {
  for (const ip of ['127.0.0.1', '::1', '10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.1.5', '::ffff:192.168.1.5'])
    assert.ok(isLan(ip), `${ip} should be allowed`);
  for (const ip of ['8.8.8.8', '172.32.0.1', '11.0.0.1', '193.168.1.1', '2001:4860::8888', '::ffff:8.8.8.8', '', undefined, 'garbage'])
    assert.ok(!isLan(ip), `${ip} should be blocked`);
});
