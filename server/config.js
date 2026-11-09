// Données de jeu : statistiques, raretés, compétences, armes, monstres.
const RARITIES = [
  { id: 'common', name: 'Commun', mult: 1, bonuses: 0, color: '#b8c0cc', price: 1 },
  { id: 'rare', name: 'Rare', mult: 1.45, bonuses: 0, color: '#4aa3ff', price: 3 },
  { id: 'epic', name: 'Épique', mult: 2.1, bonuses: 1, color: '#b86bff', price: 8 },
  { id: 'legendary', name: 'Légendaire', mult: 3.0, bonuses: 1, color: '#ffb02e', price: 22 },
  { id: 'mythic', name: 'Mythique', mult: 4.4, bonuses: 2, color: '#ff4d6d', price: 60 }
];

const SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'accessory'];
const SLOT_NAMES = { weapon: 'Arme', helmet: 'Casque', armor: 'Armure', boots: 'Bottes', accessory: 'Accessoire' };

// Statistiques améliorables avec l'or
const STATS = {
  hp: { name: 'Vie maximale', base: 30, g: 1.22, max: 60, txt: '+20 PV max' },
  dmg: { name: 'Dégâts', base: 40, g: 1.22, max: 60, txt: '+3 dégâts' },
  def: { name: 'Défense', base: 35, g: 1.22, max: 60, txt: '+1,5 défense' },
  spd: { name: 'Vitesse de déplacement', base: 45, g: 1.24, max: 20, txt: '+3 % vitesse' },
  as: { name: "Vitesse d'attaque", base: 50, g: 1.24, max: 20, txt: "+5 % vitesse d'attaque" },
  regen: { name: 'Régénération', base: 35, g: 1.22, max: 40, txt: '+0,5 PV/s' },
  crit: { name: 'Chance de critique', base: 60, g: 1.25, max: 25, txt: '+1,5 % critique' }
};
const statCost = (k, lv) => Math.round(STATS[k].base * Math.pow(STATS[k].g, lv));

const WEAPONS = {
  sword: { name: 'Épée', icon: '⚔️', range: 92, arc: 130, cd: 0.45, mult: 1.0 },
  axe: { name: 'Hache', icon: '🪓', range: 100, arc: 170, cd: 0.8, mult: 1.7 },
  spear: { name: 'Lance', icon: '🔱', range: 150, arc: 36, cd: 0.6, mult: 1.3 },
  staff: { name: 'Bâton', icon: '🪄', range: 560, cd: 0.5, mult: 0.95, proj: 'bolt', speed: 560, pr: 12 },
  bow: { name: 'Arc', icon: '🏹', range: 720, cd: 0.7, mult: 1.35, proj: 'arrow', speed: 800, pr: 8 }
};

const CLASSES = {
  warrior: { name: 'Guerrier', weapon: 'sword', skill: 'shockwave', desc: 'Résistant, au corps à corps. Commence avec Onde de choc.' },
  mage: { name: 'Mage', weapon: 'staff', skill: 'fireball', desc: 'Dégâts magiques à distance. Commence avec Boule de feu.' },
  ranger: { name: 'Rôdeur', weapon: 'bow', skill: 'dash', desc: 'Agile et précis. Commence avec la Ruée.' }
};

const BONUSES = {
  lifesteal: { name: 'Vol de vie', base: 3, unit: '%' },
  goldfind: { name: "Chasseur d'or", base: 12, unit: '%' },
  xpfind: { name: 'Savoir', base: 10, unit: '% XP' },
  cdr: { name: 'Maîtrise', base: 7, unit: '% recharge' },
  critdmg: { name: 'Coup fatal', base: 18, unit: '% dégâts crit.' }
};

const f1 = n => Math.round(n * 10) / 10;
// Compétences : lv(i) renvoie les paramètres au niveau i (1..5)
const SKILLS = {
  dash: {
    name: 'Ruée', icon: '💨', unlock: 5, maxLv: 5, desc: 'Fonce vers le curseur en étant invulnérable. Dès le niveau 3, blesse les ennemis traversés.',
    lv: i => ({ cd: f1(5.5 - 0.5 * i), dist: 190 + 25 * i, mult: i >= 3 ? f1(0.5 + 0.3 * i) : 0 }),
    txt: p => `Distance ${p.dist} · Recharge ${p.cd}s` + (p.mult ? ` · Dégâts ×${p.mult}` : '')
  },
  fireball: {
    name: 'Boule de feu', icon: '🔥', unlock: 7, maxLv: 5, desc: 'Lance une sphère de feu qui explose au contact. Brûle les ennemis dès le niveau 3.',
    lv: i => ({ cd: f1(3.6 - 0.3 * i), mult: f1(1.6 + 0.55 * i), rad: 60 + 9 * i, burn: i >= 3 }),
    txt: p => `Dégâts ×${p.mult} · Rayon ${p.rad} · Recharge ${p.cd}s` + (p.burn ? ' · Brûlure' : '')
  },
  shockwave: {
    name: 'Onde de choc', icon: '🌀', unlock: 7, maxLv: 5, desc: 'Libère une onde qui blesse et repousse tous les ennemis proches. Étourdit dès le niveau 4.',
    lv: i => ({ cd: f1(8 - 0.7 * i), mult: f1(1.4 + 0.5 * i), rad: 130 + 15 * i, stun: i >= 4 }),
    txt: p => `Dégâts ×${p.mult} · Rayon ${p.rad} · Recharge ${p.cd}s` + (p.stun ? ' · Étourdit' : '')
  },
  heal: {
    name: 'Régénération', icon: '💚', unlock: 9, maxLv: 5, desc: 'Récupère de la vie progressivement pendant 3 secondes.',
    lv: i => ({ cd: f1(16 - 1.2 * i), pct: f1(0.22 + 0.06 * i) }),
    txt: p => `Soigne ${Math.round(p.pct * 100)} % PV max · Recharge ${p.cd}s`
  },
  teleport: {
    name: 'Téléportation', icon: '🌌', unlock: 10, maxLv: 5, desc: "Se téléporte instantanément vers le curseur. Dès le niveau 3, l'arrivée repousse les ennemis.",
    lv: i => ({ cd: f1(9 - 0.8 * i), range: 300 + 60 * i, mult: i >= 3 ? f1(0.4 + 0.3 * i) : 0 }),
    txt: p => `Portée ${p.range} · Recharge ${p.cd}s` + (p.mult ? ` · Choc ×${p.mult}` : '')
  },
  shield: {
    name: 'Bouclier', icon: '🛡️', unlock: 10, maxLv: 5, desc: 'Une barrière absorbe les dégâts pendant quelques secondes.',
    lv: i => ({ cd: f1(18 - 1.5 * i), pct: f1(0.2 + 0.07 * i), dur: f1(4 + 0.5 * i) }),
    txt: p => `Absorbe ${Math.round(p.pct * 100)} % PV max · ${p.dur}s · Recharge ${p.cd}s`
  }
};
const skillUpgradeCost = lv => 4 + 4 * lv;

// Monstres. cat : weak | mid | elite | boss
const MONSTERS = {
  slime: { name: 'Gelée visqueuse', cat: 'weak', hp: 40, dmg: 8, spd: 80, r: 16, def: 0, xp: 10, gold: [4, 8], ess: 0.1, aggro: 380, ai: 'slime' },
  bat: { name: 'Chauve-souris', cat: 'weak', hp: 24, dmg: 7, spd: 140, r: 13, def: 0, xp: 9, gold: [3, 7], ess: 0.1, aggro: 480, ai: 'bat' },
  skeleton: { name: 'Archer squelette', cat: 'mid', hp: 75, dmg: 13, spd: 90, r: 16, def: 2, xp: 24, gold: [10, 18], ess: 0.22, aggro: 540, ai: 'archer' },
  brute: { name: 'Brute orque', cat: 'mid', hp: 170, dmg: 22, spd: 100, r: 22, def: 4, xp: 38, gold: [16, 28], ess: 0.28, aggro: 440, ai: 'brute' },
  wraith: { name: 'Spectre', cat: 'elite', hp: 440, dmg: 20, spd: 110, r: 20, def: 6, xp: 130, gold: [60, 100], ess: 1, essN: [2, 4], aggro: 700, ai: 'wraith' },
  ogre: { name: 'Ogre massacreur', cat: 'elite', hp: 700, dmg: 34, spd: 95, r: 30, def: 10, xp: 150, gold: [70, 120], ess: 1, essN: [2, 4], aggro: 560, ai: 'ogre' },
  golem: { name: 'Roi Golem', cat: 'boss', hp: 2600, dmg: 40, spd: 65, r: 48, def: 14, xp: 700, gold: [300, 450], ess: 1, essN: [12, 18], aggro: 1100, ai: 'golem' },
  dragon: { name: 'Dragon Cendrelame', cat: 'boss', hp: 3600, dmg: 45, spd: 110, r: 54, def: 16, xp: 1000, gold: [450, 650], ess: 1, essN: [18, 26], aggro: 1200, ai: 'dragon' }
};
const CAT_NAMES = { weak: 'Faible', mid: 'Intermédiaire', elite: 'Élite', boss: 'Boss' };

const xpNext = lv => Math.round(35 * Math.pow(lv, 1.4));

// Définitions envoyées aux clients
function clientDefs() {
  const skills = {};
  for (const [id, s] of Object.entries(SKILLS)) {
    const lvs = [];
    for (let i = 1; i <= s.maxLv; i++) { const p = s.lv(i); lvs.push({ cd: p.cd, txt: s.txt(p) }); }
    skills[id] = { name: s.name, icon: s.icon, desc: s.desc, unlock: s.unlock, maxLv: s.maxLv, lvs };
  }
  const monsters = {};
  for (const [k, m] of Object.entries(MONSTERS)) monsters[k] = { name: m.name, cat: m.cat, r: m.r };
  return { rarities: RARITIES, slots: SLOTS, slotNames: SLOT_NAMES, stats: STATS, weapons: WEAPONS, classes: CLASSES, bonuses: BONUSES, skills, monsters, catNames: CAT_NAMES };
}

module.exports = { RARITIES, SLOTS, SLOT_NAMES, STATS, statCost, WEAPONS, CLASSES, BONUSES, SKILLS, skillUpgradeCost, MONSTERS, CAT_NAMES, xpNext, clientDefs };
