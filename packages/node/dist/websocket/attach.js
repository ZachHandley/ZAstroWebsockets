const attacher = { attach: null };
function attach(standard, ws) {
  return attacher.attach?.(standard, ws);
}
export {
  attach,
  attacher
};
