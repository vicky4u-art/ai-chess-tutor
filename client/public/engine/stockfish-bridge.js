/* Bridges lichess stockfish.wasm factory to the simple Web Worker UCI API.
   Must be served next to stockfish.js, stockfish.wasm and stockfish.worker.js. */
const pendingCommands = [];
let stockfish = null;
self.onmessage = (event) => {
  if (stockfish) stockfish.postMessage(String(event.data));
  else pendingCommands.push(String(event.data));
};
try {
  importScripts('./stockfish.js');
  Stockfish().then((engine) => {
    stockfish = engine;
    stockfish.addMessageListener((line) => self.postMessage(String(line)));
    for (const command of pendingCommands) stockfish.postMessage(command);
    pendingCommands.length = 0;
  }).catch((error) => {
    self.postMessage('engine-error:' + String(error?.message ?? error));
  });
} catch (error) {
  self.postMessage('engine-error:' + String(error?.message ?? error));
}
