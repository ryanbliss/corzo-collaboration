/* eslint-disable no-console */
const lockedNotes = [];

export function isLocked(noteId) {
  return lockedNotes.find(value => noteId === value) != null;
}

export function setLocked(noteId) {
  if (!isLocked(noteId)) {
    lockedNotes.push(noteId);
  } else {
    console.log(`note ${noteId} is already locked`);
  }
}

export function setUnlocked(noteId) {
  for (let i = 0; i < lockedNotes.length; i += 1) {
    if (lockedNotes[i] === noteId) {
      lockedNotes.splice(i, 1);
      return;
    }
  }
  console.log(`note ${noteId} is already unlocked`);
}
