
const db = require("./database");

const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
  ORDER BY name
`).all();

console.log("Database initialized successfully.");
console.log("Tables created:");

for (const table of tables) {
  console.log("-", table.name);
}

db.close();
