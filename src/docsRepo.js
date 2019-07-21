/* eslint-disable no-console */
const { Pool } = require('pg');

const pool = new Pool({ ssl: true });

function getNoteContent(noteId) {
  return pool
    .connect()
    .then(client => client
      .query('SELECT content FROM notes WHERE id = $1', [noteId])
      .then((res) => {
        client.release();
        const content = res.rows[0];
        console.log(content);
        return content;
      })
      .catch((e) => {
        client.release();
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
  return (await getNoteContent(meta.noteId)).content;
}
