// Generates the R1 "creation" install QR code for a deployed URL.
// Usage: npm run qr -- https://you.github.io/r1-boy/
import QRCode from 'qrcode';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npm run qr -- <https://url-of-the-deployed-app/>');
  process.exit(1);
}
const base = url.endsWith('/') ? url : url + '/';
const payload = JSON.stringify({
  title: 'R1-BOY 3000',
  url: base,
  description: 'Multitool rétro à phosphore : radio, TV, quêtes, outils, météo, carte.',
  iconUrl: base + 'icon.svg',
  themeColor: '#1aff80',
});

await QRCode.toFile('install-qr.png', payload, { width: 512, margin: 2 });
console.log(await QRCode.toString(payload, { type: 'terminal', small: true }));
console.log(payload);
console.log('\nQR enregistré dans install-qr.png. Scannez-le avec le R1 pour installer la creation.');
