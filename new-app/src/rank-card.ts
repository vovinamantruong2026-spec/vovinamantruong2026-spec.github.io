export function rankCardAllowed(actor: {isSuperAdmin?:boolean; permissions?:Record<string,boolean>}|null|undefined, edit=false) {
 const grants=actor?.permissions;
 return actor?.isSuperAdmin===true || (grants?.rank_cards_manage===true && grants.reports_export===true &&
  (!edit || grants.settings_manage===true));
}
export const cardFields = {
 name:'Họ và tên', code:'Mã võ sinh', dob:'Ngày sinh', belt:'Cấp đai', className:'Lớp học', photo:'Ảnh đại diện',
} as const;
export type CardField = keyof typeof cardFields;
export type Slot = {enabled:boolean; x:number; y:number; size:number};
export type RankCardTemplate = {
 image:string; widthMm:number; heightMm:number; color:string; slots:Record<CardField,Slot>;
};
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

export function normalizeCard(value?: RankCardTemplate): RankCardTemplate {
 const image = value?.image;
 return {
  image: typeof image==='string' && image.length<=maxTemplateBytes && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) ? image : '',
  widthMm:numberIn(value?.widthMm,85.6,30,190),
  heightMm:numberIn(value?.heightMm,54,20,270),
  color:/^#[0-9a-f]{6}$/i.test(value?.color ?? '') ? value!.color : defaultCard.color,
  slots:Object.fromEntries(cardKeys.map(key=>{
   const slot=value?.slots?.[key], fallback=defaultCard.slots[key];
   return [key,{
    enabled:typeof slot?.enabled==='boolean'?slot.enabled:fallback.enabled,
    x:numberIn(slot?.x,fallback.x,0,95),
    y:numberIn(slot?.y,fallback.y,0,95),
    size:numberIn(slot?.size,fallback.size,2,key==='photo'?85:20),
   }];
  })) as RankCardTemplate['slots'],
 };
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

export async function drawRankCard(template:RankCardTemplate,values:ReturnType<typeof studentCardValues>,photo?:Blob) {
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
 ctx.fillStyle=template.color;
 ctx.textBaseline='top';
 for(const key of cardKeys) {
  if(key==='photo'||!template.slots[key].enabled)continue;
  const position=template.slots[key], value=values[key];
  const maxWidth=w*(98-position.x)/100;
  let px=Math.min(Math.round(position.size*h/100),(100-position.y)*h/100);
  const font=()=>{ctx.font=(key==='name'?'bold ':'')+px+'px Arial, sans-serif';};
  font();
  if(ctx.measureText(value).width>maxWidth) {
   px=Math.max(1,px*maxWidth/ctx.measureText(value).width);
   font();
  }
  ctx.fillText(value,position.x*w/100,position.y*h/100,maxWidth);
 }
 return canvas.toDataURL('image/png');
}

export async function printRankCards(images:string[],template:RankCardTemplate) {
 const frame=document.createElement('iframe');
 frame.title='In thẻ đẳng cấp';
 frame.className='rank-print-frame';
 document.body.append(frame);
 try {
  const doc=frame.contentDocument, view=frame.contentWindow;
  if(!doc||!view)throw new Error('Không mở được bản in.');
  doc.title='Thẻ đẳng cấp võ sinh';
  const style=doc.createElement('style');
  style.textContent='@page{size:A4;margin:8mm}body{margin:0;display:flex;align-content:flex-start;flex-wrap:wrap;gap:3mm}img{display:block;break-inside:avoid;page-break-inside:avoid}';
  doc.head.append(style);
  await Promise.all(images.map(async src=>{
   const image=doc.createElement('img');
   image.alt='Thẻ đẳng cấp';
   image.style.width=template.widthMm+'mm';
   image.style.height=template.heightMm+'mm';
   image.src=src;
   doc.body.append(image);
   await image.decode();
  }));
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
