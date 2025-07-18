const wsMap = /* @__PURE__ */ new WeakMap();
const attacher = { attach: null };
function attachImpl(standard, ws) {
  if (wsMap.has(standard)) {
    throw new Error("WebSocket already attached");
  }
  wsMap.set(standard, ws);
}
attacher.attach = attachImpl;
function attach(standard, ws) {
  return attacher.attach?.(standard, ws);
}
export {
  attach
};
