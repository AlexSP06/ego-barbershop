require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Baza de date
const db = new Database('rezervari.db');

// Creare tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS rezervari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nume TEXT NOT NULL,
    telefon TEXT NOT NULL,
    email TEXT,
    barber TEXT NOT NULL,
    serviciu TEXT NOT NULL,
    data TEXT NOT NULL,
    ora TEXT NOT NULL,
    mesaj TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Configurare email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Sloturi orare disponibile
const SLOTURI = [
  '09:00', '09:40', '10:20', '11:00', '11:40',
  '12:20', '13:00', '13:40', '14:20', '15:00',
  '15:40', '16:20', '17:00', '17:40', '18:20',
  '19:00', '19:40'
];

// Barberi disponibili
const BARBERI = ['Andrei', 'Mihai', 'Vlad'];

// GET sloturi disponibile
app.get('/sloturi', (req, res) => {
  const { data, barber } = req.query;

  if (!data || !barber) {
    return res.status(400).json({ error: 'Data și barberul sunt obligatorii!' });
  }

  const azi = new Date().toISOString().split('T')[0];
  const acum = new Date();
  const oraAcum = `${String(acum.getHours()).padStart(2,'0')}:${String(acum.getMinutes()).padStart(2,'0')}`;

  const rezervateRows = db.prepare(
    'SELECT ora FROM rezervari WHERE data = ? AND barber = ?'
  ).all(data, barber);

  const rezervate = rezervateRows.map(r => r.ora);

  let disponibile = SLOTURI.filter(slot => {
    if (rezervate.includes(slot)) return false;
    if (data === azi && slot <= oraAcum) return false;
    return true;
  });

  res.json({ disponibile, rezervate });
});

// POST rezervare
app.post('/rezervare', async (req, res) => {
  const { nume, telefon, email, barber, serviciu, data, ora, mesaj } = req.body;

  if (!nume || !telefon || !barber || !serviciu || !data || !ora) {
    return res.status(400).json({ error: 'Completează toate câmpurile obligatorii!' });
  }

  // Verifică dacă slotul e disponibil
  const existent = db.prepare(
    'SELECT id FROM rezervari WHERE data = ? AND ora = ? AND barber = ?'
  ).get(data, ora, barber);

  if (existent) {
    return res.status(400).json({ error: 'Acest slot e deja rezervat!' });
  }

  // Salvează în baza de date
  db.prepare(`
    INSERT INTO rezervari (nume, telefon, email, barber, serviciu, data, ora, mesaj)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nume, telefon, email || null, barber, serviciu, data, ora, mesaj || null);

  try {
    // Email către barbershop
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `Rezervare nouă — ${nume}`,
      html: `
        <h2>Rezervare nouă la EGO Barbershop</h2>
        <p><strong>Nume:</strong> ${nume}</p>
        <p><strong>Telefon:</strong> ${telefon}</p>
        <p><strong>Email:</strong> ${email || 'Necompletat'}</p>
        <p><strong>Barber:</strong> ${barber}</p>
        <p><strong>Serviciu:</strong> ${serviciu}</p>
        <p><strong>Data:</strong> ${data}</p>
        <p><strong>Ora:</strong> ${ora}</p>
        <p><strong>Mesaj:</strong> ${mesaj || 'Niciun mesaj'}</p>
      `
    });

    // Email confirmare către client
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Confirmare rezervare — EGO Barbershop`,
        html: `
          <h2>Rezervarea ta a fost confirmată! ✂️</h2>
          <p>Salut <strong>${nume}</strong>,</p>
          <p>Rezervarea ta la <strong>EGO Barbershop</strong> a fost înregistrată cu succes.</p>
          <hr>
          <p><strong>Barber:</strong> ${barber}</p>
          <p><strong>Serviciu:</strong> ${serviciu}</p>
          <p><strong>Data:</strong> ${data}</p>
          <p><strong>Ora:</strong> ${ora}</p>
          <hr>
          <p>Te așteptăm! 💈</p>
          <p><em>EGO Barbershop, Zalău</em></p>
        `
      });
    }

    res.json({ success: true, message: 'Rezervare înregistrată cu succes!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eroare la trimiterea emailului.' });
  }
});

// Reminder automat în fiecare zi la 09:00
cron.schedule('0 9 * * *', async () => {
  const maine = new Date();
  maine.setDate(maine.getDate() + 1);
  const mainerStr = maine.toISOString().split('T')[0];

  const rezervariMaine = db.prepare(
    'SELECT * FROM rezervari WHERE data = ?'
  ).all(mainerStr);

  for (const r of rezervariMaine) {
    if (r.email) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: r.email,
          subject: `Reminder rezervare — EGO Barbershop`,
          html: `
            <h2>Reminder — Mâine ai programare! ✂️</h2>
            <p>Salut <strong>${r.nume}</strong>,</p>
            <p>Îți reamintim că mâine ai programare la <strong>EGO Barbershop</strong>.</p>
            <hr>
            <p><strong>Barber:</strong> ${r.barber}</p>
            <p><strong>Serviciu:</strong> ${r.serviciu}</p>
            <p><strong>Data:</strong> ${r.data}</p>
            <p><strong>Ora:</strong> ${r.ora}</p>
            <hr>
            <p>Te așteptăm! 💈</p>
            <p><em>EGO Barbershop, Zalău</em></p>
          `
        });
        console.log(`Reminder trimis către ${r.email}`);
      } catch (err) {
        console.error(`Eroare reminder pentru ${r.email}:`, err);
      }
    }
  }
});

// Admin — vezi toate rezervările
// Admin — șterge rezervare
app.delete('/admin/rezervari/:id', (req, res) => {
  const pass = req.headers['x-admin-pass'];
  if (pass !== 'ego2024') {
    return res.status(401).json({ error: 'Acces interzis!' });
  }
  const { id } = req.params;
  db.prepare('DELETE FROM rezervari WHERE id = ?').run(id);
  res.json({ success: true });
});

app.get('/admin/rezervari', (req, res) => {
  const pass = req.headers['x-admin-pass'];
  if (pass !== 'ego2024') {
    return res.status(401).json({ error: 'Acces interzis!' });
  }
  const toate = db.prepare('SELECT * FROM rezervari ORDER BY data ASC, ora ASC').all();
  res.json(toate);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server pornit pe http://localhost:${PORT}`);

  // Test conexiune email
  transporter.verify((error, success) => {
    if (error) {
      console.log('Eroare email:', error);
    } else {
      console.log('Email configurat corect!');
    }
  });
});

const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const html = `
    <html>
    <head><title>Test Page</title></head>
    <body><h1>Hello from Node.js HTTP Server!</h1></body>
    </html>
    `;
    res.end(html);
});

const port = 8080;
server.listen(port, () => {
    console.log(`Serving custom HTML at http://localhost:${port}`);
});