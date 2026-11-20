export type ExamDetails = {
 name: string;
 date: string;
 location: string;
 organization: string;
 fee: number;
};

type RankFields = {examSession:string; examDate:string; organization:string; belt:string};
type Award = {examId:string; before:RankFields; awarded:RankFields};
type Profile = Partial<RankFields> & {examAwards?:Award[]};

function fields(data:Partial<RankFields>):RankFields {
 return {
  examSession:data.examSession??'', examDate:data.examDate??'',
  organization:data.organization??'', belt:data.belt??'',
 };
}

function same(left:RankFields,right:RankFields) {
 return left.examSession===right.examSession && left.examDate===right.examDate &&
  left.organization===right.organization && left.belt===right.belt;
}

function withoutAward(awards:Award[],index:number) {
 const history=awards.filter((_,position)=>position!==index);
 const next=history[index];
 const award=awards[index];
 if(next&&same(next.before,award.awarded))history[index]={...next,before:award.before};
 return history;
}

export function examAwardPatch(profile:Profile,examId:string,exam:ExamDetails,entry:{
 result:'pending'|'pass'|'fail'; belt?:string; revokedBelt?:string; previousBelt?:string;
}) {
 const current=fields(profile);
 const awards=profile.examAwards??[];
 const index=awards.findIndex(award=>award.examId===examId);
 const latest=awards.at(-1);
 const tracked=latest!==undefined&&same(current,latest.awarded);

 if(entry.result==='pass'){
  if(!exam.name||!exam.organization||!exam.date)throw new Error('Bổ sung đơn vị và ngày thi trong cài đặt khóa thi.');
  const belt=entry.belt?.trim();
  if(!belt)throw new Error('Chọn cấp đai thi.');
  if(current.examDate>exam.date||(tracked&&index>=0&&index<awards.length-1))return null;
  const awarded={examSession:exam.name,examDate:exam.date,organization:exam.organization,belt};
  if(same(awarded,current))return null;
  // A change made directly in the profile starts a new restoration history.
  const history=tracked&&index>=0?withoutAward(awards,index):tracked?[...awards]:[];
  const before=tracked&&index===awards.length-1?awards[index].before:current;
  history.push({examId,before,awarded});
  return {...awarded,examAwards:history};
 }

 if(index>=0){
  return {...(tracked&&index===awards.length-1?awards[index].before:{}),examAwards:withoutAward(awards,index)};
 }

 // Old results have no saved snapshot. Require the operator to supply the
 // previous belt, and only clear fields if they still identify this award.
 const revokedBelt=entry.revokedBelt?.trim();
 if(tracked||!revokedBelt||!same(current,{
  examSession:exam.name,examDate:exam.date,organization:exam.organization,belt:revokedBelt,
 }))return null;
 const previousBelt=entry.previousBelt?.trim();
 if(!previousBelt)throw new Error('Nhập cấp đai trước khóa thi để sửa kết quả cũ.');
 return {...fields({belt:previousBelt}),examAwards:[]};
}
