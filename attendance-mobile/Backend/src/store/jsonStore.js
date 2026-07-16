const fs = require('fs/promises');
const path = require('path');
const { createSeedData } = require('./seedData');

function defaultDataFile() {
  const configured = process.env.QHR_DATA_FILE || './data/dev-db.json';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

class JsonStore {
  constructor(filePath = defaultDataFile()) {
    this.filePath = filePath;
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
      if (error.code !== 'ENOENT') throw error;
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
    await fs.writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
  }

  async update(mutator) {
    const run = this.queue.then(async () => {
      const data = await this.init();
      const result = await mutator(data);
      await this.save();
      return result;
    });

    this.queue = run.catch(() => {});
    return run;
  }

  async reset(nextData = createSeedData()) {
    this.data = nextData;
    await this.save();
    return this.data;
  }
}

module.exports = {
  JsonStore,
  defaultDataFile,
};
