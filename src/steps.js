/* eslint-disable no-console */
import fs from 'fs';

const maxStoredSteps = 1000;

function getStepsPath(meta) {
  return `./src/data/steps/${meta.orgId}${meta.noteId}.json`;
}

export function storeSteps({ steps, version }, meta) {
  const docPath = getStepsPath(meta);
  fs.open(docPath, 'r', (err) => {
    if (err) {
      const newData = [
        ...steps.map((step, index) => ({
          step: JSON.parse(JSON.stringify(step)),
          version: version + index + 1,
          clientID: step.clientID,
        })),
      ];
      fs.writeFile(docPath, JSON.stringify(newData),
        { overwrite: false }, (writeErr) => {
          if (writeErr) throw writeErr;
        });
    } else {
      // The file already exists
      const oldData = JSON.parse(fs.readFileSync(docPath, 'utf8'));
      const limitedOldData = oldData.slice(Math.max(oldData.length - maxStoredSteps));

      const newData = [
        ...limitedOldData,
        ...steps.map((step, index) => ({
          step: JSON.parse(JSON.stringify(step)),
          version: version + index + 1,
          clientID: step.clientID,
        })),
      ];
      fs.writeFileSync(docPath, JSON.stringify(newData));
    }
  });
}

export function getSteps(version, meta) {
  const docPath = getStepsPath(meta);
  try {
    const steps = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    return steps.filter(step => step.version > version);
  } catch (e) {
    console.log(e);
    return [];
  }
}
