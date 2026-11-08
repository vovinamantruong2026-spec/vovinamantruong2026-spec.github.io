import {MoreHorizontal} from 'lucide-react';
export default function MobileNavigation({items,active,expanded,onNavigate,onMore}:any){
 const primary=['overview','students','attendance','tuition'].map(id=>items.find((n:any)=>n[0]===id)).filter(Boolean);
 return <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh" style={{gridTemplateColumns:'repeat('+(primary.length+1)+',minmax(0,1fr))'}}>{primary.map(([id,label,Icon]:any)=><button type="button" key={id} className={active===id?'active':''} aria-current={active===id?'page':undefined} onClick={()=>onNavigate(id)}><Icon size={21}/><span>{id==='overview'?'Tổng quan':label}</span></button>)}<button type="button" className={!primary.some((n:any)=>n[0]===active)?'active':''} aria-label="Thêm mục điều hướng" aria-expanded={expanded} aria-controls="club-sidebar" onClick={onMore}><MoreHorizontal size={22}/><span>Thêm</span></button></nav>;
}
