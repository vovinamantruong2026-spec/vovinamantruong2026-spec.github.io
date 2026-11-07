export function operationAlerts(settings:any,now=new Date()){
 const warnings:string[]=[];const expiry=settings.trialEnd;
 if(/^\d{4}-\d{2}-\d{2}$/.test(expiry||'')){const days=Math.ceil((Date.parse(expiry+'T23:59:59+07:00')-now.getTime())/86400000);if(days<=30)warnings.push(days<0?'Ưu đãi đã hết hạn. Kiểm tra trạng thái thanh toán trên Google Cloud.':'Ưu đãi còn '+days+' ngày. Kiểm tra phương án duy trì dịch vụ.');}
 for(const [key,label] of [['firestoreUsedMB','Firestore'],['storageUsedMB','Kho tệp']] as const){const used=Number(settings[key]),limit=Number(settings[key==='firestoreUsedMB'?'firestoreLimitMB':'storageLimitMB']);if(Number.isFinite(used)&&used>=0&&limit>0&&used/limit>=.8)warnings.push(label+' đã dùng '+Math.round(used/limit*100)+'% ngưỡng theo dõi.');}
 const spend=Number(settings.spentVnd),budget=Number(settings.budgetVnd);if(Number.isFinite(spend)&&budget>0&&spend/budget>=.8)warnings.push('Chi phí tháng '+(settings.billingMonth||'(chưa chọn)')+' đã đạt '+Math.round(spend/budget*100)+'% ngân sách đã nhập.');
 return warnings;
}

export function backupHealth(status:any,now=Date.now()){
 const millis=(v:any)=>v?.toMillis?.()??(typeof v==='string'?Date.parse(v):NaN);
 const success=millis(status?.lastSuccessAt),failure=millis(status?.lastFailureAt);
 if(!Number.isFinite(success))return {tone:'warning',text:'Chưa có xác nhận sao lưu tuần thành công'};
 if(Number.isFinite(failure)&&failure>success)return {tone:'warning',text:'Lần sao lưu gần nhất bị lỗi; bản thành công trước đó vẫn được giữ'};
 if(now-success>8*86400000)return {tone:'warning',text:'Đã quá 8 ngày chưa có bản sao tuần thành công mới'};
 return {tone:'info',text:'Có bản sao tuần thành công trong 8 ngày gần đây'};
}
