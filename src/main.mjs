/**
 * @fileoverview Container and CLI entrypoint for the Sonaraim Admin Console HTTP server.
 */

import http from 'node:http';
import { loadAdminConfig } from './config.mjs';
import { createAdminRequestHandler } from './server.mjs';

const config = loadAdminConfig(process.env);
const host = String(process.env.ADMIN_HTTP_HOST ?? '0.0.0.0').trim() || '0.0.0.0';
const server = http.createServer(createAdminRequestHandler(config));

server.listen(config.adminHttpPort, host, () => {
  console.log(
    JSON.stringify({
      level: 'INFO',
      service: 'sonaraim-admin',
      status: 'listening',
      host,
      port: config.adminHttpPort,
    })
  );
});
