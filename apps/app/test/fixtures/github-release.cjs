// Route only this test repository's release assets to the local HTTP fixture.
// The bundled npm still classifies, fetches, caches and installs the original URL.
const https = require("node:https");
const http = require("node:http");
const original = https.request;
https.request = function (options, ...args) {
  if (
    options.hostname === "github.com" &&
    options.path?.startsWith("/intloom-test/looms/releases/download/")
  ) {
    const url = new URL(process.env.npm_config_registry);
    return http.request(
      {
        ...options,
        protocol: url.protocol,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        agent: false,
      },
      ...args,
    );
  }
  return original.call(this, options, ...args);
};
