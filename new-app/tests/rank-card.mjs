import assert from 'node:assert/strict';
import {defaultCard, drawRankCard, normalizeCard, rankCardAllowed, studentCardValues} from '../src/rank-card.ts';

assert.equal(rankCardAllowed(null),false);
assert.equal(rankCardAllowed({permissions:{reports_export:true,settings_manage:true}}),false);
assert.equal(rankCardAllowed({permissions:{rank_cards_manage:true}}),false);
const printOnly={permissions:{rank_cards_manage:true,reports_export:true}};
assert.equal(rankCardAllowed(printOnly),true);
assert.equal(rankCardAllowed(printOnly,true),false);
assert.equal(rankCardAllowed({permissions:{...printOnly.permissions,settings_manage:true}},true),true);
assert.equal(rankCardAllowed({isSuperAdmin:true},true),true);
assert.deepEqual(normalizeCard(undefined),defaultCard);
assert.equal(normalizeCard({image:'javascript:alert(1)',widthMm:500}).image,'');
assert.equal(normalizeCard({widthMm:500}).widthMm,85.6);
const values=studentCardValues({name:'Nguyễn Văn Mẫu',id:'VVN.1234',dob:'2014-05-12',belt:'Tự vệ nhập môn'},'Lớp A');
assert.equal(values.dob,'12/05/2014');
const commands=[];
const context={fillRect(){}, measureText(value){return {width:value.length*5}},
 drawImage(...args){commands.push(['image',...args.slice(1)])},
 fillText(value){commands.push(['text',value])}};
const canvas={getContext:()=>context,toDataURL:()=> 'data:image/png;base64,AA=='};
globalThis.document={createElement:()=>canvas};
globalThis.Image=class {naturalWidth=400;naturalHeight=300;async decode(){}};
const background='data:image/png;base64,AA==';
await drawRankCard({...defaultCard,image:background},values,new Blob(['x']));
assert.equal(canvas.width,1028);
assert.deepEqual(commands.filter(r=>r[0]==='text').map(r=>r[1]),['Nguyễn Văn Mẫu','VVN.1234','12/05/2014','Tự vệ nhập môn','Lớp A']);
assert.equal(commands.filter(r=>r[0]==='image').length,2);
commands.length=0;
await drawRankCard({...defaultCard,image:background,slots:{...defaultCard.slots,code:{...defaultCard.slots.code,enabled:false}}},values);
assert.equal(commands.some(r=>r[1]==='VVN.1234'),false);
console.log('PASS: card permissions, physical sizing, safe template, field mapping, photo and hidden fields');
