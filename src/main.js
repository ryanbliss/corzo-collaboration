/* eslint-disable no-console,no-trailing-spaces */
import jwt from 'jsonwebtoken';
import { Step } from 'prosemirror-transform';
import Socket from 'socket.io/lib/socket';
import schema from './schema';
import { getDoc, isDocEmpty, storeDoc } from './docsRepo';
import { getSteps, storeSteps } from './steps';
import { isLocked, setLocked, setUnlocked } from './noteLock';
import { createNewNote, deleteNote } from './graphql';

const express = require('express');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  rejectUnauthorized: false,
});

server.listen(8081);
console.log('Listening on http://localhost:8081');

// options
const simulateSlowServerDelay = 250; // milliseconds
const sleep = ms => (new Promise(resolve => setTimeout(resolve, ms)));

function getClientCount(noteId) {
  const { length } = io.of('/').in(noteId).clients;
  console.log('getting room count', length, noteId);
  return length;
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
      userId: parsedToken.userId,
      token: socket.handshake.query.token,
    };
    socket.on('update', async ({
      version, clientID, steps, editedAssociations,
    }) => {
      if (!editedAssociations) {
        // TODO: client needs to actually send these lol
      }
      // we need to check if there is another update processed
      // so we store a "locked" state
      const { noteId } = meta;
      console.log('attempting to update document', noteId);
      const locked = isLocked(noteId);
      if (locked) {
      // we will do nothing and wait for another client update
        return;
      }
      try {
        setLocked(noteId);

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
          setUnlocked(noteId);
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
        storeSteps({
          version,
          steps: newSteps,
        }, meta);
        await storeDoc({
          version: newVersion,
          doc,
        }, meta);

        await sleep(simulateSlowServerDelay);

        // send update to everyone (me and others)
        const sendSteps = getSteps(version, meta);
        if (noteId) {
          io.to(noteId)
            .emit('update', {
              version: newVersion,
              steps: sendSteps,
            });
        } else {
          console.log('no note id');
        }
      } finally {
        setUnlocked(noteId);
      }
    });

    socket.on('getNote', async (noteId) => {
      if (!noteId) {
        throw new Error('Socket Error:: getNote: no noteId');
      }
      if (meta.noteId) {
        // the user is already in a room
        await socket.leaveMaybeDelete(meta);
      }
      meta.noteId = noteId;
      socket.joinThenRegister(meta);
      // send latest document
      socket.emit('getNote', await getDoc(meta));
    });
    socket.on('createNote', async ({
      associations,
      primaryAssociationId,
    }) => {
      if (!associations) {
        throw new Error('Socket Error:: createNote: no associations');
      }
      if (meta.noteId) {
        // the user is already in a room
        await socket.leaveMaybeDelete(meta);
      }

      const userAssociation = [{
        id: meta.userId,
        type: 'User',
      }];
      const note = await createNewNote(
        primaryAssociationId,
        associations.concat(userAssociation),
        meta.token,
      );
      meta.noteId = note.id;
      socket.joinThenRegister(meta);
      // send latest document
      socket.emit('createNote', {
        note,
        data: await getDoc(meta),
      });
    });
    socket.on('updateCursorPosition', async (data) => {
      if (!data) {
        throw new Error('Socket Error:: updatePosition: no position');
      }
      // Sending new position all other clients in the room
      socket.to(meta.noteId).emit('updateCursorPosition', {
        userId: meta.userId,
        position: data.position,
      });
    });

    socket.emit('init');

    socket.on('disconnect', async () => {
      await socket.leaveMaybeDelete(meta);
    });
  });

Object.defineProperty(Socket.prototype, 'joinThenRegister', {
  value: async function joinThenRegister(meta) {
    const { noteId } = meta;
    this.join(noteId);
    this.to(noteId).emit('registerUser', meta.userId);
  },
  writable: true,
  configurable: true,
});
Object.defineProperty(Socket.prototype, 'leaveMaybeDelete', {
  value: async function leaveMaybeDelete(meta) {
    const { noteId } = meta;
    this.to(noteId).emit('deregisterUser', meta.userId);
    this.leave(noteId);
    // TODO WHY IS IT THAT THE COUNT IS 1 WHEN I LEAVE
    if (getClientCount(noteId) <= 1 && await isDocEmpty(noteId) === true) {
      await deleteNote(noteId, meta.token);
    }
  },
  writable: true,
  configurable: true,
});
