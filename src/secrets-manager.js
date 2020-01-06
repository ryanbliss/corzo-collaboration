import fs from 'fs';

/*
 get secrets once during configuration.
 Don't do a bunch of synchronous file IO every time you need it
*/

export function getJsonSecrets(secretName) {
  const jsonString = fs.readFileSync(`/run/secrets/${secretName}`, 'utf8');
  return JSON.parse(jsonString);
}

export function getStringSecret(secretName) {
  return fs.readFileSync(`/run/secrets/${secretName}`, 'utf8').trim();
}
