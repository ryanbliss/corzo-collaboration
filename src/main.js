/* eslint-disable no-console,no-trailing-spaces */
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { Step } from 'prosemirror-transform';
import schema from './schema';
import { getNoteContent, updateNoteContent } from './database';

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
const maxStoredSteps = 1000;

const lockedNotes = [];

const sleep = ms => (new Promise(resolve => setTimeout(resolve, ms)));

function getDocPath(table, meta) {
  return `./src/data/${table}/${meta.orgId}${meta.noteId}.json`;
}

async function storeDoc(data, meta) {
  const noteContent = JSON.stringify(data, null, 2);
  await updateNoteContent(meta.noteId, noteContent);
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

function isLocked(noteId) {
  return lockedNotes.find(value => noteId === value) != null;
}

function setLocked(noteId) {
  if (!isLocked(noteId)) {
    lockedNotes.push(noteId);
  } else {
    console.log(`note ${noteId} is already locked`);
  }
}

function setUnlocked(noteId) {
  for (let i = 0; i < lockedNotes.length; i += 1) {
    if (lockedNotes[i] === noteId) {
      lockedNotes.splice(i, 1);
      return;
    }
  }
  console.log(`note ${noteId} is already unlocked`);
}

async function getDoc(meta) {
  return (await getNoteContent(meta.noteId)).content;
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

io
  .use((socket, next) => {
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
    const parsedToken = jwt.decode(socket.handshake.query.token);
    const meta = {
      orgId: parsedToken.orgId,
      noteId: socket.handshake.query.noteId,
    };
    socket.on('update', async ({ version, clientID, steps }) => {
      // we need to check if there is another update processed
      // so we store a "locked" state
      console.log('attempting to update document');
      const locked = isLocked(meta.noteId);
      if (locked) {
      // we will do nothing and wait for another client update
        return;
      }
      setLocked(meta.noteId);

      const storedData = await getDoc(meta);

      await sleep(simulateSlowServerDelay);

      // version mismatch: the stored version is newer
      // so we send all steps of this version back to the user
      if (storedData.version !== version) {
        const sendSteps = getSteps(version, meta);
        socket.emit('update', {
          version,
          steps: sendSteps,
        });
        setUnlocked(meta.noteId);
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
      await storeDoc({ version: newVersion, doc }, meta);

      await sleep(simulateSlowServerDelay);

      // send update to everyone (me and others)
      io.sockets.emit('update', {
        version: newVersion,
        steps: getSteps(version, meta),
      });

      setUnlocked(meta.noteId);
    });

    // send latest document
    getDoc(meta).then((doc) => {
      socket.emit('init', doc);
    });

    // send client count
    io.sockets.emit('getCount', io.engine.clientsCount);
    socket.on('disconnect', () => {
      io.sockets.emit('getCount', io.engine.clientsCount);
    });
  });
