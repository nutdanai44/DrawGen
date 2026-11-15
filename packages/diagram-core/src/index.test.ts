import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, updateDocument } from './index.ts';
const XML = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
test('createDocument initializes a revision', () => {
  const doc = createDocument(XML);
  assert.equal(doc.revision, 1);
});
test('updateDocument increments revision only for changes', () => {
  const doc = createDocument(XML);
  assert.equal(updateDocument(doc, XML), doc);
  assert.equal(updateDocument(doc, '<mxGraphModel><root/></mxGraphModel>').revision, 2);
});
