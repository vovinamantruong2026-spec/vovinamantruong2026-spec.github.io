import assert from 'node:assert/strict';
import {cardPages, defaultCard, drawRankCard, emptyBack, examSessionOptions, extraCardValues, normalizeCard, rankCardAllowed, rankCardPhotoCrop, rankCardPhotoFits, rankCardPhotoLayout, sideTemplate, studentCardValues} from '../src/rank-card.ts';

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
const layout=normalizeCard({...defaultCard,image:background,back:{...emptyBack(),image:background,extras:[
 {id:'issuer',label:'Đơn vị cấp',source:'text',text:'CLB An Trường',slot:{enabled:true,x:12,y:20,size:5,fontMm:4,color:'#112233',width:50}},
 {id:'join',label:'Ngày vào CLB',source:'joinDate',text:'',slot:{enabled:true,x:12,y:32,size:5}},
]}});
assert.equal(layout.slots.name.enabled,true);
assert.equal(layout.back.slots.name.enabled,false);
assert.equal(layout.back.extras[0].slot.fontMm,4);
assert.equal(layout.back.extras[0].slot.color,'#112233');
commands.length=0;
await drawRankCard(sideTemplate(layout,'back'),values,undefined,extraCardValues({joinDate:'2024-08-17'}));
assert.deepEqual(commands.filter(r=>r[0]==='text').map(r=>r[1]),['CLB An Trường','17/08/2024']);
const pages=cardPages(['F1','F2','F3'],layout,['B1','B2','B3']);
assert.equal(pages.length,2);
for(let i=0;i<3;i++){
 assert.equal(pages[1][i].src,'B'+(i+1));
 assert.equal(pages[0][i].y,pages[1][i].y);
 assert.ok(Math.abs(pages[0][i].x+pages[1][i].x+layout.widthMm-194)<0.001);
}
const multi=cardPages(Array.from({length:11},(_,i)=>'F'+i),layout,Array.from({length:11},(_,i)=>'B'+i));
assert.deepEqual(multi.map(p=>p[0].src),['F0','B0','F8','B8']);
assert.throws(()=>cardPages(['F1'],layout,[]));
const photoGeometry=rankCardPhotoLayout(layout,856,540);
assert.equal(photoGeometry.width,200);
assert.equal(photoGeometry.height,300);
assert.deepEqual(rankCardPhotoCrop(400,300),{x:100,y:0,width:200,height:300});
const edge={...layout,slots:{...layout.slots,photo:{...layout.slots.photo,x:95,y:95}}};
assert.deepEqual(rankCardPhotoLayout(edge,856,540),{x:656,y:240,width:200,height:300});
assert.equal(rankCardPhotoFits({...layout,heightMm:25}),false);
assert.equal(rankCardPhotoFits({...layout,heightMm:25,slots:{...layout.slots,photo:{...layout.slots.photo,enabled:false}}}),true);
const profile={name:'Tên cũ',id:'VVN.0004',rankCard:{linked:true}};
const newProfile={...profile,name:'Tên mới',belt:'Lam đai'};
assert.equal(studentCardValues(newProfile,'Lớp mới').name,'Tên mới');
assert.equal(studentCardValues(newProfile,'Lớp mới').belt,'Lam đai');
assert.equal(newProfile.rankCard.linked,true);
const olderSlots={...defaultCard.slots};
delete olderSlots.examSession;
delete olderSlots.organization;
const migrated=normalizeCard({...defaultCard,image:background,slots:olderSlots,back:{image:background,slots:olderSlots}});
assert.equal(migrated.slots.examSession.enabled,false);
assert.equal(migrated.back.slots.organization.enabled,false);
const examProfile={...profile,examSession:'Khóa 05',organization:'CLB An Trường'};
const updatedExam=studentCardValues({...examProfile,examSession:'Khóa 06'},'Lớp A');
assert.equal(updatedExam.examSession,'Khóa 06');
assert.equal(updatedExam.organization,'CLB An Trường');
assert.equal(studentCardValues(profile,'').examSession,'');
commands.length=0;
await drawRankCard({...migrated,slots:{...migrated.slots,examSession:{...migrated.slots.examSession,enabled:true},
 organization:{...migrated.slots.organization,enabled:true}}},updatedExam);
assert.deepEqual(commands.filter(r=>r[0]==='text').slice(-2).map(r=>r[1]),['Khóa 06','CLB An Trường']);
const resized=normalizeCard({...defaultCard,image:background,slots:{
 ...defaultCard.slots,photo:{...defaultCard.slots.photo,photoWidthMm:24,photoHeightMm:28},
}});
const resizedPhoto=rankCardPhotoLayout(resized,856,540);
assert.ok(Math.abs(resizedPhoto.width-240)<1e-8);
assert.ok(Math.abs(resizedPhoto.height-280)<1e-8);
assert.deepEqual(rankCardPhotoCrop(400,200,{width:30,height:20}),{x:50,y:0,width:300,height:200});
assert.equal(rankCardPhotoFits({...resized,back:{image:background,slots:{
 ...emptyBack().slots,photo:{...emptyBack().slots.photo,enabled:true,photoWidthMm:90,photoHeightMm:25},
}}}),false);
assert.deepEqual(examSessionOptions([{data:{examSession:'Khóa 10'}},{data:{examSession:' Khóa 2 '}},
 {data:{examSession:'Khóa 2'}},{data:{examSession:''}},{data:{}}]),['Khóa 2','Khóa 10']);
console.log('PASS: card permissions, physical sizing, safe template, field mapping, photo and hidden fields');
