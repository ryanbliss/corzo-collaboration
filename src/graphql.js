/* eslint-disable no-console */
import { GraphQLClient } from 'graphql-request';

const createDeleteUrl = 'http://corzo-service:8080/graphql';

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

export function deleteNote(noteId, token, traceId) {
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
  // delaying it so it will actually delete due to a race condition.
  // this "marked for deletion" note is invisible to the client due to filtering it out
  // on the graphql service because the note is empty.
  setTimeout(() => {
    client.request(query, variables).then(() => {
      console.log('note deleted');
    });
  }, 5000);
}
