import assert from 'node:assert/strict';
import { officeWordHost } from '../lib/wordHost.ts';

// Office.js fake: check the adapter's actual font/paragraph assignments and resets.
const paragraphs=[];
const fonts=[];
function paragraph(text='') {
  return {text, insertText(more) {this.text+=more;const font={};fonts.push(font);return {font};},search(){return {items:[],load(){}};}};
}
paragraphs.push(paragraph());
globalThis.window={
  Office:{context:{requirements:{isSetSupported:()=>true}}},
  Word:{run:async batch=>batch({document:{body:{paragraphs:{items:paragraphs,load(){}},insertParagraph(text){const p=paragraph(text);paragraphs.push(p);return p;}}},sync:async()=>{}})},
};
assert.deepEqual(await officeWordHost.appendIf(()=>true,['One','Two'],{
  paragraphs:[{start:0,end:4,kind:'numbered',alignment:'center'},{start:4,end:7,kind:'normal',alignment:'left'}],
  spans:[{start:0,end:3,underline:true,strikethrough:true}],
}),['One','Two']);
assert.equal(paragraphs[0].styleBuiltIn,'ListNumber');
assert.equal(paragraphs[0].alignment,'Centered');
assert.equal(paragraphs[1].styleBuiltIn,'Normal');
assert.equal(paragraphs[1].alignment,'Left');
assert.equal(fonts[0].underline,'Single');
assert.equal(fonts[0].strikeThrough,true);
assert.equal(fonts[1].underline,'None');
assert.equal(fonts[1].strikeThrough,false);
console.log('Word host formatting and style reset verified.');
