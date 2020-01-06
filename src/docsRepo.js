/* eslint-disable no-console */
import { Pool } from 'pg';
import { getJsonSecrets } from './secrets-manager';

const dbSecrets = getJsonSecrets('core_db_secrets');
const pool = new Pool({
  ssl: true,
  host: dbSecrets.host,
  user: dbSecrets.username,
  password: dbSecrets.password,
  port: dbSecrets.port,
  database: dbSecrets.name,
});

const noteDoesNotExist = Error('Note does not exist');

function getNoteContent(noteId) {
  return pool
    .connect()
    .then(client => client
      .query('SELECT content FROM notes WHERE id = $1', [noteId])
      .then((res) => {
        client.release();
        if (res.rows.length === 1) {
          return res.rows[0];
        }
        throw noteDoesNotExist;
      })
      .catch((e) => {
        if (e !== noteDoesNotExist) {
          client.release();
        }
        console.log(e.stack);
        throw e;
      }));
}

function updateNoteContent(noteId, content) {
  pool
    .connect()
    .then((client) => {
      client
        .query('UPDATE notes SET content = $1 WHERE id = $2', [content, noteId])
        .then((res) => {
          client.release();
          console.log(`note ${noteId} saved, ${res}`);
        })
        .catch((e) => {
          console.log(e);
          client.release();
          throw e;
        });
    });
}

export async function storeDoc(data, meta) {
  const noteContent = JSON.stringify(data, null, 2);
  await updateNoteContent(meta.noteId, noteContent);
}

export async function getDoc(meta) {
  console.log('retrieving doc with id:', meta.noteId);
  return (await getNoteContent(meta.noteId)).content;
}

export async function isDocEmpty(noteId) {
  console.log(`checking to see if note is empty: ${noteId}`);
  const noteContent = (await getNoteContent(noteId)).content;
  console.log(noteContent);

  // check to see if more than title and paragraph node
  if (noteContent.doc.content.length !== 2) return false;

  // check to see if any title content exists
  if (noteContent.doc.content[0].content !== undefined) return false;

  // check to see if any note content exists
  if (noteContent.doc.content[1].content !== undefined) return false;

  console.log(`${noteId} is empty`);
  return true;
}
