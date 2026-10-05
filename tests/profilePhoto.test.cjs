const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {runInNewContext} = require('node:vm');
const ts = require('typescript');

function helpers({width = 1600, height = 900, decodeError = false} = {}) {
  const calls = [];
  const exports = {};
  const canvas = {getContext: () => ({fillRect: (...args) => calls.push(['fill', ...args]), drawImage: (...args) => calls.push(['crop', ...args.slice(1)])}), toBlob: (callback, type) => callback(new Blob(['image'], {type}))};
  runInNewContext(ts.transpileModule(readFileSync(resolve(__dirname, '../src/lib/profilePhoto.ts'), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}
  }).outputText, {exports, Blob, URL: {createObjectURL: () => 'blob:test', revokeObjectURL: url => calls.push(['revoke', url])},
    Image: class {naturalWidth = width; naturalHeight = height; async decode() {if (decodeError) throw new Error('invalid');}},
    document: {createElement: () => canvas}});
  return {...exports, calls, canvas};
}

test('foto rejeita arquivos vazios, SVG, tipos indevidos e mais de 5 MB', () => {
  const photo = helpers();
  for (const file of [{type: 'image/svg+xml', size: 100}, {type: 'image/jpeg', size: 0}, {type: 'image/png', size: 5242881}]) assert.ok(photo.profilePhotoError(file));
  assert.equal(photo.profilePhotoError({type: 'image/webp', size: 5242880}), '');
});
test('foto é recortada no centro, reduzida a 512 pixels e convertida em JPEG', async () => {
  const photo = helpers();
  const blob = await photo.prepareProfilePhoto({type: 'image/png', size: 1000});
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(photo.canvas.width, 512); assert.equal(photo.canvas.height, 512);
  assert.deepEqual(photo.calls.find(call => call[0] === 'crop'), ['crop', 350, 0, 900, 900, 0, 0, 512, 512]);
  assert.deepEqual(photo.calls.at(-1), ['revoke', 'blob:test']);
});
test('foto corrompida ou grande demais falha e libera a prévia temporária', async () => {
  for (const options of [{decodeError: true}, {width: 10000, height: 10000}]) {
    const photo = helpers(options);
    await assert.rejects(photo.prepareProfilePhoto({type: 'image/jpeg', size: 1000}));
    assert.deepEqual(photo.calls.at(-1), ['revoke', 'blob:test']);
  }
});
test('caminhos reconhecem somente fotos do bucket, preservando URLs antigas separadamente', () => {
  const photo = helpers();
  const path = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.jpg';
  assert.equal(photo.avatarStoragePath('avatars/' + path), path);
  for (const value of ['https://example.com/avatar.jpg', 'avatars/../foto.jpg', null, 'javascript:alert(1)']) assert.equal(photo.avatarStoragePath(value), null);
});
