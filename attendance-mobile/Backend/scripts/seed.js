const path = require('path');
const { JsonStore, defaultDataFile } = require('../src/store/jsonStore');
const { createSeedData } = require('../src/store/seedData');

async function main() {
  const filePath = process.env.QHR_DATA_FILE
    ? path.resolve(process.env.QHR_DATA_FILE)
    : defaultDataFile();
  const store = new JsonStore(filePath);
  await store.reset(createSeedData());

  const data = await store.read();
  console.log(`Seeded QHR backend data at ${filePath}`);
  console.log(`Companies: ${data.companies.map((company) => company.code).join(', ')}`);
  console.log('Employee login: TESTCO / EMP001 / 1234');
  console.log('Admin login: company@example.com / password123');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
