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
const simulateSlowServerDelay = 500; // milliseconds
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
          console.log('Note is saved!');
        });
    } else {
      // The file already exists
      console.log('note saved');
      fs.writeFileSync(docPath, JSON.stringify(data, null, 2));
    }
  });
}

function storeSteps({ steps, version }, meta) {
  const docPath = getDocPath('steps', meta);
  fs.open(docPath, 'r', (err) => {
    if (err) {
      const newData = [
        ...steps.map((step, index) => ({
          step: JSON.parse(JSON.stringify(step)),
          version: version + index + 1,
          clientID: step.clientID,
        })),
      ];
      fs.writeFile(docPath, JSON.stringify(newData),
        { overwrite: false }, (writeErr) => {
          if (writeErr) throw writeErr;
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
    console.log(e);
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
    };
    socket.on('update', async ({
      version, clientID, steps, editedAssociations,
    }) => {
      if (!editedAssociations) {
        // TODO: client needs to actually send these lol
      }
      // we need to check if there is another update processed
      // so we store a "locked" state
      console.log('attempting to update document', meta.noteId);
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
      const sendSteps = getSteps(version, meta);
      if (meta.noteId) {
        io.to(meta.noteId).emit('update', {
          version: newVersion,
          steps: sendSteps,
        });
      } else {
        console.log('no note id');
      }

      storeLocked(false);
    });
    socket.on('getNote', async (noteId) => {
      if (!noteId) {
        throw new Error('Socket Eror:: getNote: no noteId');
      }
      if (meta.noteId) {
        // the user is already in a room
        socket.leave(meta.noteId);
      }
      meta.noteId = noteId;
      socket.join(noteId);
      // send latest document
      socket.emit('getNote', getDoc(meta));
    });
    socket.on('createNote', async (associations) => {
      if (!associations) {
        throw new Error('Socket Eror:: createNote: no associations');
      }
      if (meta.noteId) {
        // the user is already in a room
        socket.leave(meta.noteId);
      }
      // TODO: create a new note and assign the noteId to meta
      const noteId = 'blahblah';
      meta.noteId = noteId;
      socket.join(noteId);
      // send latest document
      socket.emit('createNote', {
        noteId,
        data: getDoc(meta),
      });
    });

    socket.emit('init');

    // send client count
    let clientCount = io.of('/').in(meta.noteId).clients.length;
    io.to(meta.noteId).emit('getCount', clientCount);
    socket.on('disconnect', () => {
      clientCount = io.of('/').in(meta.noteId).clients.length;
      if (clientCount > 0) {
        io.to(meta.noteId).emit('getCount', clientCount);
      } else {
        // TODO: if the note has no title or text, remove the note
        console.log('all clients have left the room');
      }
    });
  });
