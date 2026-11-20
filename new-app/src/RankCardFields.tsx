import {useId,useState} from 'react';
import {cardFields,cardKeys,extraLimit,extraSources,newExtraSlot,type CardField,type CardSide,type ExtraField,type ExtraSource,type Slot} from './rank-card';

type NumericControlProps={
 label:string; unit:'%'|'mm'; min:number; max:number; value:number; onChange:(value:number)=>void;
};
export function parseCardNumber(text:string) {
 const value=text.trim().replace(',','.');
 return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)&&Number.isFinite(Number(value))?Number(value):null;
}

function NumericControl({label,unit,min,max,value,onChange}:NumericControlProps) {
 const id=useId();
 const [draft,setDraft]=useState<string|null>(null);
 const parsed=draft===null?value:parseCardNumber(draft);
 const invalid=parsed===null||parsed<min||parsed>max;
 function commit() {
  if(draft!==null&&parsed!==null)onChange(Math.min(max,Math.max(min,parsed)));
  setDraft(null);
 }
 return <div className="rank-card-number">
  <label id={id}>{label} ({unit})</label>
  <input type="range" aria-labelledby={id} min={min} max={max} step={0.1} value={value}
   onChange={event=>{setDraft(null);onChange(Number(event.currentTarget.value));}}/>
  <div className="rank-card-number-entry">
   <input type="text" inputMode="decimal" aria-label={'Nhập số '+label.toLocaleLowerCase('vi')}
    aria-invalid={invalid||undefined} title={min+'–'+max+' '+unit} value={draft??String(value)}
    onChange={event=>{
     const text=event.currentTarget.value;
     setDraft(text);
     const next=parseCardNumber(text);
     if(next!==null&&next>=min&&next<=max)onChange(next);
    }}
    onBlur={commit}
    onKeyDown={event=>{
     if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
    }}/>
   <span aria-hidden="true">{unit}</span>
  </div>
 </div>;
}

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
  <fieldset className="rank-card-visibility">
   <legend>Trường hiển thị trên mặt này</legend>
   {cardKeys.map(item=><label key={item}><input type="checkbox" checked={side.slots[item].enabled}
    onChange={e=>onChange({...side,slots:{...side.slots,[item]:{...side.slots[item],enabled:e.target.checked}}})}/>{cardFields[item]}</label>)}
   {extras.map(item=><label key={item.id}><input type="checkbox" checked={item.slot.enabled}
    onChange={e=>onChange({...side,extras:extras.map(extra=>extra.id===item.id?{...extra,slot:{...extra.slot,enabled:e.target.checked}}:extra)})}/>{item.label||'Trường bổ sung'}</label>)}
  </fieldset>
  <div className="rank-card-filters" key={field?.id??key}>
   <NumericControl label="Từ trái" unit="%" min={0} max={95} value={slot.x} onChange={x=>changeSlot({x})}/>
   <NumericControl label="Từ trên" unit="%" min={0} max={95} value={slot.y} onChange={y=>changeSlot({y})}/>
   {isPhoto?<p>Ảnh hồ sơ tự đồng bộ, cắt theo khổ dọc 2 × 3 cm.</p>:
   <>
    <NumericControl label="Rộng tối đa" unit="%" min={3} max={100} value={slot.width??Math.round(98-slot.x)} onChange={width=>changeSlot({width})}/>
    <NumericControl label="Cỡ chữ" unit="mm" min={0.5} max={20} value={slot.fontMm??Math.max(0.5,Math.round(heightMm*slot.size/10)/10)} onChange={fontMm=>changeSlot({fontMm})}/>
    <label>Màu chữ<input type="color" value={slot.color??color} onChange={e=>changeSlot({color:e.target.value})}/></label>
   </>}
  </div>
 </div>;
}
