/* eslint-disable no-console */
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { Step } from 'prosemirror-transform';
import schema from './schema';

const express = require('express');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  rejectUnauthorized: false,
});

server.listen(8081);
console.log('Listening on http://localhost:8081');

// options
const simulateSlowServerDelay = 0; // milliseconds
const lockedPath = './src/db_locked.json';
const maxStoredSteps = 1000;
const defaultData = {
  version: 0,
  doc: {
    type: 'doc',
    content: [
      {
        type: 'title',
      },
      {
        type: 'paragraph',
      },
    ],
  },
};

const sleep = ms => (new Promise(resolve => setTimeout(resolve, ms)));

function getDocPath(table, meta) {
  return `./src/data/${table}/${meta.orgId}${meta.noteId}.json`;
}

function storeDoc(data, meta) {
  const docPath = getDocPath('notes', meta);
  fs.open(docPath, 'r', (err) => {
    if (err) {
      fs.writeFile(docPath, JSON.stringify(data, null, 2),
        { overwrite: false }, (writeErr) => {
          if (writeErr) throw writeErr;
          console.log('It\'s saved!');
        });
    } else {
      // The file already exists
      fs.writeFileSync(docPath, JSON.stringify(data, null, 2));
    }
  });
}

function storeSteps({ steps, version }, meta) {
  const docPath = getDocPath('steps', meta);
  fs.open(docPath, 'r', (err) => {
    if (err) {
      fs.writeFile(docPath, JSON.stringify(steps, null, 2),
        { overwrite: false }, (writeErr) => {
          if (writeErr) throw writeErr;
          console.log('It\'s saved!');
        });
    } else {
      // The file already exists
      const oldData = JSON.parse(fs.readFileSync(docPath, 'utf8'));
      const limitedOldData = oldData.slice(Math.max(oldData.length - maxStoredSteps));

      const newData = [
        ...limitedOldData,
        ...steps.map((step, index) => ({
          step: JSON.parse(JSON.stringify(step)),
          version: version + index + 1,
          clientID: step.clientID,
        })),
      ];
      fs.writeFileSync(docPath, JSON.stringify(newData));
    }
  });
}

function storeLocked(locked) {
  fs.writeFileSync(lockedPath, locked.toString());
}

function getDoc(meta) {
  const docPath = getDocPath('notes', meta);
  try {
    return JSON.parse(fs.readFileSync(docPath, 'utf8'));
  } catch (e) {
    return defaultData;
  }
}

function getLocked() {
  return JSON.parse(fs.readFileSync(lockedPath, 'utf8'));
}

function getSteps(version, meta) {
  const docPath = getDocPath('steps', meta);
  try {
    const steps = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    return steps.filter(step => step.version > version);
  } catch (e) {
    return [];
  }
}

io.use((socket, next) => {
  console.log('connection attempt');
  if (socket.handshake.query && socket.handshake.query.token) {
    jwt.verify(socket.handshake.query.token, 'secret', (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      // eslint-disable-next-line no-param-reassign
      socket.decoded = decoded;
      console.log('authenticated user');
      return next();
    });
  } else {
    next(new Error('Authentication error'));
  }
})
  .on('connection', (socket) => {
    const parsedToken = jwt.verify(socket.handshake.query.token, 'secret');
    const meta = {
      orgId: parsedToken.orgId,
      noteId: socket.handshake.query.noteId,
    };
    socket.on('update', async ({ version, clientID, steps }) => {
      // we need to check if there is another update processed
      // so we store a "locked" state
      console.log('attempting to update document');
      const locked = getLocked();
      if (locked) {
      // we will do nothing and wait for another client update
        return;
      }
      storeLocked(true);

      const storedData = getDoc(meta);

      await sleep(simulateSlowServerDelay);

      // version mismatch: the stored version is newer
      // so we send all steps of this version back to the user
      if (storedData.version !== version) {
        const sendSteps = getSteps(version, meta);
        socket.emit('update', {
          version,
          steps: sendSteps,
        });
        storeLocked(false);
        return;
      }

      let doc = schema.nodeFromJSON(storedData.doc);

      await sleep(simulateSlowServerDelay);

      const newSteps = steps.map((step) => {
        const newStep = Step.fromJSON(schema, step);
        newStep.clientID = clientID;

        // apply step to document
        const result = newStep.apply(doc);
        // eslint-disable-next-line prefer-destructuring
        doc = result.doc;

        return newStep;
      });

      await sleep(simulateSlowServerDelay);

      // calculating a new version number is easy
      const newVersion = version + newSteps.length;

      // store data
      storeSteps({ version, steps: newSteps }, meta);
      storeDoc({ version: newVersion, doc }, meta);

      await sleep(simulateSlowServerDelay);

      // send update to everyone (me and others)
      io.sockets.emit('update', {
        version: newVersion,
        steps: getSteps(version, meta),
      });

      storeLocked(false);
    });

    // send latest document
    socket.emit('init', getDoc(meta));

    // send client count
    io.sockets.emit('getCount', io.engine.clientsCount);
    socket.on('disconnect', () => {
      io.sockets.emit('getCount', io.engine.clientsCount);
    });
  });
