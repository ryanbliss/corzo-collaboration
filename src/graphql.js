/* eslint-disable no-console */
import { GraphQLClient } from 'graphql-request';

export async function createNewNote(associations, token) {
  const client = new GraphQLClient('http://corzo-service:8080/graphql', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const query = `mutation NewNote($associations: [Association!]!) {
    newNote(associations: $associations) {
      id
      title
      previewText
      createdAt
      editedAt
      associations {
        id
      }
    }
  }`;

  const variables = {
    associations,
  };
  return client.request(query, variables).then((note) => {
    console.log(note);
    return note.newNote;
  });
}

export async function deleteNote(noteId, token) {
  console.log('deleting note', noteId);
  const client = new GraphQLClient('http://corzo-service:8080/graphql', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const query = `mutation DeleteNote($id: UUID!) {
    deleteNote(id: $id)
  }`;

  const variables = {
    id: noteId,
  };
  return client.request(query, variables).then(() => {
    console.log('note deleted');
  });
}
