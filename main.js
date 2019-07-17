/* eslint-disable no-console */
import getUrlVars from './src/helpers/url-params';
import parseJwt from './src/auth';

const http = require('http');
const express = require('express');
const proxy = require('http-proxy-middleware');
const ShareDB = require('sharedb');
const WebSocket = require('ws');
const WebSocketJSONStream = require('@teamwork/websocket-json-stream');
const json0 = require('ot-json0');

// proxy middleware options
const options = {
  target: 'https://corzo.io', // target host
  changeOrigin: true, // needed for virtual hosted sites
  ws: true, // proxy websockets
  router: {
    // when request.headers.host == 'dev.localhost:3000',
    // override target 'http://www.example.org' to 'http://localhost:8000'
    'dev.localhost:8081': 'https://localhost:8080',
  },
};

// create the proxy (without context)
const exampleProxy = proxy(options);

const app = express();
app.use('/realtime', exampleProxy);
// app.use(express.static('node_modules/quill/dist'));
const server = http.createServer(app);
ShareDB.types.register(json0.type);
const backend = new ShareDB();
const connection = backend.connect();

function getNoteDocument(orgId, noteId) {
  // TODO: if note id does not exist, create one
  const doc = connection.get(`${orgId}/notes`, noteId);
  doc.fetch((err) => {
    if (err) throw err;
    if (doc.type === null) {
      console.log('creating note for id', noteId);
      doc.create({ data: { content: [{ content: [{ text: 'hi', type: 'text' }], type: 'paragraph' }], type: 'doc' } }, 'json0');
    }
  });
}

// Create a web server to serve files and listen to WebSocket connections
// Connect any incoming WebSocket connection to ShareDB
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws, req) => {
  const token = ws.protocol;
  const { url } = req;
  try {
    const { noteId } = getUrlVars(url);
    const { orgId } = parseJwt(token);
    if (noteId) {
      // //TODO: get the stored document from the database and open a connection to that doc
      const stream = new WebSocketJSONStream(ws);
      backend.listen(stream);
      getNoteDocument(orgId, noteId);
    }
  } catch (err) {
    throw new Error('No token found within Authorization header');
  }
});

server.listen(8081);
console.log('Listening on http://localhost:8081');
