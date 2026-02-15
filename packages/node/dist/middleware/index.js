function createStatsMiddleware() {
  return async (_context, next) => {
    return next();
  };
}
export {
  createStatsMiddleware
};
