// Bezpečný zápis súboru pri výpadku prúdu: najprv dočasný súbor, fsync (dáta sú naozaj na karte),
// potom premenovanie a fsync priečinka. Pri výpadku ostane buď starý, alebo nový celý súbor.
import fs from 'node:fs';
import path from 'node:path';

export function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
  try {
    const dir = fs.openSync(path.dirname(file), 'r');
    fs.fsyncSync(dir);
    fs.closeSync(dir);
  } catch {
    // niektoré systémy fsync priečinka nepodporujú
  }
}
