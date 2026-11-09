// Comptes et sauvegarde persistante (fichier JSON).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');
const Items = require('./items');

const FILE = path.join(__dirname, '..', 'data', 'saves.json');
let accounts = {};
let dirty = false;

function load() {
  try { accounts = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { accounts = {}; }
}
function save() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(accounts));
    fs.renameSync(FILE + '.tmp', FILE);
  } catch (e) { console.error('Sauvegarde impossible', e.message); }
}
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const key = n => n.trim().toLowerCase();

function validName(n) { return typeof n === 'string' && /^[A-Za-z0-9À-ÿ _\-]{3,14}$/.test(n.trim()); }

function login(name, pw, cls, hue) {
  if (!validName(name)) return { err: 'Nom invalide (3 à 14 caractères : lettres, chiffres, espace, _ ou -).' };
  if (typeof pw !== 'string' || pw.length < 3 || pw.length > 64) return { err: 'Mot de passe : 3 caractères minimum.' };
  const k = key(name);
  let acc = accounts[k];
  if (acc) {
    if (hash(pw, acc.salt) !== acc.hash) return { err: 'Mot de passe incorrect pour ce héros.' };
    return { acc, created: false };
  }
  if (!C.CLASSES[cls]) cls = 'warrior';
  hue = Math.max(0, Math.min(360, Math.round(Number(hue) || 0)));
  const salt = crypto.randomBytes(8).toString('hex');
  const cl = C.CLASSES[cls];
  acc = {
    name: name.trim(), salt, hash: hash(pw, salt), cls, hue,
    level: 1, xp: 0, gold: 120, ess: 6,
    stats: { hp: 0, dmg: 0, def: 0, spd: 0, as: 0, regen: 0, crit: 0 },
    equip: { weapon: Items.genItem('weapon', 0, 1, cl.weapon), helmet: null, armor: null, boots: null, accessory: null },
    inv: [], skills: { [cl.skill]: 1 }, bar: [cl.skill, null, null, null],
    shop: null, rerolls: 0, pk: 0, mk: 0, deaths: 0, best: 0, created: Date.now(), last: Date.now()
  };
  accounts[k] = acc; dirty = true;
  return { acc, created: true };
}

const score = a => a.pk * 50 + a.mk * 2 + a.level * 20 + a.best * 5;
function top(n = 20) {
  return Object.values(accounts).sort((a, b) => score(b) - score(a)).slice(0, n).map(a => ({
    name: a.name, cls: a.cls, hue: a.hue, level: a.level, pk: a.pk, mk: a.mk, deaths: a.deaths, best: a.best, power: Items.derive(a).power, score: score(a)
  }));
}
const touch = () => { dirty = true; };

load();
setInterval(save, 15000).unref();
process.on('exit', save);
module.exports = { login, top, save, touch, score };
