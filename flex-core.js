(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FlexCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN=60000;
  function themeTokens(hex){
    if(typeof hex!=='string'||!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('Use a color like #658D22.');
    const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),diff=max-min,l=(max+min)/2;
    let h=0,s=0;if(diff){s=diff/(1-Math.abs(2*l-1));h=max===r?((g-b)/diff)%6:max===g?(b-r)/diff+2:(r-g)/diff+4;h=(h*60+360)%360;}
    const saturation=s===0?0:Math.max(25,Math.min(70,s*100)),c=(sat,light)=>`hsl(${h.toFixed(1)} ${sat}% ${light}%)`;
    return{'--h':h.toFixed(1),'--s':saturation+'%','--kiwi':c(saturation,35),'--deep':c(saturation,22),'--hero':c(saturation,29),'--hero-track':c(saturation*.65,43),'--lime':c(saturation,78),'--soft':c(saturation,94),'--bg':c(saturation*.2,97),'--card':'#ffffff','--line':c(saturation*.3,88),'--ink':c(saturation*.35,16),'--muted':c(saturation*.15,42),'--accent':c(saturation,40),'--on-hero':c(saturation*.4,96)};
  }
  function stamp(n){if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>253402300799999)throw new Error('Invalid time.');return n;}
  function validDay(day){if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||dayKey(new Date(day+'T12:00:00'))!==day)throw new Error('Choose a valid date.');return day;}
  function formatClock(ms){const n=Math.floor(Math.max(0,ms)/1000);return[Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(n=>String(n).padStart(2,'0')).join(':');}
  function stopTimer(s,now=Date.now()){stamp(now);if(!s.timer)return;const start=s.timer.startedAt;if(now>start)s.sessions.push({id:uid(),projectId:s.timer.projectId,...(s.timer.habitId?{habitId:s.timer.habitId}:{}),...(s.timer.taskId?{taskId:s.timer.taskId}:{}),startedAt:start,endedAt:now,durationMs:now-start,source:'timer'});s.timer=null;}
  function startTimer(s,projectId,now=Date.now(),habitId=null,taskId=null){stamp(now);if(taskId){if(!s.tasks.some(t=>t.id===taskId))throw new Error('Task no longer exists.');}else if(habitId){if(!(s.habits||[]).some(h=>h.id===habitId&&!h.archivedAt))throw new Error('Habit no longer active.');}else if(!s.projects.some(p=>p.id===projectId))throw new Error('Project no longer exists.');if(s.timer&&(taskId?s.timer.taskId===taskId:habitId?s.timer.habitId===habitId:s.timer.projectId===projectId&&!s.timer.taskId))return;stopTimer(s,now);s.timer={projectId:habitId?null:projectId,...(habitId?{habitId}:{}),...(taskId?{taskId}:{}),startedAt:now};}
  function addMinutes(s,projectId,minutes,endAt,now=Date.now(),habitId=null){if(habitId?!(s.habits||[]).some(h=>h.id===habitId):!s.projects.some(p=>p.id===projectId))throw new Error('Project no longer exists.');if(!Number.isFinite(minutes)||minutes<=0||minutes>1440)throw new Error('Enter between 0.1 and 1,440 minutes.');stamp(endAt);if(endAt>now)throw new Error('Completed time must be in the past.');s.sessions.push({id:uid(),projectId:habitId?null:projectId,...(habitId?{habitId}:{}),startedAt:endAt-minutes*MIN,endedAt:endAt,durationMs:minutes*MIN,source:'manual'});}
  const HABIT_ICON_GROUPS=[
    {id:'animals',label:'Animals',icons:[['cat','Cat'],['dog','Dog'],['bear','Bear'],['panda','Panda'],['fish','Fish'],['rabbit','Rabbit'],['bird','Bird'],['turtle','Turtle'],['butterfly','Butterfly'],['fox','Fox'],['whale','Whale'],['paw','Paw']]},
    {id:'nature',label:'Nature',icons:[['sprout','Sprout'],['flower','Flower'],['leaf','Leaf'],['sun','Sun'],['moon','Moon'],['star','Star'],['tree','Tree'],['mountain','Mountain'],['rainbow','Rainbow'],['cloud','Cloud']]},
    {id:'creative',label:'Creative',icons:[['brush','Paintbrush'],['music','Music'],['pen','Writing'],['palette','Palette'],['camera','Camera'],['yarn','Yarn'],['scissors','Scissors'],['microphone','Singing']]},
    {id:'learning',label:'Learning',icons:[['book','Reading'],['code','Coding'],['globe','Languages'],['calculator','Math'],['microscope','Science'],['lightbulb','Ideas']]},
    {id:'wellbeing',label:'Wellbeing',icons:[['heart','Heart'],['water','Water'],['dumbbell','Workout'],['walk','Walk'],['bicycle','Cycling'],['meditation','Calm'],['bed','Sleep'],['fruit','Nutrition']]},
    {id:'everyday',label:'Everyday',icons:[['coffee','Coffee'],['meal','Cooking'],['home','Home'],['broom','Cleaning'],['bag','Shopping'],['wallet','Budget']]}
  ];
  const HABIT_ICONS=HABIT_ICON_GROUPS.flatMap(g=>g.icons.map(([id])=>id));
  function emptyState(){return{version:2,revision:0,displayUnit:'minutes',themeColor:'#658d22',savedHabitColors:[],events:[],projectTasks:[],projects:[],tasks:[],sessions:[],habits:[],habitChecks:[],habitEntries:[],timer:null,legacyGoals:[]};}
  function habitScheduled(h,date){
    validDay(date);
    return date>=dayKey(h.createdAt)&&(!h.archivedAt||date<dayKey(h.archivedAt))&&h.repeatDays.includes(new Date(date+'T12:00:00').getDay());
  }
  function toggleHabit(state,habitId,date,now=Date.now()){
    validDay(date);const h=state.habits.find(h=>h.id===habitId);
    if(!h)throw new Error('Habit no longer exists.');
    if(date>dayKey(now))throw new Error('Future days are not ready to check off.');
    const i=state.habitChecks.findIndex(c=>c.habitId===habitId&&c.date===date);
    if(i>=0){state.habitChecks.splice(i,1);const entry=(state.habitEntries||[]).find(e=>e.habitId===habitId&&e.date===date);if(entry)entry.status='todo';return;}
    if(!habitAvailable(state,h,date))throw new Error('This habit is not scheduled for that day.');
    if(date===dayKey(now)&&state.timer?.habitId===habitId)stopTimer(state,now);
    state.habitChecks.push({habitId,date});
  }
  function migrate(v1){const s=emptyState();s.projects=v1.habits.map(h=>({id:h.id,name:h.name,color:'kiwi',stages:[],createdAt:h.createdAt}));s.tasks=v1.tasks.map(t=>({id:t.id,title:t.title,date:t.date,time:null,projectId:null,done:t.done,createdAt:t.createdAt}));s.sessions=v1.logs.map(l=>({id:l.id,projectId:l.habitId,startedAt:l.startedAt,endedAt:l.endedAt,durationMs:l.durationMs,source:l.source}));s.timer=v1.timer?{projectId:v1.timer.habitId,startedAt:v1.timer.startedAt}:null;s.legacyGoals=v1.goals||[];return validateState(s);}
  function uid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'m_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);}
  function dayKey(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))throw new Error('Invalid date.');return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function startOfWeekSunday(now=Date.now()){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return d.getTime();}
  function nextWeekStart(now=Date.now()){const d=new Date(startOfWeekSunday(now));d.setDate(d.getDate()+7);return d.getTime();}
  function weekClock(now=Date.now()){
    const startAt=startOfWeekSunday(now),endAt=nextWeekStart(now),totalMs=endAt-startAt;
    const elapsedMs=Math.max(0,Math.min(totalMs,now-startAt)),remainingMs=Math.max(0,endAt-now);
    return{startAt,endAt,totalMs,elapsedMs,remainingMs,elapsedPercent:totalMs?elapsedMs/totalMs*100:0};
  }
  function parseDue(task){validDay(task.date);if(!task.time)return null;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time))throw new Error('Choose a valid time.');const d=new Date(`${task.date}T${task.time}:00`);if(d.getHours()!==Number(task.time.slice(0,2))||d.getMinutes()!==Number(task.time.slice(3)))throw new Error('That time does not exist on this date because the clocks change.');return d.getTime();}
  function countdown(deadline,now=Date.now()){
    const exact=deadline-now,remainingMs=Math.max(0,exact),seconds=Math.ceil(remainingMs/1000);
    return{expired:exact<=0,remainingMs,days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
  }
  function projectMinutes(state,projectId,now=Date.now()){return minutesBetween(state,0,now,now,projectId);}
  function minutesBetween(state,start,end,now=Date.now(),projectId=null,habitId=null,taskId=null){
    return state.sessions.filter(s=>(!projectId||s.projectId===projectId)&&(!habitId||s.habitId===habitId)&&(!taskId||s.taskId===taskId)).reduce((n,s)=>{
      if(s.entryDate){const d=new Date(s.entryDate+'T00:00:00').getTime();return n+(d>=start&&d<end&&d<=now?s.durationMs:0);}
      return n+Math.max(0,Math.min(s.endedAt,end,now)-Math.max(s.startedAt,start));
    },0)/MIN;
  }
  function setItemMinutes(state,t,minutes,now=Date.now()){
    if(!Number.isFinite(minutes)||minutes<0||minutes>(t.habitId?1440:10000000))throw new Error('Enter a valid total in minutes.');
    const current=t.habitId?dailyTasks(state,t.date).find(x=>x.habitId===t.habitId):state.tasks.find(x=>x.id===t.id);
    if(!current)throw new Error('Item no longer exists.');
    if(current.date>dayKey(now))throw new Error('Enter completed time on today or an earlier date.');
    if(!current.habitId){
      // Correct the total without moving earlier work to a different day.
      const entries=state.sessions.filter(s=>s.taskId===current.id),total=entries.reduce((n,s)=>n+s.durationMs,0)/MIN;
      let delta=Math.round((minutes-total)*MIN);
      if(delta>0){const existing=entries.find(s=>s.entryDate===current.date&&s.source==='manual');if(existing){existing.durationMs+=delta;existing.endedAt+=delta;}else{const a=new Date(current.date+'T00:00:00').getTime();state.sessions.push({id:uid(),projectId:current.projectId,stageId:current.stageId||null,taskId:current.id,startedAt:a,endedAt:a+delta,durationMs:delta,entryDate:current.date,source:'manual'});}}
      else if(delta<0){for(const s of entries.sort((a,b)=>b.startedAt-a.startedAt)){const cut=Math.min(-delta,s.durationMs);s.durationMs-=cut;s.endedAt-=cut;delta+=cut;if(!delta)break;}state.sessions=state.sessions.filter(s=>s.durationMs>0);}
      return;
    }
    const start=new Date(current.date+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
    const a=start.getTime(),b=end.getTime(),keep=[];
    for(const s of state.sessions){
      if(!current.habitId){if(s.taskId!==current.id)keep.push(s);continue;}
      if(s.habitId!==current.habitId){keep.push(s);continue;}
      if(s.entryDate){if(s.entryDate!==current.date)keep.push(s);continue;}
      if(s.endedAt<=a||s.startedAt>=b){keep.push(s);continue;}
      if(s.startedAt<a)keep.push({...s,endedAt:a,durationMs:a-s.startedAt});
      if(s.endedAt>b)keep.push({...s,id:s.startedAt<a?uid():s.id,startedAt:b,durationMs:s.endedAt-b});
    }
    if(minutes>0)keep.push({id:uid(),projectId:current.habitId?null:current.projectId,...(current.habitId?{habitId:current.habitId}:{taskId:current.id}),startedAt:a,endedAt:a+minutes*MIN,durationMs:minutes*MIN,entryDate:current.date,source:'manual'});
    state.sessions=keep;
  }
  function itemDayMinutes(state,t,date,now=Date.now()){
    validDay(date);const start=new Date(date+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
    return minutesBetween(state,start.getTime(),end.getTime(),now,null,t.habitId||null,t.habitId?null:t.id);
  }
  function setItemDayMinutes(state,t,date,minutes,now=Date.now()){
    validDay(date);if(date>dayKey(now))throw new Error('Record time on today or an earlier date.');
    if(!Number.isFinite(minutes)||minutes<0||minutes>1440)throw new Error('Enter 0 to 1,440 minutes for this day.');
    const owner=t.habitId?state.habits.find(h=>h.id===t.habitId):state.tasks.find(x=>x.id===t.id);if(!owner)throw new Error('Item no longer exists.');
    const start=new Date(date+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);const a=start.getTime(),b=end.getTime(),keep=[];
    for(const s of state.sessions){
      if(t.habitId?s.habitId!==t.habitId:s.taskId!==t.id){keep.push(s);continue;}
      if(s.entryDate){if(s.entryDate!==date)keep.push(s);continue;}
      if(s.endedAt<=a||s.startedAt>=b){keep.push(s);continue;}
      if(s.startedAt<a)keep.push({...s,endedAt:a,durationMs:a-s.startedAt});
      if(s.endedAt>b)keep.push({...s,id:s.startedAt<a?uid():s.id,startedAt:b,durationMs:s.endedAt-b});
    }
    if(minutes>0){const ms=Math.round(minutes*MIN);keep.push({id:uid(),projectId:t.habitId?null:owner.projectId,stageId:t.habitId?null:owner.stageId||null,...(t.habitId?{habitId:t.habitId}:{taskId:t.id}),startedAt:a,endedAt:a+ms,durationMs:ms,entryDate:date,source:'manual'});}
    state.sessions=keep;
  }
  function updateTask(state,task,data){
    if(data.date)validDay(data.date);
    Object.assign(task,data);
    if(task.projectTaskId){const source=state.projectTasks.find(x=>x.id===task.projectTaskId);if(!source)throw new Error('The linked project task no longer exists.');task.projectId=source.projectId;task.stageId=source.stageId;}
    if(!state.projects.find(p=>p.id===task.projectId)?.stages.some(s=>s.id===task.stageId))task.stageId=null;
    state.sessions.forEach(s=>{if(s.taskId===task.id){s.projectId=task.projectId;s.stageId=task.stageId||null;}});
  }
  function stageSummary(state,project,stage,now=Date.now()){
    const tasks=(state.projectTasks||[]).filter(t=>t.projectId===project.id&&t.stageId===stage.id),done=tasks.filter(t=>t.status==='done').length;
    const status=stage.done?'done':stage.status||'todo';
    const minutes=minutesBetween({sessions:state.sessions.filter(s=>s.projectId===project.id&&s.stageId===stage.id)},0,now,now);
    return{tasks,total:tasks.length,done,status,minutes,percent:tasks.length?done/tasks.length*100:status==='done'?100:0};
  }
  function replaceStages(state,project,stages){
    project.stages=stages;const ids=new Set(stages.map(s=>s.id));
    if(!ids.has(project.currentStageId))project.currentStageId=null;
    for(const t of state.projectTasks||[])if(t.projectId===project.id&&t.stageId&&!ids.has(t.stageId))t.stageId=null;
    for(const t of state.tasks)if(t.projectId===project.id&&t.stageId&&!ids.has(t.stageId))t.stageId=null;
    for(const s of state.sessions)if(s.projectId===project.id&&s.stageId&&!ids.has(s.stageId))s.stageId=null;
  }
  function addProjectTask(state,projectId,stageId,title,now=Date.now()){
    const p=state.projects.find(x=>x.id===projectId);if(!p||stageId&&!p.stages.some(x=>x.id===stageId))throw new Error('Choose a valid project and stage.');
    const t={id:uid(),projectId,stageId:stageId||null,title:text(title,'Task title',180),status:'todo',createdAt:now};(state.projectTasks||=[]).push(t);return t;
  }
  function addTodayEntry(state,projectTaskId,title,date,now=Date.now()){
    const t=state.projectTasks.find(x=>x.id===projectTaskId);if(!t)throw new Error('Project task no longer exists.');
    const p=state.projects.find(x=>x.id===t.projectId),stage=p.stages.find(x=>x.id===t.stageId);
    const entry={id:uid(),title:text(title,'Today entry',180),date:validDay(date),time:null,projectId:p.id,stageId:t.stageId,projectTaskId:t.id,source:{projectName:p.name,stageName:stage?.label||'',taskTitle:t.title},done:false,status:'todo',notes:'',createdAt:now};state.tasks.push(entry);return entry;
  }
  function setProjectTaskStatus(state,id,status){if(!['todo','in_progress','done'].includes(status))throw new Error('Invalid project task status.');const t=state.projectTasks.find(t=>t.id===id);if(!t)throw new Error('Project task no longer exists.');t.status=status;}
  function deleteProject(state,id){
    state.projects=state.projects.filter(p=>p.id!==id);state.projectTasks=state.projectTasks.filter(t=>t.projectId!==id);
    for(const t of state.tasks)if(t.projectId===id){t.projectId=null;t.stageId=null;t.projectTaskId=null;}
    for(const s of state.sessions)if(s.projectId===id){s.projectId=null;s.stageId=null;}
  }
  function habitAvailable(state,h,date){const e=habitEntry(state,h.id,date);return !e?.resolution&&(habitScheduled(h,date)||e?.extra===true);}
  function resolveUnfinished(state,t,action,date,now=Date.now()){
    if(!['keep','move','let_go'].includes(action))throw new Error('Choose how to adjust this item.');
    const target=action==='keep'?dayKey(now):action==='move'?validDay(date):null;
    if(target&&target===t.date)throw new Error('Choose another date.');
    if(t.habitId){
      const h=state.habits.find(h=>h.id===t.habitId);if(!h)throw new Error('Habit no longer exists.');
      const e=habitEntry(state,h.id,t.date,true);e.resolution=target?'moved':'let_go';if(target)e.movedTo=target;else delete e.movedTo;
      if(target){const next=habitEntry(state,h.id,target,true);next.extra=true;delete next.resolution;delete next.movedTo;}
    }else{const task=state.tasks.find(x=>x.id===t.id);if(!task)throw new Error('Task no longer exists.');if(target)updateTask(state,task,{date:target,resolution:null});else task.resolution='let_go';}
  }
  function habitMinutes(state,habitId,now=Date.now()){return minutesBetween(state,0,now,now,null,habitId);}
  function habitEntry(state,habitId,date,create=false){let e=(state.habitEntries||[]).find(e=>e.habitId===habitId&&e.date===date);if(!e&&create){e={habitId,date,status:'todo',notes:''};(state.habitEntries||= []).push(e);}return e;}
  function itemStatus(state,t){return t.done?'done':itemRunning(state,t)?'in_progress':t.habitId?(habitEntry(state,t.habitId,t.date)?.status||'todo'):(t.status||'todo');}
  function itemRunning(state,t){return !!state.timer&&(t.habitId?state.timer.habitId===t.habitId&&t.date===dayKey(state.timer.startedAt):state.timer.taskId===t.id);}
  function setItemStatus(state,t,status,now=Date.now()){
    if(!['todo','in_progress','done'].includes(status))throw new Error('Invalid task status.');
    const current=t.habitId?dailyTasks(state,t.date).find(x=>x.habitId===t.habitId):state.tasks.find(x=>x.id===t.id);
    if(!current)throw new Error('Item no longer exists.');
    if(current.habitId&&current.date>dayKey(now)&&status!=='todo')throw new Error('Future habits are not ready to start.');
    if(status==='in_progress'){
      state.tasks.forEach(x=>{if(x.status==='in_progress')x.status='todo';});
      (state.habitEntries||[]).forEach(x=>{if(x.status==='in_progress')x.status='todo';});
    }
    if(itemRunning(state,current)&&status!=='in_progress')stopTimer(state,now);
    if(current.habitId){
      const e=habitEntry(state,current.habitId,current.date,true);e.status=status==='in_progress'?'in_progress':'todo';
      const checked=state.habitChecks.some(c=>c.habitId===current.habitId&&c.date===current.date);
      if((status==='done')!==checked)toggleHabit(state,current.habitId,current.date,now);
    }else{current.status=status;current.done=status==='done';}

  }
  function saveItemNotes(state,t,notes){
    if(typeof notes!=='string'||notes.length>6000)throw new Error('Keep notes within 6,000 characters.');
    if(t.habitId){if(!(state.habits||[]).some(h=>h.id===t.habitId))throw new Error('Habit no longer exists.');habitEntry(state,t.habitId,validDay(t.date),true).notes=notes;}
    else {const task=state.tasks.find(x=>x.id===t.id);if(!task)throw new Error('Task no longer exists.');task.notes=notes;}
  }
  function deleteTask(state,id,now=Date.now()){if(state.timer?.taskId===id)stopTimer(state,now);state.tasks=state.tasks.filter(t=>t.id!==id);state.sessions.forEach(s=>{if(s.taskId===id)delete s.taskId;});}
  function dailyTasks(state,date){
    validDay(date);const checks=new Set((state.habitChecks||[]).filter(c=>c.date===date).map(c=>c.habitId));
    return [...state.tasks.filter(t=>t.date===date&&!t.resolution),...(state.habits||[]).filter(h=>habitAvailable(state,h,date)||checks.has(h.id)).map(h=>({id:'habit_'+h.id+'_'+date,habitId:h.id,title:habitEntry(state,h.id,date)?.title||h.name,date,time:null,projectId:null,done:checks.has(h.id),status:checks.has(h.id)?'done':habitEntry(state,h.id,date)?.status||'todo',notes:habitEntry(state,h.id,date)?.notes||''}))];
  }
  function stagePercent(project){return project.stages.length?project.stages.filter(x=>x.done).length/project.stages.length*100:0;}
  function nextSaturday(now){const d=new Date(now);const add=(6-d.getDay()+7)%7;if(add===0&&d.getHours()>=14)d.setDate(d.getDate()+7);else d.setDate(d.getDate()+add);d.setHours(14,0,0,0);return d;}
  function createState(now=Date.now()){
    const p1=uid(),p2=uid(),p3=uid(),art=nextSaturday(now);
    return{version:2,revision:0,displayUnit:'minutes',projects:[
      {id:p1,name:'Studio practice',color:'coral',stages:[{id:uid(),label:'Choose a direction',done:true},{id:uid(),label:'Build the study',done:false},{id:uid(),label:'Finish and reflect',done:false}],createdAt:now},
      {id:p2,name:'Portfolio',color:'blue',stages:[{id:uid(),label:'Collect work',done:false},{id:uid(),label:'Write notes',done:false}],createdAt:now},
      {id:p3,name:'Life admin',color:'gold',stages:[],createdAt:now}
    ],tasks:[{id:uid(),title:'Art class',date:dayKey(art),time:'14:00',projectId:p1,done:false,createdAt:now}],sessions:[],timer:null};
  }
  function text(v,label,max=160){if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`${label} must contain 1–${max} characters.`);return v.trim();}
  function timeMinute(value,end=false){if(end&&value==='24:00')return 1440;if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Choose a valid time.');return Number(value.slice(0,2))*60+Number(value.slice(3));}
  function validateEvent(e){
    const date=validDay(e.date),start=timeMinute(e.startTime),end=timeMinute(e.endTime,true);
    if(end<=start)throw new Error('End time must be after start time. Use 12:00 AM for midnight.');
    const repeat=e.repeat||'none';if(!['none','daily','weekly','monthly','custom'].includes(repeat))throw new Error('Choose a valid repeat rule.');
    const repeatDays=e.repeatDays||[];if(!Array.isArray(repeatDays)||repeatDays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(repeatDays).size!==repeatDays.length||(repeat==='custom'&&!repeatDays.length))throw new Error('Choose at least one custom repeat day.');
    themeTokens(e.color);
    const excludedDates=e.excludedDates||[];if(!Array.isArray(excludedDates)||excludedDates.length>10000)throw new Error('Invalid excluded dates.');
    return{id:id(e.id),title:text(e.title,'Event title',180),date,startTime:e.startTime,endTime:e.endTime,repeat,repeatDays:[...repeatDays],color:e.color.toLowerCase(),excludedDates:[...new Set(excludedDates.map(validDay))],createdAt:stamp(e.createdAt)};
  }
  function eventsOnDate(state,date){
    validDay(date);const d=new Date(date+'T12:00:00');
    return (state.events||[]).filter(e=>{if(date<e.date||e.excludedDates.includes(date))return false;const first=new Date(e.date+'T12:00:00');return e.repeat==='none'?date===e.date:e.repeat==='daily'?true:e.repeat==='weekly'?d.getDay()===first.getDay():e.repeat==='monthly'?d.getDate()===first.getDate():e.repeatDays.includes(d.getDay());}).map(e=>({...e,occurrenceDate:date})).sort((a,b)=>a.startTime.localeCompare(b.startTime)||a.title.localeCompare(b.title));
  }
  function id(v){const n=text(v,'ID',120);if(!/^[A-Za-z0-9_-]+$/.test(n))throw new Error('Invalid item ID.');return n;}
  function validateState(raw){
    if(!raw||typeof raw!=='object'||raw.version!==2)throw new Error('This backup is not a Minute flexible-time backup.');
    if(!Number.isSafeInteger(raw.revision)||raw.revision<0)throw new Error('Invalid backup revision.');
    if(!['minutes','hours'].includes(raw.displayUnit))throw new Error('Invalid time display unit.');
    for(const [k,max] of [['projects',500],['tasks',20000],['sessions',100000]])if(!Array.isArray(raw[k])||raw[k].length>max)throw new Error(`Invalid ${k} list.`);
    const ids=new Set();const takeId=v=>{const x=id(v);if(ids.has(x))throw new Error('Duplicate item IDs.');ids.add(x);return x;};
    const projects=raw.projects.map(p=>{if(!p||typeof p!=='object'||!Array.isArray(p.stages)||p.stages.length>100)throw new Error('Invalid project.');return{id:takeId(p.id),name:text(p.name,'Project name',100),description:typeof p.description==='string'&&p.description.length<=6000?p.description:'',currentStageId:p.currentStageId||null,color:['kiwi','moss','olive','mint'].includes(p.color)?p.color:'kiwi',stages:p.stages.map(s=>{if(typeof s.done!=='boolean')throw new Error('Invalid stage completion.');return{id:takeId(s.id),label:text(s.label,'Stage',120),done:s.done,status:s.done?'done':s.status==='in_progress'?'in_progress':'todo'};}),createdAt:stamp(p.createdAt)};});
    const projectIds=new Set(projects.map(p=>p.id));const projectRef=v=>v===null?null:projectIds.has(v)?v:(()=>{throw new Error('A saved item refers to a missing project.');})();
    const stageRef=(value,pid)=>{if(value==null)return null;if(!projects.find(p=>p.id===pid)?.stages.some(s=>s.id===value))throw new Error('A task or time entry refers to a missing stage.');return value;};
    const tasks=raw.tasks.map(t=>{parseDue(t);if(t.status!=null&&!['todo','in_progress','done'].includes(t.status))throw new Error('Invalid task status.');if(t.notes!=null&&(typeof t.notes!=='string'||t.notes.length>6000))throw new Error('Invalid task notes.');if(typeof t.done!=='boolean')throw new Error('Invalid task completion.');return{id:takeId(t.id),title:text(t.title,'Task title',180),date:validDay(t.date),time:t.time||null,projectId:projectRef(t.projectId),stageId:stageRef(t.stageId,t.projectId),projectTaskId:t.projectTaskId||null,source:t.source?{projectName:text(t.source.projectName,'Source project',100),stageName:t.source.stageName?text(t.source.stageName,'Source stage',120):'',taskTitle:text(t.source.taskTitle,'Source task',180)}:null,done:t.done,status:t.done?'done':t.status==='in_progress'?'in_progress':'todo',notes:t.notes||'',resolution:t.resolution==='let_go'?'let_go':null,createdAt:stamp(t.createdAt)};});
    for(const p of projects)if(p.currentStageId&&!p.stages.some(s=>s.id===p.currentStageId))throw new Error('Current stage is missing.');
    let rawProjectTasks=raw.projectTasks;
    if(rawProjectTasks===undefined){rawProjectTasks=tasks.filter(t=>t.projectId).map(t=>{const task={id:uid(),title:t.title,projectId:t.projectId,stageId:t.stageId,status:t.done?'done':t.status,createdAt:t.createdAt};t.projectTaskId=task.id;const p=projects.find(p=>p.id===t.projectId);t.source={projectName:p.name,stageName:p.stages.find(s=>s.id===t.stageId)?.label||'',taskTitle:t.title};return task;});}
    if(!Array.isArray(rawProjectTasks)||rawProjectTasks.length>20000)throw new Error('Invalid project tasks.');
    const projectTasks=rawProjectTasks.map(t=>{if(!['todo','in_progress','done'].includes(t.status))throw new Error('Invalid project task status.');if(!t.projectId)throw new Error('Project task requires a project.');return{id:takeId(t.id),title:text(t.title,'Project task',180),projectId:projectRef(t.projectId),stageId:stageRef(t.stageId,t.projectId),status:t.status,createdAt:stamp(t.createdAt)};});
    for(const t of tasks)if(t.projectTaskId){const source=projectTasks.find(x=>x.id===t.projectTaskId);if(!source||source.projectId!==t.projectId||source.stageId!==t.stageId)throw new Error('Today entry has an invalid project task link.');}
    const habitRef=v=>{if(!(raw.habits||[]).some(h=>h.id===v))throw new Error('Time entry refers to a missing habit.');return v;};
    const owner=s=>{if(s.taskId!=null){if(s.habitId!=null||!tasks.some(t=>t.id===s.taskId))throw new Error('Invalid task time reference.');return{projectId:projectRef(s.projectId),stageId:stageRef(s.stageId===undefined?tasks.find(t=>t.id===s.taskId).stageId:s.stageId,s.projectId),taskId:s.taskId};}if(s.habitId!=null){if(s.projectId!=null)throw new Error('Time cannot belong to both a habit and project.');return{projectId:null,habitId:habitRef(s.habitId)};}return{projectId:projectRef(s.projectId),stageId:stageRef(s.stageId,s.projectId)};};
    const sessions=raw.sessions.map(s=>{const start=Number(s.startedAt),end=Number(s.endedAt),duration=Number(s.durationMs);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||duration!==end-start)throw new Error('Invalid time entry.');return{id:takeId(s.id),...owner(s),startedAt:start,endedAt:end,durationMs:duration,...(s.entryDate?{entryDate:validDay(s.entryDate)}:{}),source:s.source==='manual'?'manual':'timer'};});
    let timer=null;if(raw.timer){const startedAt=Number(raw.timer.startedAt);if(!Number.isFinite(startedAt))throw new Error('Invalid timer.');timer={...owner(raw.timer),startedAt};}
    const previousTimer=raw.previousTimer||timer;timer=null;
    const legacyGoals=raw.legacyGoals||[];if(!Array.isArray(legacyGoals)||legacyGoals.length>5000)throw new Error('Invalid archived goals.');
    const rawHabits=raw.habits??[],rawChecks=raw.habitChecks??[];
    if(!Array.isArray(rawHabits)||rawHabits.length>500||!Array.isArray(rawChecks)||rawChecks.length>100000)throw new Error('Invalid habit records.');
    const habits=rawHabits.map(h=>{
      if(!h||!HABIT_ICONS.includes(h.icon)||!Array.isArray(h.repeatDays)||!h.repeatDays.length||h.repeatDays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(h.repeatDays).size!==h.repeatDays.length)throw new Error('Choose an icon and at least one repeat day.');
      const createdAt=stamp(h.createdAt),archivedAt=h.archivedAt==null?null:stamp(h.archivedAt);
      if(archivedAt!==null&&archivedAt<createdAt)throw new Error('Invalid habit archive date.');
      if(h.color!=null&&(typeof h.color!=='string'||!/^#[0-9a-f]{6}$/i.test(h.color)))throw new Error('Choose a valid habit color.');
      return{id:takeId(h.id),name:text(h.name,'Habit name',100),icon:h.icon,color:h.color?.toLowerCase()||null,repeatDays:[...h.repeatDays].sort(),createdAt,archivedAt};
    });
    const habitIds=new Set(habits.map(h=>h.id)),checks=new Set();
    const habitChecks=rawChecks.map(c=>{if(!c||!habitIds.has(c.habitId))throw new Error('A check-in refers to a missing habit.');const date=validDay(c.date),key=c.habitId+':'+date;if(checks.has(key))throw new Error('Duplicate habit check-in.');checks.add(key);return{habitId:c.habitId,date};});
    const rawEntries=raw.habitEntries??[];if(!Array.isArray(rawEntries)||rawEntries.length>100000)throw new Error('Invalid habit notes.');const entryKeys=new Set();
    const habitEntries=rawEntries.map(e=>{if(!e||!habitIds.has(e.habitId)||!['todo','in_progress'].includes(e.status)||typeof e.notes!=='string'||e.notes.length>6000)throw new Error('Invalid habit note or status.');const date=validDay(e.date),key=e.habitId+':'+date;if(entryKeys.has(key))throw new Error('Duplicate daily habit notes.');entryKeys.add(key);if(e.resolution!=null&&!['moved','let_go'].includes(e.resolution))throw new Error('Invalid daily decision.');return{habitId:e.habitId,date,status:e.status,notes:e.notes,...(e.title?{title:text(e.title,'Task title',180)}:{}),extra:e.extra===true,...(e.resolution?{resolution:e.resolution}:{}),...(e.movedTo?{movedTo:validDay(e.movedTo)}:{})};});
    const themeColor=raw.themeColor??'#658d22';themeTokens(themeColor);
    const rawHabitColors=raw.savedHabitColors??[];
    if(!Array.isArray(rawHabitColors)||rawHabitColors.length>24||rawHabitColors.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))throw new Error('Saved habit colors must contain up to 24 valid colors.');
    const savedHabitColors=[...new Set(rawHabitColors.map(c=>c.toLowerCase()))];
    const rawEvents=raw.events??tasks.filter(t=>t.time&&!t.done&&!t.resolution).map(t=>{const start=timeMinute(t.time),end=Math.min(start+60,1440);return{id:uid(),title:t.title,date:t.date,startTime:t.time,endTime:end===1440?'24:00':String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0'),repeat:'none',repeatDays:[],color:themeColor,createdAt:t.createdAt};});
    if(!Array.isArray(rawEvents)||rawEvents.length>20000)throw new Error('Invalid events list.');
    const events=rawEvents.map(e=>{const event=validateEvent(e);takeId(event.id);return event;});
    let active=false;for(const t of tasks){if(t.resolution){t.status='todo';continue;}if(t.status==='in_progress'){if(active)t.status='todo';else active=true;}}
    for(const e of habitEntries){if(e.resolution){e.status='todo';continue;}if(e.status==='in_progress'){if(active)e.status='todo';else active=true;}}
    return{version:2,revision:raw.revision,displayUnit:raw.displayUnit,themeColor:themeColor.toLowerCase(),savedHabitColors,projects,projectTasks,tasks,sessions,habits,habitChecks,habitEntries,events,timer,previousTimer:previousTimer?JSON.parse(JSON.stringify(previousTimer)):null,legacyGoals:JSON.parse(JSON.stringify(legacyGoals))};
  }
return{MIN,HABIT_ICON_GROUPS,addProjectTask,addTodayEntry,setProjectTaskStatus,deleteProject,stageSummary,replaceStages,itemDayMinutes,setItemDayMinutes,timeMinute,validateEvent,eventsOnDate,habitAvailable,resolveUnfinished,HABIT_ICONS,habitScheduled,toggleHabit,habitMinutes,setItemMinutes,updateTask,dailyTasks,habitEntry,itemStatus,itemRunning,setItemStatus,saveItemNotes,deleteTask,uid,dayKey,validDay,themeTokens,formatClock,stopTimer,startTimer,addMinutes,migrate,emptyState,startOfWeekSunday,nextWeekStart,weekClock,parseDue,countdown,projectMinutes,minutesBetween,stagePercent,createState,validateState};
});
