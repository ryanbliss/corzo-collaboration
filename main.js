/* eslint-disable no-console */
import http from 'http';
import express from 'express';
import ShareDB from 'sharedb';
import WebSocket from 'ws';
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import parseJwt from './src/auth';

const app = express();
app.use(express.static('static'));
const server = http.createServer(app);
const backend = new ShareDB();
const connection = backend.connect();

function getNoteDocument(orgId, note, ws, callback) {
  const doc = connection.get(`${orgId}/notes`, note.id);
  doc.fetch((err) => {
    if (err) throw err;
    if (doc.type === null) {
      doc.create({
        title: note.title,
        content: note.content,
        associations: note.associations,
      }, callback);
      return;
    }
    callback(ws);
  });
}

function beginStream(ws) {
  const stream = new WebSocketJSONStream(ws);
  backend.listen(stream);
}

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  // Connect any incoming WebSocket connection to ShareDB
  const wss = new WebSocket.Server({ server });
  wss.on('connection', (ws, req) => {
    const { data } = req.body;
    if (!req.headers('Authorization').includes('Bearer ')) {
      throw new Error('No Bearer in authorization header');
    }
    try {
      const accessToken = req.headers('Authorization')
        .split(' ')[1];
      // TODO: figure out how req.headers works and get it
      const { orgId } = parseJwt(accessToken);
      if (data.note) {
        // this is an existing note
        // //TODO: get the stored document from the database and open a connection to that doc
        getNoteDocument(orgId, data.note, ws, beginStream);
      }
    } catch (err) {
      throw new Error('No token found within Authorization header');
    }
  });

  server.listen(8081);
  console.log('Listening on http://localhost:8081');
}
startServer();
