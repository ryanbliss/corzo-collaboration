/* eslint-disable no-console */
import { GraphQLClient } from 'graphql-request';

const { createDeleteUrl } = process.env;

export async function createNewNote(primaryAssociationId, associations, token, traceId) {
  const client = new GraphQLClient(createDeleteUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      TraceId: traceId,
    },
  });
  const query = `mutation NewNote($primaryAssociationId: UUID!, $associations: [Association!]!) {
    newNote(primaryAssociationId: $primaryAssociationId, associations: $associations) {
      id
      title
      previewText
      createdAt
      editedAt
      primaryAssociationId
      associations {
        id
        name
        __typename
      }
    }
  }`;

  const variables = {
    primaryAssociationId,
    associations,
  };
  return client.request(query, variables).then((note) => {
    console.log(note);
    return note.newNote;
  });
}

export async function deleteNote(noteId, token, traceId) {
  console.log('deleting note', noteId);
  const client = new GraphQLClient(createDeleteUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      TraceId: traceId,
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
