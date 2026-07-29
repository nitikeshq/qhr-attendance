const fs = require('fs/promises');
const path = require('path');
const { createSeedData } = require('./seedData');

const RETRYABLE_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

function defaultDataFile() {
  const configured = process.env.QHR_DATA_FILE || './data/dev-db.json';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

// Windows can transiently refuse a rename over an existing file while another
// handle (indexer, antivirus, previous write) is still closing. Retry briefly.
async function replaceFile(temporaryPath, targetPath, attempts = 12) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(temporaryPath, targetPath);
      return;
    } catch (error) {
      if (!RETRYABLE_RENAME_CODES.has(error.code) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(20 * attempt, 120)));
    }
  }
}

class JsonStore {
  constructor(filePath = defaultDataFile()) {
    this.filePath = filePath;
    this.backupPath = `${filePath}.bak`;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async init() {
    if (this.data) return this.data;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        error.message = `Could not load QHR data file ${this.filePath}: ${error.message}`;
        throw error;
      }
      this.data = createSeedData();
      await this.save();
    }

    return this.data;
  }

  async read() {
    return this.init();
  }

  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const payload = `${JSON.stringify(this.data, null, 2)}\n`;
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.${(this.saveCounter = (this.saveCounter || 0) + 1)}.tmp`;
    let handle;
    try {
      handle = await fs.open(temporaryPath, 'wx');
      await handle.writeFile(payload, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      try {
        await fs.copyFile(this.filePath, this.backupPath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await replaceFile(temporaryPath, this.filePath);
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await fs.unlink(temporaryPath).catch(() => {});
      throw error;
    }
  }

  async update(mutator) {
    const run = this.queue.then(async () => {
      const data = await this.init();
      const snapshot = structuredClone(data);
      try {
        const result = await mutator(data);
        await this.save();
        return result;
      } catch (error) {
        this.data = snapshot;
        throw error;
      }
    });

    this.queue = run.catch(() => {});
    return run;
  }

  async reset(nextData = createSeedData()) {
    const previous = this.data;
    this.data = structuredClone(nextData);
    try {
      await this.save();
      return this.data;
    } catch (error) {
      this.data = previous;
      throw error;
    }
  }
}

module.exports = {
  JsonStore,
  defaultDataFile,
};
