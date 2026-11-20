export function rankCardAllowed(actor: {isSuperAdmin?:boolean; permissions?:Record<string,boolean>}|null|undefined, edit=false) {
 const grants=actor?.permissions;
 return actor?.isSuperAdmin===true || (grants?.rank_cards_manage===true && grants.reports_export===true &&
  (!edit || grants.settings_manage===true));
}
export const cardFields = {
 name:'Họ và tên', code:'Mã võ sinh', dob:'Ngày sinh', belt:'Cấp đai', className:'Lớp học', photo:'Ảnh đại diện',
} as const;
export type CardField = keyof typeof cardFields;
export type Slot = {enabled:boolean; x:number; y:number; size:number; width?:number; fontMm?:number; color?:string};
export const extraSources = {
 text:'Nội dung nhập tay', joinDate:'Ngày vào CLB', phone:'Điện thoại', parent:'Phụ huynh',
 address:'Địa chỉ', status:'Trạng thái học',
} as const;
export type ExtraSource=keyof typeof extraSources;
export type ExtraField={id:string; label:string; source:ExtraSource; text:string; slot:Slot};
export type CardSide={image:string; slots:Record<CardField,Slot>; extras?:ExtraField[]};
export type RankCardTemplate = CardSide & {
 widthMm:number; heightMm:number; color:string; back?:CardSide;
};
export const extraLimit=20;
export const newExtraSlot:Slot={enabled:true,x:15,y:22,size:5,width:75,fontMm:3};
export const cardKeys = Object.keys(cardFields) as CardField[];
export const maxTemplateBytes = 120_000;
export const defaultCard: RankCardTemplate = {
 image:'', widthMm:85.6, heightMm:54, color:'#172d48',
 slots:{
  name:{enabled:true,x:35,y:36,size:7},
  code:{enabled:true,x:35,y:48,size:5},
  dob:{enabled:true,x:35,y:60,size:5},
  belt:{enabled:true,x:35,y:72,size:5},
  className:{enabled:true,x:35,y:84,size:5},
  photo:{enabled:true,x:7,y:36,size:23},
 },
};

const numberIn = (value: unknown, fallback:number, min:number, max:number) =>
 typeof value==='number' && Number.isFinite(value) && value>=min && value<=max ? value : fallback;

const validColor=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const safeImage=(value:unknown)=>typeof value==='string' && value.length<=maxTemplateBytes &&
 /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';

function normalizeSlot(value:Slot|undefined,fallback:Slot,maxSize=20):Slot {
 return {
  enabled:typeof value?.enabled==='boolean'?value.enabled:fallback.enabled,
  x:numberIn(value?.x,fallback.x,0,95), y:numberIn(value?.y,fallback.y,0,95),
  size:numberIn(value?.size,fallback.size,2,maxSize),
  ...(value?.width!==undefined?{width:numberIn(value.width,60,3,100)}:{}),
  ...(value?.fontMm!==undefined?{fontMm:numberIn(value.fontMm,3,0.5,20)}:{}),
  ...(validColor(value?.color)?{color:value.color}:{}),
 };
}

export function emptyBack():CardSide {
 return {image:'',slots:Object.fromEntries(cardKeys.map(key=>[key,{...defaultCard.slots[key],enabled:false}])) as CardSide['slots'],extras:[]};
}

function normalizeSide(value:CardSide|undefined,base:CardSide):CardSide {
 const ids=new Set<string>();
 const extras:ExtraField[]=[];
 for(const item of (Array.isArray(value?.extras)?value.extras.slice(0,extraLimit):[])) {
  if(!item||typeof item.id!=='string'||!/^[a-z0-9-]{1,50}$/i.test(item.id)||ids.has(item.id)||!Object.prototype.hasOwnProperty.call(extraSources,item.source))continue;
  ids.add(item.id);
  extras.push({id:item.id,label:typeof item.label==='string'?item.label.slice(0,60):'Trường bổ sung',
   source:item.source,text:typeof item.text==='string'?item.text.slice(0,240):'',slot:normalizeSlot(item.slot,newExtraSlot)});
 }
 const slots=Object.fromEntries(cardKeys.map(key=>[key,normalizeSlot(value?.slots?.[key],base.slots[key],key==='photo'?85:20)])) as CardSide['slots'];
 return {image:safeImage(value?.image),slots,...(extras.length?{extras}:{})};
}

export function normalizeCard(value?: RankCardTemplate): RankCardTemplate {
 return {
  ...normalizeSide(value,defaultCard),
  widthMm:numberIn(value?.widthMm,85.6,30,190),
  heightMm:numberIn(value?.heightMm,54,20,270),
  color:validColor(value?.color)?value.color:defaultCard.color,
  ...(value?.back?{back:normalizeSide(value.back,emptyBack())}:{}),
 };
}
export function sideTemplate(template:RankCardTemplate,side:'front'|'back'):RankCardTemplate {
 return side==='front'?template:{widthMm:template.widthMm,heightMm:template.heightMm,color:template.color,...(template.back??emptyBack())};
}

async function loadImage(src:string) {
 const image = new Image();
 image.src=src;
 await image.decode();
 return image;
}

export async function prepareCardImage(file:File) {
 if (file.size>12*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
  throw new Error('Chọn phôi JPG, PNG hoặc WebP tối đa 12 MB.');
 }
 const url=URL.createObjectURL(file);
 try {
  const image=await loadImage(url);
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
  for(const size of [1500,1200,950,750,550]) {
   const ratio=Math.min(1,size/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
   ctx.fillStyle='#fff';
   ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.9,.78,.65]) {
    const encoded=canvas.toDataURL('image/jpeg',quality);
    if(encoded.length<=maxTemplateBytes)return {image:encoded,ratio:canvas.height/canvas.width};
   }
  }
  throw new Error('Phôi quá phức tạp. Hãy chọn ảnh có dung lượng thấp hơn.');
 } finally { URL.revokeObjectURL(url); }
}

export function studentCardValues(data:any,className:string): Record<Exclude<CardField,'photo'>,string> {
 const dob=String(data.dob || '');
 return {
  name:String(data.name || ''), code:String(data.id || ''),
  dob:/^\d{4}-\d{2}-\d{2}$/.test(dob)?dob.split('-').reverse().join('/'):dob,
  belt:String(data.belt || ''), className,
 };
}

export function extraCardValues(data:any): Record<Exclude<ExtraSource,'text'>,string> {
 const date=String(data.joinDate||'');
 return {joinDate:/^\d{4}-\d{2}-\d{2}$/.test(date)?date.split('-').reverse().join('/'):date,
  phone:String(data.phone||''),parent:String(data.parent||''),address:String(data.address||''),
  status:String(data.name?(data.enrollmentStatus==='withdrawn'?'Đã nghỉ':'Đang học'):'')};
}

export async function drawRankCard(template:RankCardTemplate,values:ReturnType<typeof studentCardValues>,photo?:Blob,
 extra?:ReturnType<typeof extraCardValues>) {
 const canvas=document.createElement('canvas');
 canvas.width=Math.ceil(template.widthMm*12);
 canvas.height=Math.ceil(template.heightMm*12);
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Trình duyệt không hỗ trợ tạo thẻ.');
 const w=canvas.width,h=canvas.height;
 ctx.fillStyle='#fff';
 ctx.fillRect(0,0,w,h);
 if(template.image)ctx.drawImage(await loadImage(template.image),0,0,w,h);
 const slot=template.slots.photo;
 if(photo&&slot.enabled) {
  const url=URL.createObjectURL(photo);
  try {
   const image=await loadImage(url), side=Math.min(image.naturalWidth,image.naturalHeight);
   const size=Math.min(slot.size*w/100,(100-slot.x)*w/100,(100-slot.y)*h/100);
   ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,slot.x*w/100,slot.y*h/100,size,size);
  } finally { URL.revokeObjectURL(url); }
 }
 ctx.textBaseline='top';
 function text(value:string,position:Slot,bold=false) {
  if(!position.enabled||!value)return;
  const maxWidth=w*Math.min(98-position.x,position.width??100)/100;
  ctx.fillStyle=position.color??template.color;
  const availableHeight=(100-position.y)*h/100;
  let px=Math.min(position.fontMm?position.fontMm*h/template.heightMm:position.size*h/100,availableHeight);
  const font=()=>{ctx.font=(bold?'bold ':'')+px+'px Arial, sans-serif';};
  font();
  if(ctx.measureText(value).width>maxWidth) {
   px=Math.max(1,px*maxWidth/ctx.measureText(value).width);
   font();
  }
  ctx.fillText(value,position.x*w/100,position.y*h/100,maxWidth);
 }
 for(const key of cardKeys)if(key!=='photo')text(values[key],template.slots[key],key==='name');
 for(const field of template.extras??[])text(field.source==='text'?field.text:extra?.[field.source]??'',field.slot);
 return canvas.toDataURL('image/png');
}

const pageWidth=194;
const pageHeight=281;
const gap=3;
export function cardPages(front:string[],template:RankCardTemplate,backs?:string[]) {
 if(backs&&backs.length!==front.length)throw new Error('Số thẻ mặt trước và mặt sau không khớp.');
 const columns=Math.max(1,Math.floor((pageWidth+gap)/(template.widthMm+gap)));
 const rows=Math.max(1,Math.floor((pageHeight+gap)/(template.heightMm+gap)));
 const perPage=columns*rows;
 const pages:{src:string;x:number;y:number}[][]=[];
 for(let start=0;start<front.length;start+=perPage) {
  const placements=(images:string[],mirror:boolean)=>images.slice(start,start+perPage).map((src,index)=>{
   const x=(index%columns)*(template.widthMm+gap),y=Math.floor(index/columns)*(template.heightMm+gap);
   return {src,x:mirror?pageWidth-template.widthMm-x:x,y};
  });
  pages.push(placements(front,false));
  if(backs)pages.push(placements(backs,true));
 }
 return pages;
}
export async function printRankCards(images:string[],template:RankCardTemplate,backs?:string[]) {
 const pages=cardPages(images,template,backs);
 const frame=document.createElement('iframe');
 frame.title='In thẻ đẳng cấp';
 frame.className='rank-print-frame';
 document.body.append(frame);
 try {
  const doc=frame.contentDocument, view=frame.contentWindow;
  if(!doc||!view)throw new Error('Không mở được bản in.');
  doc.title='Thẻ đẳng cấp võ sinh';
  const style=doc.createElement('style');
  style.textContent='@page{size:A4;margin:8mm}body{margin:0}.print-sheet{position:relative;width:194mm;height:280.5mm;break-after:page}.print-sheet:last-child{break-after:auto}.print-sheet img{position:absolute;display:block}';
  doc.head.append(style);
  const pending:Promise<void>[]=[];
  for(const placements of pages) {
   const sheet=doc.createElement('div');sheet.className='print-sheet';doc.body.append(sheet);
   for(const placement of placements) {
    const image=doc.createElement('img');
    image.alt='Thẻ đẳng cấp';
    image.style.cssText='width:'+template.widthMm+'mm;height:'+template.heightMm+'mm;left:'+placement.x+'mm;top:'+placement.y+'mm';
    image.src=placement.src;
    sheet.append(image);pending.push(image.decode());
   }
  }
  await Promise.all(pending);
  const cleanup=()=>frame.remove();
  view.addEventListener('afterprint',cleanup,{once:true});
  window.setTimeout(cleanup,120000);
  view.focus();
  view.print();
 } catch(error) {
  frame.remove();
  throw error;
 }
}
