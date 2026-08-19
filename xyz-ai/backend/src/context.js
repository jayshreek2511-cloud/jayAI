const MAX_TURNS = 6;
const store = new Map();

export function getHistory(userId) {
  return store.get(userId) ?? [];
}

export function appendTurn(userId, role, text) {
  const history = store.get(userId) ?? [];
  history.push({ role, text });
  while (history.length > MAX_TURNS) history.shift();
  store.set(userId, history);
}
