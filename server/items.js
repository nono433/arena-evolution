// Génération d'équipement et calcul des statistiques dérivées.
const C = require('./config');

let seq = Math.floor(Math.random() * 1e6);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);

const NAMES = {
  weapon: { sword: ['Épée', 'Lame', 'Glaive'], axe: ['Hache', 'Cognée', 'Doloire'], spear: ['Lance', 'Pique', 'Hast'], staff: ['Bâton', 'Sceptre', 'Baguette'], bow: ['Arc', 'Arc long', 'Arc court'] },
  helmet: ['Heaume', 'Casque', 'Capuche'], armor: ['Cuirasse', 'Armure', 'Plastron'], boots: ['Bottes', 'Jambières', 'Sandales'], accessory: ['Anneau', 'Amulette', 'Talisman', 'Pendentif']
};
const EPITHETS = [
  [''],
  ['du Chasseur', 'de la Meute', 'du Brave'],
  ['des Tempêtes', "de l'Ombre", 'du Crépuscule'],
  ['du Roi déchu', "de l'Aube", 'des Titans'],
  ["de l'Éternité", 'du Néant', "de l'Apocalypse"]
];
const BASE = {
  weapon: { dmg: 7 }, helmet: { hp: 22, def: 2 }, armor: { hp: 40, def: 4.5 }, boots: { spd: 3, def: 1.5, hp: 10 }
};
const ACC_POOL = { crit: 2.5, as: 4, regen: 0.8, dmg: 3, hp: 18, def: 2 };

function rollRarity(weights, min = 0) {
  const w = weights.map((x, i) => (i < min ? 0 : x));
  let t = w.reduce((a, b) => a + b, 0), r = Math.random() * t;
  for (let i = 0; i < w.length; i++) { if (r < w[i]) return i; r -= w[i]; }
  return w.length - 1;
}

function genItem(slot, rar, lvl, kind) {
  const R = C.RARITIES[rar];
  let base, name;
  if (slot === 'weapon') {
    kind = kind || pick(Object.keys(C.WEAPONS));
    base = { dmg: BASE.weapon.dmg };
    name = pick(NAMES.weapon[kind]);
  } else if (slot === 'accessory') {
    const ks = Object.keys(ACC_POOL).sort(() => Math.random() - 0.5).slice(0, 2);
    base = {}; for (const k of ks) base[k] = ACC_POOL[k] * rnd(0.85, 1.15);
    name = pick(NAMES.accessory);
  } else {
    base = {}; for (const [k, v] of Object.entries(BASE[slot])) base[k] = v * rnd(0.9, 1.1);
    name = pick(NAMES[slot]);
  }
  if (slot === 'weapon') base.dmg *= rnd(0.9, 1.1);
  const bonus = [];
  const bk = Object.keys(C.BONUSES).sort(() => Math.random() - 0.5);
  for (let i = 0; i < R.bonuses; i++) {
    const k = bk[i]; bonus.push({ k, v: Math.round(C.BONUSES[k].base * (0.7 + 0.25 * rar) * rnd(0.9, 1.1) * 10) / 10 });
  }
  const ep = pick(EPITHETS[rar]);
  return { id: 'i' + (seq++).toString(36), slot, kind: slot === 'weapon' ? kind : undefined, name: ep ? `${name} ${ep}` : name, rar, lvl: Math.max(1, lvl), base, bonus };
}

const MAX_ITEM_LVL = 15;
const itemMult = it => C.RARITIES[it.rar].mult * (1 + 0.14 * (it.lvl - 1));
function itemStats(it) {
  const m = itemMult(it), s = {};
  for (const k in it.base) s[k] = Math.round(it.base[k] * m * 10) / 10;
  return s;
}
const buyPrice = it => Math.round(60 * C.RARITIES[it.rar].price * (1 + 0.4 * (it.lvl - 1)));
const sellPrice = it => Math.round(buyPrice(it) * 0.4);
const upgradeCost = it => Math.round(25 * C.RARITIES[it.rar].price * Math.pow(1.4, it.lvl - 1));

const SHOP_WEIGHTS = [45, 32, 16, 6, 1];
function genShop(playerLevel) {
  const ilvl = Math.max(1, Math.min(12, Math.floor(playerLevel / 3) + 1));
  const offers = [];
  const slots = ['weapon', 'helmet', 'armor', 'boots', 'accessory'];
  for (let i = 0; i < 5; i++) {
    const rar = rollRarity(SHOP_WEIGHTS);
    const it = genItem(slots[i], rar, ilvl + (Math.random() < 0.3 ? 1 : 0));
    offers.push(it);
  }
  return offers;
}

// Statistiques finales d'un compte
function derive(acc) {
  const L = acc.level, S = acc.stats;
  const g = { dmg: 0, hp: 0, def: 0, spd: 0, as: 0, regen: 0, crit: 0 };
  const b = { lifesteal: 0, goldfind: 0, xpfind: 0, cdr: 0, critdmg: 0 };
  for (const slot of C.SLOTS) {
    const it = acc.equip[slot];
    if (!it) continue;
    const s = itemStats(it);
    for (const k in s) g[k] = (g[k] || 0) + s[k];
    for (const bo of it.bonus) b[bo.k] += bo.v;
  }
  const st = {
    maxHp: Math.round(100 + 10 * (L - 1) + 20 * S.hp + g.hp),
    dmg: 8 + 1.5 * (L - 1) + 3 * S.dmg + g.dmg,
    def: 1.5 * S.def + g.def,
    spd: 230 * Math.min(1.8, 1 + 0.03 * S.spd + g.spd / 100),
    as: Math.min(3, 1 + 0.05 * S.as + g.as / 100),
    regen: 0.5 * S.regen + g.regen,
    crit: Math.min(75, 5 + 1.5 * S.crit + g.crit),
    critDmg: 1.5 + b.critdmg / 100,
    lifesteal: b.lifesteal, goldfind: b.goldfind, xpfind: b.xpfind, cdr: Math.min(40, b.cdr),
    kind: acc.equip.weapon ? acc.equip.weapon.kind : 'sword'
  };
  st.power = Math.round(st.dmg * st.as * (1 + st.crit / 100 * (st.critDmg - 1)) * 3 + st.maxHp * 0.2 + st.def * 2 + (st.spd - 230) * 0.05);
  return st;
}

module.exports = { genItem, itemStats, buyPrice, sellPrice, upgradeCost, genShop, derive, rollRarity, MAX_ITEM_LVL };
