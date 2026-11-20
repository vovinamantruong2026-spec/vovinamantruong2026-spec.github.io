import {useEffect, useMemo, useState} from 'react';
import {Printer} from 'lucide-react';
import {fetchStudentFile} from './student-files';
import {cardFields,cardKeys,drawRankCard,normalizeCard,prepareCardImage,printRankCards,studentCardValues,type CardField,type RankCardTemplate,type Slot} from './rank-card';

type Row={id:string;data:any};
type Props={
 students:Row[]; classes:Row[]; template?:RankCardTemplate; mayEdit:boolean;
 onSave:(template:RankCardTemplate,previous:string)=>Promise<void>;
 loadForPrint:(ids:string[])=>Promise<{students:Row[];classes:Row[];template:RankCardTemplate}>;
};

async function photoFor(student:Row,signal?:AbortSignal) {
 const id=student.data.avatarFile?.id;
 return typeof id==='string' && id ? fetchStudentFile(student.id,id,signal) : undefined;
}

export default function RankCards({students,classes,template,mayEdit,onSave,loadForPrint}:Props) {
 const saved=useMemo(()=>normalizeCard(template),[template]);
 const [draft,setDraft]=useState<RankCardTemplate|null>(null);
 const [original,setOriginal]=useState('');
 const [selection,setSelection]=useState<string[]>([]);
 const [classFilter,setClassFilter]=useState('');
 const [query,setQuery]=useState('');
 const [preview,setPreview]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [working,setWorking]=useState(false);
 const [field,setField]=useState<CardField>('name');
 const effective=mayEdit&&draft?draft:saved;
 const filtered=students.filter(s=>(!classFilter||s.data.classId===classFilter)&&
  (String(s.data.name)+' '+String(s.data.id)).toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
 const picked=students.filter(s=>selection.includes(s.id));
 const example=picked[0]??filtered[0];
 const className=classes.find(c=>c.id===example?.data.classId)?.data.name||'';
 const exampleId=example?.id??'';
 const avatarId=example?.data.avatarFile?.id??'';
 const [photo,setPhoto]=useState<{id:string;file:string;blob?:Blob;unavailable?:boolean}|null>(null);
 const photoEnabled=effective.slots.photo.enabled;

 useEffect(()=>{
  setPhoto(null);
  if(!photoEnabled||!exampleId||!avatarId)return;
  const controller=new AbortController();
  fetchStudentFile(exampleId,avatarId,controller.signal).then(blob=>{
   if(!controller.signal.aborted)setPhoto({id:exampleId,file:avatarId,blob});
  }).catch(()=>{
   if(!controller.signal.aborted)setPhoto({id:exampleId,file:avatarId,unavailable:true});
  });
  return ()=>controller.abort();
 },[exampleId,avatarId,photoEnabled]);

 const exampleValues=JSON.stringify(studentCardValues(example?.data??{
  name:'Nguyễn Văn Mẫu',id:'VVN.0001',dob:'2014-05-12',belt:'Tự vệ nhập môn',
 },className||(!example?'Lớp mẫu':'')));
 useEffect(()=>{
  let active=true;
  if(!effective.image){setPreview('');return}
  const image=photo?.id===exampleId&&photo.file===avatarId?photo?.blob:undefined;
  drawRankCard(effective,JSON.parse(exampleValues),image).then(output=>{
   if(active)setPreview(output);
  }).catch(()=>{
   if(active){setPreview('');setError('Không dựng được bản xem trước. Kiểm tra lại ảnh phôi.')}
  });
  return ()=>{active=false};
 },[effective,exampleValues,photo,exampleId,avatarId]);

 async function run(action:()=>Promise<void>) {
  setWorking(true);setError('');setMessage('');
  try {await action()}
  catch(e){setError(e instanceof Error?e.message:'Thao tác chưa hoàn tất.')}
  finally{setWorking(false)}
 }
 function edit() {
  setOriginal(JSON.stringify(saved));
  setDraft(saved);
 }
 function updateSlot(values:Partial<Slot>) {
  setDraft(current=>current&&({...current,slots:{...current.slots,[field]:{...current.slots[field],...values}}}));
 }
 async function upload(file:File) {
  const prepared=await prepareCardImage(file);
  setDraft(current=>current&&({...current,image:prepared.image,
   heightMm:current.image?current.heightMm:Math.min(270,Math.max(20,Math.round(current.widthMm*prepared.ratio*10)/10))}));
 }
 function toggle(id:string) {
  setSelection(previous=>previous.includes(id)?previous.filter(item=>item!==id):[...previous,id]);
 }
 function print() {
  if(!picked.length||picked.length>40||draft)return;
  void run(async()=>{
   const current=await loadForPrint(picked.map(s=>s.id));
   const printImages:string[]=[];
   let withoutPhoto=0;
   for(const student of current.students) {
    let avatar:Blob|undefined;
    if(current.template.slots.photo.enabled) {
     try { avatar=await photoFor(student,AbortSignal.timeout(8000)) } catch { /* print the other fields */ }
     if(!avatar)withoutPhoto++;
    }
    const values=studentCardValues(student.data,current.classes.find(c=>c.id===student.data.classId)?.data.name||'');
    try {printImages.push(await drawRankCard(current.template,values,avatar))}
    catch(error) {
     if(!avatar)throw error;
     withoutPhoto++;
     printImages.push(await drawRankCard(current.template,values));
    }
   }
   await printRankCards(printImages,current.template);
   setMessage('Đã mở hộp thoại in '+printImages.length+' thẻ.'+(withoutPhoto?' '+withoutPhoto+' thẻ để trống ảnh đại diện.':''));
  });
 }

 return <section className="rank-cards">
  {error&&<p className="alert error" role="alert">{error}</p>}
  {message&&<p className="alert info" role="status">{message}</p>}
  <div className="rank-card-grid">
   <section className="panel">
    <div className="panel-heading"><div><h2>Chọn võ sinh</h2><p>Đã chọn {picked.length} · Tối đa 40 thẻ mỗi lần in</p></div></div>
    <div className="rank-card-body">
     <div className="rank-card-filters">
      <label>Tìm theo tên hoặc mã<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Lọc lớp<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="">Tất cả lớp được cấp</option>
       {classes.map(c=><option value={c.id} key={c.id}>{c.data.name}</option>)}</select></label>
     </div>
     <fieldset className="rank-card-roster" disabled={working}>
      <legend>Danh sách võ sinh</legend>
      {filtered.map(s=><label key={s.id}><input type="checkbox" checked={selection.includes(s.id)}
       disabled={!selection.includes(s.id)&&picked.length>=40} onChange={()=>toggle(s.id)}/>
       <span>{s.data.name} <small>{s.data.id}</small></span></label>)}
      {!filtered.length&&<p>Không tìm thấy võ sinh trong lớp đã chọn.</p>}
     </fieldset>
     <div className="rank-card-actions">
      <button className="primary" disabled={working||!!draft||!saved.image||!picked.length} onClick={print}><Printer size={16}/> In thẻ đã chọn</button>
      <button className="secondary" disabled={working||!picked.length} onClick={()=>setSelection([])}>Bỏ chọn</button>
     </div>
    </div>
   </section>
   <section className="panel">
    <div className="panel-heading"><div><h2>Xem trước thẻ</h2><p>{effective.widthMm} × {effective.heightMm} mm</p></div>
     {mayEdit&&!draft&&<button className="secondary" disabled={working} onClick={edit}>{saved.image?'Thay đổi phôi thẻ':'Tải phôi thẻ'}</button>}
    </div>
    <div className="rank-card-body">
     {effective.image&&preview?<img className="rank-card-preview" src={preview} alt="Bản xem trước thẻ với thông tin võ sinh"/>:
      <p>{effective.image?'Đang dựng bản xem trước…':'Chưa có phôi thẻ. Tài khoản có quyền Cài đặt có thể tải phôi lên.'}</p>}
     {photo?.unavailable&&<p>Ảnh đại diện của hồ sơ xem trước chưa tải được.</p>}
     {draft&&mayEdit&&<div className="rank-card-editor">
      <label>Ảnh phôi JPG, PNG hoặc WebP<input type="file" accept="image/jpeg,image/png,image/webp" disabled={working} onChange={e=>{
       const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void run(()=>upload(file));
      }}/></label>
      <div className="rank-card-filters">
       <label>Rộng (mm)<input type="number" min={30} max={190} step={0.1} value={draft.widthMm}
        onChange={e=>setDraft({...draft,widthMm:Number(e.target.value)})}/></label>
       <label>Cao (mm)<input type="number" min={20} max={270} step={0.1} value={draft.heightMm}
        onChange={e=>setDraft({...draft,heightMm:Number(e.target.value)})}/></label>
       <label>Màu chữ<input type="color" value={draft.color} onChange={e=>setDraft({...draft,color:e.target.value})}/></label>
      </div>
      <label>Trường cần căn chỉnh<select value={field} onChange={e=>setField(e.target.value as CardField)}>
       {cardKeys.map(key=><option key={key} value={key}>{cardFields[key]}</option>)}</select></label>
      <label className="rank-card-toggle"><input type="checkbox" checked={draft.slots[field].enabled} onChange={e=>updateSlot({enabled:e.target.checked})}/> Hiển thị trên thẻ</label>
      <div className="rank-card-filters">
       <label>Từ trái (%)<input type="range" min={0} max={95} value={draft.slots[field].x} onChange={e=>updateSlot({x:Number(e.target.value)})}/><output>{draft.slots[field].x}%</output></label>
       <label>Từ trên (%)<input type="range" min={0} max={95} value={draft.slots[field].y} onChange={e=>updateSlot({y:Number(e.target.value)})}/><output>{draft.slots[field].y}%</output></label>
       <label>Kích thước<input type="range" min={2} max={field==='photo'?85:20} value={draft.slots[field].size} onChange={e=>updateSlot({size:Number(e.target.value)})}/><output>{draft.slots[field].size}%</output></label>
      </div>
      <div className="rank-card-actions">
       <button className="primary" disabled={working||!draft.image} onClick={()=>run(async()=>{
        const next=normalizeCard(draft);
        if(next.widthMm!==draft.widthMm||next.heightMm!==draft.heightMm)throw new Error('Chiều rộng 30–190 mm và chiều cao 20–270 mm.');
        await onSave(next,original);setDraft(null);setMessage('Đã lưu phôi thẻ dùng chung.');
       })}>Lưu phôi và vị trí</button>
       <button className="secondary" disabled={working} onClick={()=>setDraft(null)}>Hủy chỉnh sửa</button>
      </div>
     </div>}
    </div>
   </section>
  </div>
 </section>;
}
