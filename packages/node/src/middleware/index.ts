import type { MiddlewareHandler } from 'astro'

export function createStatsMiddleware(): MiddlewareHandler {
  return async (_context, next) => {
    return next()
  }
}