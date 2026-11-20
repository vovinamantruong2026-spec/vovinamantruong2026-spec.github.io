const clubDate = new Intl.DateTimeFormat('en-CA', {
 timeZone:'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit'
});

export function absenceLockCandidates(records, today) {
 const attendance = new Map();
 for (const {kind, data} of records) {
  if (kind !== 'attendance' || data.deleted || data.status !== 'final' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || data.date > today) continue;
  for (const mark of data.rows || []) {
   if (mark.makeup || !['absent', 'present', 'excused'].includes(mark.status)) continue;
   const dates = attendance.get(mark.studentUid) || new Map();
   attendance.set(mark.studentUid, dates);
   // A confirmed presence or excuse takes precedence over duplicate absence marks.
   if (!dates.has(data.date) || mark.status !== 'absent') dates.set(data.date, mark.status);
  }
 }
 const candidates = [];
 for (const record of records) {
  const {kind, id, data} = record;
  if (kind !== 'student' || data.deleted || data.enrollmentStatus === 'withdrawn' ||
      data.absenceLock?.locked) continue;
  const reopenedAt = data.absenceLock?.unlockedAt?.toDate?.();
  const ignoreThrough = [data.absenceLock?.through || '', reopenedAt ? clubDate.format(reopenedAt) : ''].sort().at(-1);
  let streak = 0;
  let through = '';
  for (const [date, status] of [...(attendance.get(id) || [])].sort(([a], [b]) => a.localeCompare(b))) {
   if (date < (data.joinDate || '') || date <= ignoreThrough) continue;
   streak = status === 'absent' ? streak + 1 : 0;
   through = date;
  }
  if (streak > 4) candidates.push({record, lock: {locked: true, streak, through}});
 }
 return candidates;
}
