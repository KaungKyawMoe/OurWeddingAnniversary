// Usage: npm run hash -- "your long password"
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Give a password of 10+ characters.'); process.exit(1); }
console.log(require('bcryptjs').hashSync(pw, 12));
