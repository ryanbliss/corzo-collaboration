import fs from 'fs';

/*
 get secrets once during configuration.
 Don't do a bunch of synchronous file IO every time you need it
*/

export function getJsonSecrets(secretPath) {
  const jsonString = fs.readFileSync(secretPath, 'utf8');
  return JSON.parse(jsonString);
}

export function getStringSecret(secretPath) {
  return fs.readFileSync(secretPath, 'utf8').trim();
}
