// Packt die CC0-Basisfiguren (Quaternius Universal Base Characters) in eine kompakte GLB:
// nur Geometrie + Skelett, keine Texturen (die kommen verkleinert als JPEG dazu).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, quantize, weld } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';
// Texturen vorab entfernen (fehlende Bilddateien im Paket)
async function readNoTex(f) {
  const json = JSON.parse(fs.readFileSync(f, 'utf8'));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness || {};
    delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture;
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    for (const k in (m.extensions || {})) delete m.extensions[k];
  }
  json.extensionsUsed = (json.extensionsUsed || []).filter((e) => e !== 'KHR_texture_transform' && e !== 'KHR_materials_specular' && e !== 'KHR_materials_ior');
  const resources = {};
  for (const b of json.buffers) resources[b.uri] = new Uint8Array(fs.readFileSync(path.join(path.dirname(f), b.uri)));
  return io.readJSON({ json, resources });
}

const [, , baseDir, hairDir, out] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = [
  [baseDir + '/Superhero_Male_FullBody.gltf', 'M'],
  [baseDir + '/Superhero_Female_FullBody.gltf', 'F'],
  ...['Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Buzzed', 'Hair_Beard', 'Eyebrows_Regular', 'Eyebrows_Female'].map((n) => [hairDir + '/' + n + '.gltf', n]),
];
const doc = await readNoTex(files[0][0]);
doc.getRoot().listScenes()[0].setName('M');
for (const [f, name] of files.slice(1)) {
  const d = await readNoTex(f);
  d.getRoot().listScenes()[0].setName(name);
  mergeDocuments(doc, d);
}
const root = doc.getRoot();
const buf0 = root.listBuffers()[0];
for (const a of root.listAccessors()) a.setBuffer(buf0);
for (const b of root.listBuffers().slice(1)) b.dispose();
for (const t of root.listTextures()) t.dispose();
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(sem)) p.setAttribute(sem, null);
}
for (const a of root.listAnimations()) a.dispose();
await doc.transform(prune(), dedup(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }));
for (const s of root.listScenes()) console.log('scene', s.getName(), s.listChildren().map((n) => n.getName()).join(','));
for (const m of root.listMeshes()) console.log('mesh', m.getName(), m.listPrimitives().map((p) => (p.getMaterial() && p.getMaterial().getName()) + ':' + p.getIndices().getCount() / 3).join(' '));
await io.write(out, doc);
console.log('bytes', fs.statSync(out).size);
