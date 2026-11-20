import {useState} from 'react';
import {cardFields,cardKeys,extraLimit,extraSources,newExtraSlot,type CardField,type CardSide,type ExtraField,type ExtraSource,type Slot} from './rank-card';

type Props={side:CardSide;heightMm:number;color:string;onChange:(side:CardSide)=>void};
export default function RankCardFields({side,heightMm,color,onChange}:Props) {
 const [selected,setSelected]=useState('name');
 const extras=side.extras??[];
 const builtin=cardKeys.find(key=>key===selected);
 const field=extras.find(item=>item.id===selected);
 const key:CardField=builtin??'name';
 const slot=field?.slot??side.slots[key];
 const isPhoto=!field&&key==='photo';

 function changeExtra(values:Partial<ExtraField>) {
  if(field)onChange({...side,extras:extras.map(item=>item.id===field.id?{...item,...values}:item)});
 }
 function changeSlot(values:Partial<Slot>) {
  const next={...slot,...values};
  if(field)changeExtra({slot:next});
  else onChange({...side,slots:{...side.slots,[key]:next}});
 }
 function add() {
  const id=crypto.randomUUID();
  onChange({...side,extras:[...extras,{id,label:'Trường bổ sung',source:'text',text:'',slot:{...newExtraSlot}}]});
  setSelected(id);
 }
 function remove() {
  onChange({...side,extras:extras.filter(item=>item.id!==field?.id)});
  setSelected('name');
 }
 const title=field?'Trường bổ sung':'Trường thông tin';
 return <div className="rank-card-editor">
  <div className="rank-card-filters">
   <label>{title}<select value={field?.id??key} onChange={e=>setSelected(e.target.value)}>
    {cardKeys.map(item=><option key={item} value={item}>{cardFields[item]}{side.slots[item].enabled?'':' (đang ẩn)'}</option>)}
    {extras.map(item=><option key={item.id} value={item.id}>{item.label||'Trường bổ sung'}{item.slot.enabled?'':' (đang ẩn)'}</option>)}
   </select></label>
   <div className="rank-card-actions">
    <button className="secondary" disabled={extras.length>=extraLimit} onClick={add}>Thêm trường thông tin</button>
    {field&&<button className="secondary" onClick={remove}>Xóa trường bổ sung</button>}
   </div>
  </div>
  {field&&<div className="rank-card-filters">
   <label>Tên trường<input value={field.label} maxLength={60} onChange={e=>changeExtra({label:e.target.value})}/></label>
   <label>Nguồn dữ liệu<select value={field.source} onChange={e=>changeExtra({source:e.target.value as ExtraSource})}>
    {Object.entries(extraSources).map(([id,label])=><option key={id} value={id}>{label}</option>)}
   </select></label>
   {field.source==='text'&&<label>Nội dung in trên thẻ<input value={field.text} maxLength={240} placeholder="Ví dụ: Đơn vị cấp thẻ" onChange={e=>changeExtra({text:e.target.value})}/></label>}
  </div>}
  <label className="rank-card-toggle"><input type="checkbox" checked={slot.enabled} onChange={e=>changeSlot({enabled:e.target.checked})}/> Hiển thị trên mặt này</label>
  <div className="rank-card-filters">
   <label>Từ trái (%)<input type="range" min={0} max={95} step={0.5} value={slot.x} onChange={e=>changeSlot({x:Number(e.target.value)})}/><output>{slot.x}%</output></label>
   <label>Từ trên (%)<input type="range" min={0} max={95} step={0.5} value={slot.y} onChange={e=>changeSlot({y:Number(e.target.value)})}/><output>{slot.y}%</output></label>
   {isPhoto?<label>Cạnh ảnh (% chiều rộng thẻ)<input type="range" min={2} max={85} step={0.5} value={slot.size} onChange={e=>changeSlot({size:Number(e.target.value)})}/><output>{slot.size}%</output></label>:
   <>
    <label>Rộng tối đa (%)<input type="range" min={3} max={100} step={0.5} value={slot.width??Math.round(98-slot.x)} onChange={e=>changeSlot({width:Number(e.target.value)})}/><output>{slot.width??Math.round(98-slot.x)}%</output></label>
    <label>Cỡ chữ (mm)<input type="range" min={0.5} max={20} step={0.1} value={slot.fontMm??Math.max(0.5,Math.round(heightMm*slot.size/10)/10)} onChange={e=>changeSlot({fontMm:Number(e.target.value)})}/><output>{slot.fontMm??Math.max(0.5,Math.round(heightMm*slot.size/10)/10)} mm</output></label>
    <label>Màu chữ<input type="color" value={slot.color??color} onChange={e=>changeSlot({color:e.target.value})}/></label>
   </>}
  </div>
 </div>;
}
