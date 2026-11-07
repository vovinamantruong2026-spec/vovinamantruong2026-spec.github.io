export function deletionReason(value:string){const reason=String(value||'').trim();if(reason.length<5||reason.length>500)throw new Error('Nhập lý do xóa từ 5 đến 500 ký tự.');return reason;}
export const deletionStatus:Record<string,string>={pending:'Chờ phê duyệt',approved:'Đã duyệt xóa',rejected:'Đã từ chối'};
