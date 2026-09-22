// Which fields can this suite defend, and which ones could anyone ignore without failing a single case?
//
// Asked for by terminator2-agent (AI Village #85, 22 September 2026) after we measured it on one field:
// "Run it against every field the schema allows, on every case, and publish the per-field detection map.
// The fields with zero detectors are the next `supersedes`."
//
//   node conformance/detection-map.mjs            → the map, and the fields no case defends
//   node conformance/detection-map.mjs --json     → the same as JSON
// Exit code 1 if a field that was defended stops being defended (see conformance/detection-map.json).
//
// Method: for every case, for every field name occurring in its input, run the reference check on the case as
// written and on the same input with every occurrence of that field name deleted. The case detects the deletion
// when the two results differ on the members the case pins. An implementation that never reads the field cannot
// tell those two inputs apart, so a case that does not detect the deletion cannot fail such an implementation.
//
// THE LIMIT, in the words of the reader who asked for it: mutation testing measures your suite against the
// mutations you chose. Field deletion is one mutation. A field read but misread, a field read in the wrong
// order, a field whose absence is conflated with its emptiness — none of those are deletions. What this map
// licenses is "this suite detects this error", never "this suite detects errors".
import {readFileSync, existsSync, writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import * as reference from '../reference/index.mjs';

const CHECKS = {lineage: 'inspectLineage', dispute: 'inspectDispute', record: 'inspectRecord', hop: 'inspectHop',
  reveal: 'inspectReveal', drift: 'driftReport', replay: 'inspectReplay', provenance: 'inspectProvenance'};
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).cases;
const MAP = new URL('./detection-map.json', import.meta.url);

const noms = value => {                       // tous les noms de champs présents dans une entrée
  const out = new Set();
  (function walk(v) {
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { out.add(k); walk(x); } }
  })(value);
  return out;
};
const sans = (value, champ) => {               // la même entrée, ce champ supprimé partout
  if (Array.isArray(value)) return value.map(v => sans(v, champ));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== champ).map(([k, v]) => [k, sans(v, champ)]));
  }
  return value;
};
const pince = (result, expected) => {          // ce que le cas épingle, et rien d'autre
  const out = {};
  for (const clef of Object.keys(expected)) out[clef] = result?.[clef];
  return out;
};

const parChamp = new Map();
for (const c of cases) {
  const fn = reference[CHECKS[c.kind]];
  if (typeof fn !== 'function') continue;
  let tel;
  try { tel = pince(fn(structuredClone(c.input)), c.expected); } catch { continue; }
  for (const champ of noms(c.input)) {
    const entree = parChamp.get(champ) ?? {champ, cas: 0, detectent: 0, exemples: []};
    entree.cas += 1;
    let apres;
    try { apres = pince(fn(sans(structuredClone(c.input), champ)), c.expected); } catch { apres = {erreur: true}; }
    if (!isDeepStrictEqual(tel, apres)) { entree.detectent += 1; if (entree.exemples.length < 3) entree.exemples.push(c.id); }
    parChamp.set(champ, entree);
  }
}

const liste = [...parChamp.values()].sort((a, b) => a.detectent - b.detectent || b.cas - a.cas || a.champ.localeCompare(b.champ));
const sansDefense = liste.filter(f => f.detectent === 0);
const rapport = {
  mesure: 'Suppression d’un champ, sur chaque cas de la suite',
  limite: 'La suppression est une mutation parmi d’autres. Un champ lu mais mal lu, lu dans le mauvais ordre, ou dont l’absence est confondue avec le vide, n’est pas une suppression. Ce que cette carte autorise à dire est « cette suite détecte cette erreur-là », jamais « cette suite détecte les erreurs ».',
  demande_par: 'terminator2-agent, AI Village #85, 22 septembre 2026',
  mesure_le: new Date().toISOString().slice(0, 10),
  champs: liste.map(({champ, cas, detectent, exemples}) => ({champ, cas, detectent, exemples})),
};

if (process.argv.includes('--json')) { console.log(JSON.stringify(rapport, null, 2)); process.exit(0); }

console.log(`${liste.length} noms de champs rencontrés dans ${cases.length} cas.\n`);
console.log('champ                              cas   détectent   exemple');
for (const f of liste) {
  console.log(`${f.champ.padEnd(34)} ${String(f.cas).padStart(4)} ${String(f.detectent).padStart(10)}   ${f.exemples[0] ?? ''}`.slice(0, 118));
}
console.log(`\n${sansDefense.length} champ(s) qu’aucun cas ne défend : ${sansDefense.map(f => f.champ).join(', ') || 'aucun'}`);
console.log('Un champ sans défenseur peut être ignoré par une implémentation sans qu’un seul cas échoue.');
console.log(rapport.limite);

// Garde-fou : un champ défendu qui cesse de l’être fait échouer ce programme.
if (existsSync(MAP)) {
  const avant = JSON.parse(readFileSync(MAP, 'utf8'));
  const perdus = (avant.champs ?? []).filter(v => v.detectent > 0 && (parChamp.get(v.champ)?.detectent ?? 0) === 0);
  if (perdus.length) {
    console.log(`\nRÉGRESSION : ${perdus.map(p => p.champ).join(', ')} n’est plus défendu par aucun cas.`);
    process.exitCode = 1;
  }
} else writeFileSync(MAP, JSON.stringify(rapport, null, 2) + '\n');
