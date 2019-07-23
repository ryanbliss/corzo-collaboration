/* eslint-disable no-console */
import { GraphQLClient } from 'graphql-request';

export default function createNewNote(associations, token) {
  const client = new GraphQLClient('http://corzo-service:8080/graphql', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const query = `mutation newNote($associations: [Association!]!) {
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
    return note;
  });
}
