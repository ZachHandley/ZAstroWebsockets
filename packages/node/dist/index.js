import { fileURLToPath } from "node:url";
import { writeJson } from "@astrojs/internal-helpers/fs";
import { AstroError } from "astro/errors";
import { STATIC_HEADERS_FILE } from "./shared.js";
function getAdapter(options) {
  return {
    name: "zastro-websockets-node",
    serverEntrypoint: "zastro-websockets-node/server.js",
    previewEntrypoint: "zastro-websockets-node/preview.js",
    exports: ["handler", "startServer", "options"],
    args: options,
    adapterFeatures: {
      buildOutput: "server",
      edgeMiddleware: false,
      experimentalStaticHeaders: options.experimentalStaticHeaders
    },
    supportedAstroFeatures: {
      hybridOutput: "stable",
      staticOutput: "stable",
      serverOutput: "stable",
      sharpImageService: "stable",
      i18nDomains: "experimental",
      envGetSecret: "stable"
    }
  };
}
function createIntegration(userOptions) {
  if (!userOptions?.mode) {
    throw new AstroError(`Setting the 'mode' option is required.`);
  }
  let _options;
  let _config = void 0;
  let _routeToHeaders = void 0;
  return {
    name: "zastro-websockets-node",
    hooks: {
      "astro:config:setup": async ({ updateConfig, config, logger }) => {
        let session = config.session;
        _config = config;
        if (!session?.driver) {
          logger.info("Enabling sessions with filesystem storage");
          session = {
            ...session,
            driver: "fs-lite",
            options: {
              base: fileURLToPath(new URL("sessions", config.cacheDir))
            }
          };
        }
        updateConfig({
          image: {
            endpoint: {
              route: config.image.endpoint.route ?? "_image",
              entrypoint: config.image.endpoint.entrypoint ?? "astro/assets/endpoint/node"
            }
          },
          session,
          vite: {
            ssr: {
              noExternal: ["@astrojs/node"]
            }
          }
        });
      },
      "astro:build:generated": ({ experimentalRouteToHeaders }) => {
        _routeToHeaders = experimentalRouteToHeaders;
      },
      "astro:config:done": ({ setAdapter, config }) => {
        _options = {
          ...userOptions,
          client: config.build.client?.toString(),
          server: config.build.server?.toString(),
          host: config.server.host,
          port: config.server.port,
          assets: config.build.assets,
          experimentalStaticHeaders: userOptions.experimentalStaticHeaders ?? false
        };
        setAdapter(getAdapter(_options));
      },
      "astro:build:done": async () => {
        if (!_config) {
          return;
        }
        if (_routeToHeaders && _routeToHeaders.size > 0) {
          const headersFileUrl = new URL(STATIC_HEADERS_FILE, _config.outDir);
          const headersValue = [];
          for (const [pathname, { headers }] of _routeToHeaders.entries()) {
            if (_config.experimental.csp) {
              const csp = headers.get("Content-Security-Policy");
              if (csp) {
                headersValue.push({
                  pathname,
                  headers: [
                    {
                      key: "Content-Security-Policy",
                      value: csp
                    }
                  ]
                });
              }
            }
          }
          await writeJson(headersFileUrl, headersValue);
        }
      }
    }
  };
}
export {
  createIntegration as default,
  getAdapter
};
