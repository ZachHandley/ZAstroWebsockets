import { createReadStream } from "node:fs";
import { appendFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  appendForwardSlash,
  prependForwardSlash,
  removeLeadingForwardSlash
} from "@astrojs/internal-helpers/path";
import { createRedirectsFromAstroRoutes, printAsRedirects } from "@astrojs/underscore-redirects";
import { AstroError } from "astro/errors";
import { defaultClientConditions } from "vite";
import { getPlatformProxy } from "wrangler";
import {
  cloudflareModuleLoader
} from "./utils/cloudflare-module-loader.js";
import { createGetEnv } from "./utils/env.js";
import { createRoutesFile, getParts } from "./utils/generate-routes-json.js";
import { setImageConfig } from "./utils/image-config.js";
function wrapWithSlashes(path) {
  return prependForwardSlash(appendForwardSlash(path));
}
function setProcessEnv(config, env) {
  const getEnv = createGetEnv(env);
  if (config.env?.schema) {
    for (const key of Object.keys(config.env.schema)) {
      const value = getEnv(key);
      if (value !== void 0) {
        process.env[key] = value;
      }
    }
  }
}
function createIntegration(args) {
  let _config;
  let finalBuildOutput;
  const cloudflareModulePlugin = cloudflareModuleLoader(
    args?.cloudflareModules ?? true
  );
  let _routes;
  return {
    name: "zastro-websockets-cloudflare",
    hooks: {
      "astro:config:setup": ({
        command,
        config,
        updateConfig,
        logger,
        addWatchFile,
        addMiddleware,
        createCodegenDir
      }) => {
        let session = config.session;
        const isBuild = command === "build";
        if (!session?.driver) {
          const sessionDir = isBuild ? void 0 : createCodegenDir();
          const bindingName = args?.sessionKVBindingName ?? "SESSION";
          if (isBuild) {
            logger.info(
              `Enabling sessions with Cloudflare KV for production with the "${bindingName}" KV binding.`
            );
            logger.info(
              `If you see the error "Invalid binding \`${bindingName}\`" in your build output, you need to add the binding to your wrangler config file.`
            );
          }
          session = isBuild ? {
            ...session,
            driver: "cloudflare-kv-binding",
            options: {
              binding: bindingName,
              ...session?.options
            }
          } : {
            ...session,
            driver: "fs-lite",
            options: {
              base: fileURLToPath(new URL("sessions", sessionDir)),
              ...session?.options
            }
          };
        }
        updateConfig({
          build: {
            client: new URL(`.${wrapWithSlashes(config.base)}`, config.outDir),
            server: new URL("./_worker.js/", config.outDir),
            serverEntry: "index.js",
            redirects: false
          },
          session,
          vite: {
            plugins: [
              // https://developers.cloudflare.com/pages/functions/module-support/
              // Allows imports of '.wasm', '.bin', and '.txt' file types
              cloudflareModulePlugin,
              {
                name: "vite:cf-imports",
                enforce: "pre",
                resolveId(source) {
                  if (source.startsWith("cloudflare:")) {
                    return { id: source, external: true };
                  }
                  return null;
                }
              }
            ]
          },
          image: setImageConfig(args?.imageService ?? "compile", config.image, command, logger)
        });
        if (args?.platformProxy?.configPath) {
          addWatchFile(new URL(args.platformProxy.configPath, config.root));
        } else {
          addWatchFile(new URL("./wrangler.toml", config.root));
          addWatchFile(new URL("./wrangler.json", config.root));
          addWatchFile(new URL("./wrangler.jsonc", config.root));
        }
        addMiddleware({
          entrypoint: "zastro-websockets-cloudflare/entrypoints/middleware.js",
          order: "pre"
        });
      },
      "astro:routes:resolved": ({ routes }) => {
        _routes = routes;
      },
      "astro:config:done": ({ setAdapter, config, buildOutput, logger }) => {
        if (buildOutput === "static") {
          logger.warn(
            "[@astrojs/cloudflare] This adapter is intended to be used with server rendered pages, which this project does not contain any of. As such, this adapter is unnecessary."
          );
        }
        _config = config;
        finalBuildOutput = buildOutput;
        let customWorkerEntryPoint;
        if (args?.workerEntryPoint && typeof args.workerEntryPoint.path === "string") {
          const require2 = createRequire(config.root);
          try {
            customWorkerEntryPoint = pathToFileURL(require2.resolve(args.workerEntryPoint.path));
          } catch {
            customWorkerEntryPoint = new URL(args.workerEntryPoint.path, config.root);
          }
        }
        setAdapter({
          name: "zastro-websockets-cloudflare",
          serverEntrypoint: customWorkerEntryPoint ?? "zastro-websockets-cloudflare/entrypoints/server.js",
          exports: args?.workerEntryPoint?.namedExports ? ["default", ...args.workerEntryPoint.namedExports] : ["default"],
          adapterFeatures: {
            edgeMiddleware: false,
            buildOutput: "server"
          },
          supportedAstroFeatures: {
            serverOutput: "stable",
            hybridOutput: "stable",
            staticOutput: "unsupported",
            i18nDomains: "experimental",
            sharpImageService: {
              support: "limited",
              message: 'Cloudflare does not support sharp at runtime. However, you can configure `imageService: "compile"` to optimize images with sharp on prerendered pages during build time.',
              // For explicitly set image services, we suppress the warning about sharp not being supported at runtime,
              // inferring the user is aware of the limitations.
              suppress: args?.imageService ? "all" : "default"
            },
            envGetSecret: "stable"
          }
        });
      },
      "astro:server:setup": async ({ server }) => {
        if ((args?.platformProxy?.enabled ?? true) === true) {
          const platformProxy = await getPlatformProxy(args?.platformProxy);
          server.httpServer?.on("close", async () => {
            await platformProxy.dispose();
          });
          setProcessEnv(_config, platformProxy.env);
          const clientLocalsSymbol = Symbol.for("astro.locals");
          server.middlewares.use(async function middleware(req, _res, next) {
            Reflect.set(req, clientLocalsSymbol, {
              runtime: {
                env: platformProxy.env,
                cf: platformProxy.cf,
                caches: platformProxy.caches,
                ctx: {
                  waitUntil: (promise) => platformProxy.ctx.waitUntil(promise),
                  // Currently not available: https://developers.cloudflare.com/pages/platform/known-issues/#pages-functions
                  passThroughOnException: () => {
                    throw new AstroError(
                      "`passThroughOnException` is currently not available in Cloudflare Pages. See https://developers.cloudflare.com/pages/platform/known-issues/#pages-functions."
                    );
                  }
                }
              }
            });
            next();
          });
        }
      },
      "astro:build:setup": ({ vite, target }) => {
        if (target === "server") {
          vite.resolve ||= {};
          vite.resolve.alias ||= {};
          const aliases = [
            {
              find: "react-dom/server",
              replacement: "react-dom/server.browser"
            }
          ];
          if (Array.isArray(vite.resolve.alias)) {
            vite.resolve.alias = [...vite.resolve.alias, ...aliases];
          } else {
            for (const alias of aliases) {
              vite.resolve.alias[alias.find] = alias.replacement;
            }
          }
          vite.ssr ||= {};
          vite.ssr.resolve ||= {};
          vite.ssr.resolve.conditions ||= [...defaultClientConditions];
          vite.ssr.resolve.conditions.push("workerd", "worker");
          vite.ssr.target = "webworker";
          vite.ssr.noExternal = true;
          vite.build ||= {};
          vite.build.rollupOptions ||= {};
          vite.build.rollupOptions.output ||= {};
          vite.build.rollupOptions.output.banner ||= "globalThis.process ??= {}; globalThis.process.env ??= {};";
          vite.define = {
            "process.env": "process.env",
            // Allows the request handler to know what the binding name is
            "globalThis.__ASTRO_SESSION_BINDING_NAME": JSON.stringify(
              args?.sessionKVBindingName ?? "SESSION"
            ),
            ...vite.define
          };
        }
      },
      "astro:build:done": async ({ pages, dir, logger, assets }) => {
        await cloudflareModulePlugin.afterBuildCompleted(_config);
        let redirectsExists = false;
        try {
          const redirectsStat = await stat(new URL("./_redirects", _config.outDir));
          if (redirectsStat.isFile()) {
            redirectsExists = true;
          }
        } catch (_error) {
          redirectsExists = false;
        }
        const redirects = [];
        if (redirectsExists) {
          const rl = createInterface({
            input: createReadStream(new URL("./_redirects", _config.outDir)),
            crlfDelay: Number.POSITIVE_INFINITY
          });
          for await (const line of rl) {
            const parts = line.split(" ");
            if (parts.length >= 2) {
              const p = removeLeadingForwardSlash(parts[0]).split("/").filter(Boolean).map((s) => {
                const syntax = s.replace(/\/:.*?(?=\/|$)/g, "/*").replace(/\?.*$/, "");
                return getParts(syntax);
              });
              redirects.push(p);
            }
          }
        }
        let routesExists = false;
        try {
          const routesStat = await stat(new URL("./_routes.json", _config.outDir));
          if (routesStat.isFile()) {
            routesExists = true;
          }
        } catch (_error) {
          routesExists = false;
        }
        if (!routesExists) {
          await createRoutesFile(
            _config,
            logger,
            _routes,
            pages,
            redirects,
            args?.routes?.extend?.include,
            args?.routes?.extend?.exclude
          );
        }
        const trueRedirects = createRedirectsFromAstroRoutes({
          config: _config,
          routeToDynamicTargetMap: new Map(
            Array.from(
              _routes.filter((route) => route.type === "redirect").map((route) => [route, ""])
            )
          ),
          dir,
          buildOutput: finalBuildOutput,
          assets
        });
        if (!trueRedirects.empty()) {
          try {
            await appendFile(
              new URL("./_redirects", _config.outDir),
              printAsRedirects(trueRedirects)
            );
          } catch (_error) {
            logger.error("Failed to write _redirects file");
          }
        }
      }
    }
  };
}
export {
  createIntegration as default
};
