/* eslint-disable no-console,no-trailing-spaces */
import jwt from 'jsonwebtoken';
import { Step } from 'prosemirror-transform';
import schema from './schema';
import { getDoc, storeDoc } from './docsRepo';
import { storeSteps, getSteps } from './steps';
import { setUnlocked, setLocked, isLocked } from './noteLock';

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
const sleep = ms => (new Promise(resolve => setTimeout(resolve, ms)));

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
