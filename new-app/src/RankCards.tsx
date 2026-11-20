import {useEffect, useMemo, useState} from 'react';
import {Printer} from 'lucide-react';
import RankCardFields from './RankCardFields';
import {fetchStudentFile} from './student-files';
import {drawRankCard,emptyBack,extraCardValues,normalizeCard,prepareCardImage,printRankCards,rankCardPhotoFits,sideTemplate,studentCardValues,type CardSide,type RankCardTemplate} from './rank-card';

type Row={id:string;data:any};
type Props={
 students:Row[]; classes:Row[]; template?:RankCardTemplate; mayEdit:boolean; initialStudentId?:string;
 onLinkProfiles?:(ids:string[])=>Promise<{saved:number; failures:string[]}>;
 onSave:(template:RankCardTemplate,previous:string)=>Promise<void>;
 loadForPrint:(ids:string[])=>Promise<{students:Row[];classes:Row[];template:RankCardTemplate}>;
};

async function photoFor(student:Row,signal?:AbortSignal) {
 const id=student.data.avatarFile?.id;
 return typeof id==='string' && id ? fetchStudentFile(student.id,id,signal) : undefined;
}

export default function RankCards({students,classes,template,mayEdit,onSave,loadForPrint,initialStudentId,onLinkProfiles}:Props) {
 const saved=useMemo(()=>normalizeCard(template),[template]);
 const [draft,setDraft]=useState<RankCardTemplate|null>(null);
 const [original,setOriginal]=useState('');
 const [selection,setSelection]=useState<string[]>(initialStudentId?[initialStudentId]:[]);
 const [classFilter,setClassFilter]=useState('');
 const [query,setQuery]=useState('');
 const [preview,setPreview]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [working,setWorking]=useState(false);
 const [side,setSide]=useState<'front'|'back'>('front');
 const [printMode,setPrintMode]=useState<'front'|'back'|'both'>('front');
 const currentTemplate=mayEdit&&draft?draft:saved;
 const effective=useMemo(()=>sideTemplate(currentTemplate,side),[currentTemplate,side]);
 const filtered=students.filter(s=>(!classFilter||s.data.classId===classFilter)&&
  (String(s.data.name)+' '+String(s.data.id)).toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
 const picked=students.filter(s=>selection.includes(s.id));
 const example=picked[0]??filtered[0];
 const unlinked=picked.filter(s=>s.data.rankCard?.linked!==true);
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

 const extraValues=JSON.stringify(extraCardValues(example?.data??{}));
 const exampleValues=JSON.stringify(studentCardValues(example?.data??{
  name:'Nguyễn Văn Mẫu',id:'VVN.0001',dob:'2014-05-12',belt:'Tự vệ nhập môn',
 },className||(!example?'Lớp mẫu':'')));
 useEffect(()=>{
  let active=true;
  if(!effective.image){setPreview('');return}
  const image=photo?.id===exampleId&&photo.file===avatarId?photo?.blob:undefined;
  drawRankCard(effective,JSON.parse(exampleValues),image,JSON.parse(extraValues)).then(output=>{
   if(active)setPreview(output);
  }).catch(()=>{
   if(active){setPreview('');setError('Không dựng được bản xem trước. Kiểm tra lại ảnh phôi.')}
  });
  return ()=>{active=false};
 },[effective,exampleValues,extraValues,photo,exampleId,avatarId]);

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
 function changeSide(value:CardSide) {
  setDraft(current=>current&&(side==='front'?{...current,image:value.image,slots:value.slots,extras:value.extras}:{...current,back:value}));
 }
 async function upload(file:File) {
  const prepared=await prepareCardImage(file);
  const target=side;
  setDraft(current=>current&&(target==='front'?{...current,image:prepared.image,
   heightMm:current.image||current.back?.image?current.heightMm:Math.min(270,Math.max(20,Math.round(current.widthMm*prepared.ratio*10)/10))}:
   {...current,back:{...(current.back??emptyBack()),image:prepared.image}}));
 }
 function toggle(id:string) {
  setSelection(previous=>previous.includes(id)?previous.filter(item=>item!==id):[...previous,id]);
 }
 function print() {
  if(!picked.length||picked.length>40||draft)return;
  void run(async()=>{
   const current=await loadForPrint(picked.map(s=>s.id));
   const sides=printMode==='both'?(['front','back'] as const):[printMode];
   const templates=sides.map(face=>sideTemplate(current.template,face));
   if(templates.some(face=>!rankCardPhotoFits({...face,back:undefined})))throw new Error('Khổ thẻ quá nhỏ để đặt ảnh 2 × 3 cm. Hãy tăng chiều cao thẻ hoặc ẩn ảnh.');
   if(templates.some(face=>!face.image))throw new Error('Hãy lưu phôi cho các mặt được chọn trước khi in.');
   const pages=templates.map(()=>[] as string[]);
   let withoutPhoto=0;
   for(const student of current.students) {
    let avatar:Blob|undefined;
    const needsPhoto=templates.some(face=>face.slots.photo.enabled);
    if(needsPhoto) {
     try { avatar=await photoFor(student,AbortSignal.timeout(8000)) } catch { /* print the other fields */ }
    }
    let missing=needsPhoto&&!avatar;
    const values=studentCardValues(student.data,current.classes.find(c=>c.id===student.data.classId)?.data.name||'');
    const extra=extraCardValues(student.data);
    for(const [index,face] of templates.entries()) {
     try {pages[index].push(await drawRankCard(face,values,avatar,extra))}
     catch(error) {
      if(!avatar||!face.slots.photo.enabled)throw error;
      missing=true;
      pages[index].push(await drawRankCard(face,values,undefined,extra));
     }
    }
    if(missing)withoutPhoto++;
   }
   await printRankCards(pages[0],current.template,pages[1]);
   setMessage('Đã mở hộp thoại in '+current.students.length+' thẻ.'+(withoutPhoto?' '+withoutPhoto+' thẻ để trống ảnh đại diện.':''));
  });
 }
 function linkProfiles() {
  if(!onLinkProfiles||!unlinked.length||draft)return;
  void run(async()=>{
   const {saved,failures}=await onLinkProfiles(unlinked.map(row=>row.id));
   setMessage('Đã lưu thẻ vào '+saved+' hồ sơ võ sinh.');
   if(failures.length)setError(failures.join(' · '));
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
       <span>{s.data.name} <small>{s.data.id}{s.data.rankCard?.linked===true?' · Có thẻ trong hồ sơ':''}</small></span></label>)}
      {!filtered.length&&<p>Không tìm thấy võ sinh trong lớp đã chọn.</p>}
     </fieldset>
     <div className="rank-card-filters rank-card-print-mode"><label>Mặt cần in
      <select value={printMode} disabled={working} onChange={e=>setPrintMode(e.target.value as typeof printMode)}>
       <option value="front">Mặt trước</option><option value="back" disabled={!saved.back?.image}>Mặt sau</option>
       <option value="both" disabled={!saved.back?.image}>Hai mặt</option>
      </select></label></div>
     {printMode==='both'&&<p>Chọn in hai mặt, lật cạnh dài và tỷ lệ 100% trong hộp thoại in.</p>}
     <div className="rank-card-actions">
      <button className="primary" disabled={working||!!draft||!saved.image||(printMode!=='front'&&!saved.back?.image)||!picked.length} onClick={print}><Printer size={16}/> In thẻ đã chọn</button>
      {onLinkProfiles&&<button className="secondary" disabled={working||!!draft||!saved.image||!unlinked.length} onClick={linkProfiles}>Lưu thẻ vào hồ sơ</button>}
      <button className="secondary" disabled={working||!picked.length} onClick={()=>setSelection([])}>Bỏ chọn</button>
     </div>
    </div>
   </section>
   <section className="panel">
    <div className="panel-heading"><div><h2>Xem trước thẻ</h2><p>{effective.widthMm} × {effective.heightMm} mm</p></div>
     {mayEdit&&!draft&&<button className="secondary" disabled={working} onClick={edit}>{saved.image?'Thay đổi phôi thẻ':'Tải phôi thẻ'}</button>}
    </div>
    <div className="rank-card-body">
     <div className="rank-card-actions rank-card-side-picker" aria-label="Chọn mặt thẻ">
      <button className={side==='front'?'primary':'secondary'} aria-pressed={side==='front'} disabled={working} onClick={()=>setSide('front')}>Mặt trước</button>
      <button className={side==='back'?'primary':'secondary'} aria-pressed={side==='back'} disabled={working} onClick={()=>setSide('back')}>Mặt sau</button>
     </div>
     {effective.image&&preview?<img className="rank-card-preview" src={preview} alt="Bản xem trước thẻ với thông tin võ sinh"/>:
      <p>{effective.image?'Đang dựng bản xem trước…':'Chưa có phôi cho mặt này.'}</p>}
     {effective.slots.photo.enabled&&effective.heightMm<30&&<p>Ảnh 2 × 3 cm cần chiều cao thẻ từ 30 mm. Tăng chiều cao hoặc ẩn ảnh trên mặt này.</p>}
     {photo?.unavailable&&<p>Ảnh đại diện của hồ sơ xem trước chưa tải được.</p>}
     {draft&&mayEdit&&<div className="rank-card-editor">
      <label>Ảnh phôi {side==='front'?'mặt trước':'mặt sau'} (JPG, PNG hoặc WebP)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={working} onChange={e=>{
       const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void run(()=>upload(file));
      }}/></label>
      <div className="rank-card-filters">
       <label>Rộng (mm)<input type="number" min={30} max={190} step={0.1} value={draft.widthMm}
        onChange={e=>setDraft({...draft,widthMm:Number(e.target.value)})}/></label>
       <label>Cao (mm)<input type="number" min={20} max={270} step={0.1} value={draft.heightMm}
        onChange={e=>setDraft({...draft,heightMm:Number(e.target.value)})}/></label>

      </div>
      <RankCardFields key={side} side={effective} heightMm={draft.heightMm} color={draft.color} onChange={changeSide}/>
      {side==='back'&&effective.image&&<button className="secondary" disabled={working} onClick={()=>changeSide({...effective,image:''})}>Bỏ ảnh phôi mặt sau</button>}
      <div className="rank-card-actions">
       <button className="primary" disabled={working||!draft.image} onClick={()=>run(async()=>{
        const next=normalizeCard(draft);
        if(next.widthMm!==draft.widthMm||next.heightMm!==draft.heightMm)throw new Error('Chiều rộng 30–190 mm và chiều cao 20–270 mm.');
        if(!rankCardPhotoFits(next))throw new Error('Khổ thẻ có ảnh 2 × 3 cm phải cao ít nhất 30 mm. Hãy tăng chiều cao hoặc ẩn ảnh.');
        await onSave(next,original);setDraft(null);if(!next.back?.image)setPrintMode('front');setMessage('Đã lưu phôi thẻ dùng chung.');
       })}>Lưu phôi và vị trí</button>
       <button className="secondary" disabled={working} onClick={()=>setDraft(null)}>Hủy chỉnh sửa</button>
      </div>
     </div>}
    </div>
   </section>
  </div>
 </section>;
}
