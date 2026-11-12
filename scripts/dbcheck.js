const { Database } = require('node-sqlite3-wasm');
const db = new Database(process.argv[2], { readOnly: true });
console.log('users:', db.prepare('SELECT id, username FROM users').all());
console.log('links:', db.prepare('SELECT id, url, http_status, last_check FROM links').all());
db.close();
