// Bounded, volatile history. Never writes media or Telegram data to storage.
export function createStoryHistory(limit = 24) {
  let past = [], future = [], identity = '';
  // Reuse immutable image strings; only copy small mutable composition fields.
  const copy = value => value == null ? null : {
    ...value, layers: value.layers?.map(layer => ({...layer})) || [],
    portal: value.portal == null ? null : structuredClone(value.portal)
  };
  const same = (a, b) => {
    if (a?.imageDataUrl !== b?.imageDataUrl) return false;
    const {imageDataUrl: _a, ...smallA} = a || {};
    const {imageDataUrl: _b, ...smallB} = b || {};
    return JSON.stringify(smallA) === JSON.stringify(smallB);
  };
  function trimMediaBudget() {
    // Distinct photos across undo states can be large on a 4 GB device.
    const images = new Set(); let bytes = 0;
    for (let i = past.length - 1; i >= 0; i--) {
      const photo = past[i].imageDataUrl;
      if (photo && !images.has(photo)) { images.add(photo); bytes += photo.length * 2; }
      if (bytes > 32 * 1024 * 1024) { past = past.slice(i + 1); break; }
    }
  }
  return {
    reset(owner, draftId) { identity = `${owner}:${draftId}`; past = []; future = []; },
    checkpoint(draft, owner) {
      if (!draft || identity !== `${owner}:${draft.id}`) return false;
      if (!past.length || !same(past.at(-1), draft)) past.push(copy(draft));
      past = past.slice(-limit); trimMediaBudget(); future = []; return true;
    },
    undo(draft, owner) {
      if (!draft || identity !== `${owner}:${draft.id}`) return null;
      while (past.length && same(past.at(-1), draft)) past.pop();
      if (!past.length) return null;
      future.push(copy(draft)); return past.pop();
    },
    redo(draft, owner) {
      if (!draft || identity !== `${owner}:${draft.id}` || !future.length) return null;
      past.push(copy(draft)); return future.pop();
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; }
  };
}
