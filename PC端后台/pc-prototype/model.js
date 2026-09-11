/* Business rules shared by the desktop workbench and order drawer. */
(function(root){
  'use strict';
  const names=['贴纸','吊牌','洗标','FBA','内侧检品','开封作业','剪标','换包装','拍照'];
  const pdaWorks=['入库','配货','打包','箱规完成','发货确认'];
  const shipWorks=['配货','打包','箱规完成','发货确认'];
  const workNames=[...names,...pdaWorks];
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
    function add(goodsId,task,qty,person,source,time){const orderNo=goodsId?getGood({goods},goodsId)?.order:'';records.push({id:'RG'+String(++seq).padStart(6,'0'),type:'vas',goods:goodsId,task,qty,unit:'件',person,source,time,submitter:'DEMO-ADMIN',good:8,proof:'',proofName:'',requestId:'seed-'+seq,orderNo,orderType:'代购订单'})}
    function addPda(goods,workName,qty,unit,person,orderNo,orderType,time,objectNo,endpoint){records.push({id:'PDA'+String(++seq).padStart(6,'0'),type:'pda',goods,task:'PDA_'+seq,workName,qty,unit,person,source:'PDA',time,submitter:'PDA-ADMIN',good:null,proof:'',proofName:'',requestId:'pda-seed-'+seq,orderNo,orderType,objectNo,endpoint})}
    add('DDEMO001','T1',5,'V026','小程序',date+' 09:10:00');
    add('DDEMO001','T3',8,'Q018','PC',date+' 09:15:00');
    add('DDEMO001','T5',8,'V026','PC',date+' 09:20:00');
    add('DDEMO002','T1',3,'A102','小程序',date+' 09:25:00');
    add('DDEMO002','T7',8,'Q018','PC',yesterday+' 16:10:00');
    addPda('DDEMO001','入库',8,'件','A102',orders[0].id,'代购订单',date+' 10:05:00','库位 A-01','/admin_pda/kuStockInLog/putInStock');
    addPda('DDEMO001','配货',6,'件','V026','SHIP-DEMO-001','发货单',date+' 11:20:00','发货明细 DDEMO001','/admin_pda/shipOrderDistribute/distribute');
    addPda('DDEMO001','打包',6,'件','Q018','SHIP-DEMO-001','发货单',date+' 11:45:00','发货箱 BX-DEMO-001','/admin_pda/shipOrderPack/boxDone');
    addPda('DDEMO001','箱规完成',1,'箱','Q018','SHIP-DEMO-001','发货单',date+' 11:52:00','BX-DEMO-001','/admin_pda/shipOrderPack/writeBoxInfo');
    addPda('', '发货确认',1,'单','A102','SHIP-DEMO-001','发货单',date+' 12:10:00','SHIP-DEMO-001','/admin_pda/shipOrderShip/sureShip');
    return {schema:3,orders,goods,records,seq,events:[]};
  }
  function getGood(db,id){return db.goods.find(g=>g.id===id)}
  function getTask(g,id){return g&&g.tasks.find(t=>t.id===id)}
  function isVas(r){return !r.type||r.type==='vas'}
  function recordWork(db,r){const g=getGood(db,r.goods),t=getTask(g,r.task);return r.workName||t?.name||r.task||'未知作业'}
  function recordUnit(r){return r.unit||'件'}
  function recordOrderNo(db,r){if(r.orderNo)return r.orderNo;const g=getGood(db,r.goods);return g?.order||''}
  function recordOrderType(db,r){return r.orderType||'代购订单'}
  function done(db,gid,tid){return db.records.filter(r=>isVas(r)&&r.goods===gid&&r.task===tid).reduce((s,r)=>s+r.qty,0)}
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
    const record={id:'RG'+String(++db.seq).padStart(6,'0'),type:'vas',requestId:d.requestId,goods:g.id,task:d.task,qty:Number(d.qty),unit:'件',person:d.person,source:d.source||'PC',submitter:'DEMO-ADMIN',time:timestamp(),good:g.good,proof:d.proof||'',proofName:d.proofName||'',orderNo:g.order,orderType:'代购订单'};
    db.records.push(record);return {ok:true,duplicate:false,record};
  }
  function deleteRecord(db,id){const index=db.records.findIndex(r=>r.id===id);if(index<0)return {ok:false,error:'未找到报工明细。'};const record=db.records[index];if(!isVas(record))return {ok:false,error:'PDA 来源记录请在来源业务系统冲销，不能在报工明细中直接删除。'};db.records.splice(index,1);return {ok:true,record}}
  function updateGood(db,id,value){const g=getGood(db,id);if(!g||!Number.isSafeInteger(value)||value<0)return false;g.previous=g.good;g.good=value;g.version++;db.events.push({goods:id,before:g.previous,after:value,time:timestamp()});return true}
  function filter(db,f={}){return db.records.filter(r=>{
    const g=getGood(db,r.goods),date=r.time.slice(0,10),objectText=[r.goods,r.objectNo].filter(Boolean).join(' ').toUpperCase(),orderText=[recordOrderNo(db,r),g?.order].filter(Boolean).join(' ').toUpperCase();
    return (!f.start||date>=f.start)&&(!f.end||date<=f.end)&&(!f.person||r.person===f.person)&&(!f.task||recordWork(db,r)===f.task)&&(!f.goods||objectText.includes(f.goods.toUpperCase()))&&(!f.order||orderText.includes(f.order.toUpperCase()))&&(!f.source||r.source===f.source)&&(!f.recordType||r.type===f.recordType)&&(!f.orderType||recordOrderType(db,r)===f.orderType);
  }).sort((a,b)=>b.time.localeCompare(a.time)||b.id.localeCompare(a.id))}
  function summarize(db,rs){const map=new Map();for(const r of rs){const name=recordWork(db,r),unit=recordUnit(r),orderNo=recordOrderNo(db,r),orderType=recordOrderType(db,r),key=r.time.slice(0,10)+'|'+r.person+'|'+name+'|'+unit+'|'+orderNo;let row=map.get(key);if(!row){row={date:r.time.slice(0,10),person:r.person,task:name,unit,orderNo,orderType,qty:0,count:0,goods:new Set(),sources:new Set(),last:r.time};map.set(key,row)}row.qty+=r.qty;row.count++;if(r.goods)row.goods.add(r.goods);else if(r.objectNo)row.goods.add(r.objectNo);row.sources.add(r.source);if(r.time>row.last)row.last=r.time}return [...map.values()].map(r=>({...r,goods:r.goods.size,sources:[...r.sources].join('、')})).sort((a,b)=>b.date.localeCompare(a.date)||a.person.localeCompare(b.person)||a.task.localeCompare(b.task)||a.orderNo.localeCompare(b.orderNo))}
  root.PCModel={names,pdaWorks,shipWorks,workNames,previewNames,employees,day,timestamp,seed,getGood,getTask,isVas,recordWork,recordUnit,recordOrderNo,recordOrderType,done,remaining,conflict,state,validate,submit,deleteRecord,updateGood,filter,summarize};
})(globalThis);
