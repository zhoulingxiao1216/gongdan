/* Business rules shared by the desktop workbench and order drawer. */
(function(root){
  'use strict';
  const names=['贴纸','吊牌','洗标','FBA','内侧检品','开封作业','剪标','换包装','拍照'];
  const previewNames=['贴纸','吊牌','洗标','FBA'];
  const employees=[{id:'V026',name:'演示员工甲'},{id:'Q018',name:'演示员工乙'},{id:'A102',name:'演示员工丙'}];
  function day(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
  function timestamp(){const d=new Date();return day(d)+' '+[d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':')}
  function seed(){
    const date=day(), yesterday=day(new Date(Date.now()-86400000));
    const orders=Array.from({length:8},(_,i)=>({id:'DEMO-DD-'+String(i+1).padStart(3,'0'),customer:'演示客户'+String.fromCharCode(65+i),country:i%3===0?'日本':'中国',level:i%2?'普通会员':'企业会员',status:['进行中','待审核','进行中','待清算','已清算','进行中','待审核','进行中'][i],amount:[1853.4,795.88,1420,55.04,2149.3,868.2,432.4,285.5][i],payDate:date,manager:'演示客户经理',buyer:'演示采购员',note:''}));
    const goods=Array.from({length:12},(_,i)=>({id:'DDEMO'+String(i+1).padStart(3,'0'),order:orders[i<4?0:Math.min(i-3,7)].id,name:i%2?'基础款棉质背心':'基础款圆领上衣',spec:'黑色 / '+(i%2?'L':'M'),shop:i<2?'演示服饰店A':'演示服饰店B',arrived:i===2?4:i===3?6:10,good:i===2?0:i===3?6:8,version:1,previous:i===2?0:i===3?6:8,qc:'全数宽松',tasks:i===3?[]:names.map((name,j)=>({id:'T'+(j+1),name,proofRequired:name==='拍照'})),settlement:{status:i===2?'等待正品':'按现行规则默认完成',amount:28.8},price:20.9}));
    let seq=0;
    const records=[];
    function add(goods,task,qty,person,source,time){records.push({id:'RG'+String(++seq).padStart(6,'0'),goods,task,qty,person,source,time,submitter:'DEMO-ADMIN',good:8,proof:'',proofName:'',requestId:'seed-'+seq})}
    add('DDEMO001','T1',5,'V026','小程序',date+' 09:10:00');
    add('DDEMO001','T3',8,'Q018','PC',date+' 09:15:00');
    add('DDEMO001','T5',8,'V026','PC',date+' 09:20:00');
    add('DDEMO002','T1',3,'A102','小程序',date+' 09:25:00');
    add('DDEMO002','T7',8,'Q018','PC',yesterday+' 16:10:00');
    return {schema:1,orders,goods,records,seq,events:[]};
  }
  function getGood(db,id){return db.goods.find(g=>g.id===id)}
  function getTask(g,id){return g&&g.tasks.find(t=>t.id===id)}
  function done(db,gid,tid){return db.records.filter(r=>r.goods===gid&&r.task===tid).reduce((s,r)=>s+r.qty,0)}
  function remaining(db,g,tid){return Math.max(0,g.good-done(db,g.id,tid))}
  function conflict(db,g){return g.tasks.some(t=>done(db,g.id,t.id)>g.good)}
  function state(db,g,tid){if(conflict(db,g))return '数量待核对';if(!g.tasks.length)return '无需报工';if(!g.good)return '暂无正品';if(tid){const d=done(db,g.id,tid);return d===g.good?'已报齐':d?'部分报工':'未报工'}const values=g.tasks.map(t=>done(db,g.id,t.id));return values.every(d=>d===g.good)?'已报齐':values.some(d=>d>0)?'部分报工':'未报工'}
  function validate(db,d){const g=getGood(db,d.goods),t=getTask(g,d.task);if(!g||!t)return '未找到有效商品或附加项，请重新查询。';if(conflict(db,g))return '正品数量与累计报工冲突，请联系负责人核对。';const q=Number(d.qty);if(!Number.isSafeInteger(q)||q<=0)return '请输入大于 0 的整数。';if(q>remaining(db,g,t.id))return '本项最多还能报 '+remaining(db,g,t.id)+' 件，请修改本次数量。';if(!employees.some(p=>p.id===d.person))return '请选择有效的实际处理人。';if(!d.confirmed)return '请确认本次实际处理人。';if(t.proofRequired&&!d.proof)return '拍照项目请添加本次作业凭证。';return ''}
  function submit(db,d){
    const existing=db.records.find(r=>r.requestId===d.requestId);
    if(existing)return {ok:true,duplicate:true,record:existing};
    const error=validate(db,d);if(error)return {ok:false,error};
    const g=getGood(db,d.goods);
    if(d.version!==g.version||d.done!==done(db,g.id,d.task))return {ok:false,changed:true,error:'数量已变化，请核对最新剩余后再次提交。'};
    if(!d.requestId)return {ok:false,error:'缺少本次操作标识，请重新打开报工。'};
    const record={id:'RG'+String(++db.seq).padStart(6,'0'),requestId:d.requestId,goods:g.id,task:d.task,qty:Number(d.qty),person:d.person,source:d.source||'PC',submitter:'DEMO-ADMIN',time:timestamp(),good:g.good,proof:d.proof||'',proofName:d.proofName||''};
    db.records.push(record);return {ok:true,duplicate:false,record};
  }
  function updateGood(db,id,value){const g=getGood(db,id);if(!g||!Number.isSafeInteger(value)||value<0)return false;g.previous=g.good;g.good=value;g.version++;db.events.push({goods:id,before:g.previous,after:value,time:timestamp()});return true}
  function filter(db,f={}){return db.records.filter(r=>{
    const g=getGood(db,r.goods),t=getTask(g,r.task),date=r.time.slice(0,10);
    return (!f.start||date>=f.start)&&(!f.end||date<=f.end)&&(!f.person||r.person===f.person)&&(!f.task||t.name===f.task)&&(!f.goods||r.goods.toUpperCase().includes(f.goods.toUpperCase()))&&(!f.order||g.order.toUpperCase().includes(f.order.toUpperCase()))&&(!f.source||r.source===f.source);
  }).sort((a,b)=>b.time.localeCompare(a.time)||b.id.localeCompare(a.id))}
  function summarize(db,rs){const map=new Map();for(const r of rs){const name=getTask(getGood(db,r.goods),r.task).name,key=r.time.slice(0,10)+'|'+r.person+'|'+name;let row=map.get(key);if(!row){row={date:r.time.slice(0,10),person:r.person,task:name,qty:0,count:0,goods:new Set(),last:r.time};map.set(key,row)}row.qty+=r.qty;row.count++;row.goods.add(r.goods);if(r.time>row.last)row.last=r.time}return [...map.values()].map(r=>({...r,goods:r.goods.size})).sort((a,b)=>b.date.localeCompare(a.date)||a.person.localeCompare(b.person)||a.task.localeCompare(b.task))}
  root.PCModel={names,previewNames,employees,day,timestamp,seed,getGood,getTask,done,remaining,conflict,state,validate,submit,updateGood,filter,summarize};
})(globalThis);
