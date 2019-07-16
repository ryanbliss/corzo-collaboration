import http from 'http';
import express from 'express';
import ShareDB from 'sharedb';
import WebSocket from 'ws';
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import { checkIfTokenIsValid } from './src/auth';

var app = express();
app.use(express.static('static'));
var server = http.createServer(app);
var backend = new ShareDB();
var connection = backend.connect();

function startServer() {
    // Create a web server to serve files and listen to WebSocket connections
    // Connect any incoming WebSocket connection to ShareDB
    var wss = new WebSocket.Server({server: server});
    wss.on('connection', function(ws, req) {
        const data = req.body.data;
        const accessToken = ''; // TODO: figure out how req.headers works and get it
        if (checkIfTokenIsValid(accessToken)) {
            // TODO: check if token is valid
            if (data.noteId) {
                // this is an existing note
                // //TODO: get the stored document from the database and open a connection to that doc
                getExistingNoteDocument(data.noteId, ws, beginStream);
            } else {
                // this is a new note
                // they will provide a primary association id (i.e. contact, account, opportunity, lead)
                // they will also provide an optional secondary association id (i.e. account)
                // check to see if there is a pre-existing document, if so then open a connection
                // if there isnt then create a new document and open a connection to that doc
                createNewNoteDocument(data.associations, ws, beginStream);
            }
        } else {
            throw new Error('Access token is invalid')
        }
    });
  
    server.listen(8080);
    console.log('Listening on http://localhost:8080');
}

createDoc(startServer);

// Create initial document then fire callback
function createNewNoteDocument(associations, ws, callback) {
  var doc = connection.get('orgId/notes/new', 'primaryAssociationId');
  doc.fetch(function(err) {
    if (err) throw err;
    if (doc.type === null) {
      doc.create({ title: '', content: '', associations }, callback);
      return;
    }
    callback(ws);
  });
}

function getExistingNoteDocument(noteId, ws, callback) {
    var doc = connection.get('orgId/notes/existing', noteId);
    doc.fetch(function(err) {
        if (err) throw err;
        callback(ws);
    });
}

function beginStream(ws) {
    var stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
}
