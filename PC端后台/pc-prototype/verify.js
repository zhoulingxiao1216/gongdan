/* Logic tests with a minimal DOM substitute. Not a browser or screenshot test. */
function runPCChecks(modelSource,appSource){
  const report=[];
  function check(name,condition){if(!condition)throw new Error('FAILED: '+name);report.push('通过 · '+name)}
  const root={};new Function('globalThis',modelSource)(root);const M=root.PCModel;
  let db=M.seed(),g=M.getGood(db,'DDEMO001'),initialRecords=db.records.length;
  const valid=(extra={})=>({goods:g.id,task:'T1',qty:3,person:'V026',confirmed:true,done:M.done(db,g.id,'T1'),version:g.version,requestId:'test-'+db.seq,proof:'',...extra});
  check('8件正品已报5件，剩余3件',M.remaining(db,g,'T1')===3);
  for(const n of [0,-1,1.5,4,NaN,Infinity])check('非法/超量数量被拦截：'+n,!!M.validate(db,valid({qty:n})));
  check('实际处理人必填',!!M.validate(db,valid({person:''})));
  check('未知人员被拦截',!!M.validate(db,valid({person:'NONEXIST'})));
  check('人员需确认',!!M.validate(db,valid({confirmed:false})));
  check('照片必填项目无凭证拦截',!!M.validate(db,valid({task:'T9',qty:1})));
  check('未配置项目不可提交',!!M.validate(db,valid({task:'NONEXIST'})));
  const settlement=JSON.stringify(g.settlement),d=valid();
  check('合法补报成功',M.submit(db,d).ok);
  check('重复请求返回原记录',M.submit(db,d).duplicate&&db.records.length===initialRecords+1);
  check('重复请求不重复计数',M.done(db,g.id,'T1')===8);
  check('已报齐无法继续正常报工',!!M.validate(db,valid({qty:1})));
  check('报工不改清算',JSON.stringify(g.settlement)===settlement);
  let count=db.records.length;M.updateGood(db,g.id,10);
  check('正品增加后重新开放2',M.remaining(db,g,'T1')===2);
  check('正品更新本身不产生人员产出',db.records.length===count);
  check('旧数据版本不能直接提交',M.submit(db,valid({qty:1,version:1})).changed);
  check('增量记录成功',M.submit(db,valid({qty:2})).ok&&M.done(db,g.id,'T1')===10);
  check('原始5件记录保持不变',db.records.some(r=>r.goods===g.id&&r.task==='T1'&&r.qty===5));
  const deleted=M.deleteRecord(db,'RG000001');
  check('删除附加项明细成功',deleted.ok);
  check('删除后退还附加项完成数量',M.done(db,g.id,'T1')===5);
  check('PDA来源明细不能直接删除',!M.deleteRecord(db,'PDA000006').ok);
  M.updateGood(db,g.id,4);check('正品减少冲突只拦报工',M.conflict(db,g)&&!!M.validate(db,valid({qty:1}))&&JSON.stringify(g.settlement)===settlement);
  db=M.seed();g=db.goods[0];const d1=valid({qty:2,requestId:'one'}),d2=valid({qty:2,person:'Q018',requestId:'two'});M.submit(db,d1);
  check('两人并发不能超总量',!M.submit(db,d2).ok&&M.done(db,g.id,'T1')===7);
  check('无附加项状态独立',M.state(db,M.getGood(db,'DDEMO004'))==='无需报工');
  check('无正品状态独立',M.state(db,M.getGood(db,'DDEMO003'))==='暂无正品');
  const today=M.filter(db,{start:M.day(),end:M.day()});
  check('日期过滤排除昨日',today.every(r=>r.time.startsWith(M.day())));
  check('员工过滤正确',M.filter(db,{person:'Q018'}).every(r=>r.person==='Q018'));
  check('附加项过滤正确',M.filter(db,{task:'贴纸'}).every(r=>r.task==='T1'));
  check('来源过滤正确',M.filter(db,{source:'小程序'}).every(r=>r.source==='小程序'));
  check('PDA来源可过滤',M.filter(db,{source:'PDA'}).length>0&&M.filter(db,{source:'PDA'}).every(r=>r.source==='PDA'));
  check('作业类型支持PDA入库',M.filter(db,{task:'入库'}).every(r=>r.source==='PDA'));
  check('代购订单详情记录排除PDA来源',M.filter(db,{order:'DEMO-DD-001',recordType:'vas'}).every(r=>M.isVas(r)));
  check('发货单号过滤可匹配PDA来源',M.filter(db,{order:'SHIP-DEMO-001'}).some(r=>r.source==='PDA'));
  check('发货单报工过滤仅保留发货单PDA',M.filter(db,{recordType:'pda',orderType:'发货单'}).length===4&&M.filter(db,{recordType:'pda',orderType:'发货单'}).every(r=>r.source==='PDA'&&M.shipWorks.includes(M.recordWork(db,r))));
  check('发货单报工不包含入库PDA',!M.filter(db,{recordType:'pda',orderType:'发货单'}).some(r=>M.recordWork(db,r)==='入库'));
  check('不存在商品筛选为空',M.filter(db,{goods:'NOTFOUND'}).length===0);
  const sums=M.summarize(db,today);
  check('员工分项汇总数量与流水一致',sums.reduce((s,r)=>s+r.qty,0)===today.reduce((s,r)=>s+r.qty,0));
  check('员工分项汇总笔数与流水一致',sums.reduce((s,r)=>s+r.count,0)===today.length);
  check('员工产量汇总包含订单号',sums.some(r=>r.orderNo==='DEMO-DD-001'||r.orderNo==='SHIP-DEMO-001'));

  function environment(){
    const els=new Map(),listeners={},timers=new Map(),storage=new Map();let id=0;
    const document={querySelector(s){if(!els.has(s))els.set(s,{style:{},innerHTML:'',textContent:'',value:'',disabled:false,inert:false,focus(){}});return els.get(s)},addEventListener(type,fn){listeners[type]=fn},createElement(){return {click(){}}}};
    const window={addEventListener(){},scrollTo(){}};
    const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
    const later=fn=>{timers.set(++id,fn);return id},cancel=i=>timers.delete(i);
    function flush(){for(let n=0;timers.size&&n<20;n++){const jobs=[...timers.values()];timers.clear();jobs.forEach(f=>f())}}
    const injected=appSource.replace(/render\(\);\r?\n\}\)\(\);/,"render();window.__pcTest={state:()=>S,data:()=>db,openReport,reportSubmit,render,navigate,lookup,renderOrders,renderOrder,renderStaff,renderRecords,renderShipStaff,renderShipRecords};\n})();");
    if(injected===appSource)throw Error('Cannot locate app test hook');
    new Function('PCModel','document','window','localStorage','setTimeout','clearTimeout',injected)(M,document,window,localStorage,later,cancel);
    const app=window.__pcTest;
    function click(action,data={}){const el={dataset:{action,...data},disabled:false};listeners.click({target:{closest:()=>el}})}
    function ready(q){app.openReport('DDEMO001',false);let s=app.state();s.draft.qty=String(q);s.draft.confirmed=true;s.dirty=true;return s}
    return {app,document,click,ready,flush};
  }
  let e=environment(),s=e.ready(3),uiInitial=e.app.data().records.length;e.app.reportSubmit();e.app.reportSubmit();e.flush();
  check('界面提交连点只写入一笔',e.app.data().records.length===uiInitial+1);
  check('提交后留在工作台并清空表单',s.page==='work'&&s.draft.qty===''&&!s.dirty&&!!s.lastSuccess);
  e.click('increase');check('模拟上游更新不计人员产出',e.app.data().records.length===uiInitial+1);
  s.draft.qty='2';s.draft.confirmed=true;s.dirty=true;e.app.reportSubmit();
  check('表单旧版本先要求复核',e.app.data().records.length===uiInitial+1);
  e.app.reportSubmit();e.flush();check('复核后增量可提交',M.done(e.app.data(),s.goods,s.task)===10);
  e=environment();s=e.ready(3);uiInitial=e.app.data().records.length;s.mode='fail';e.app.reportSubmit();e.flush();
  check('明确失败不写记录且保留草稿',e.app.data().records.length===uiInitial&&s.draft.qty==='3');
  e.app.reportSubmit();e.flush();check('失败重试成功一次',e.app.data().records.length===uiInitial+1);
  e=environment();s=e.ready(2);uiInitial=e.app.data().records.length;s.mode='unknown';e.app.reportSubmit();e.flush();
  check('响应丢失显示结果确认',s.dialog.type==='unknown'&&e.app.data().records.length===uiInitial+1);
  e.click('resolve-result');check('确认原结果不重复记账',!s.dialog&&e.app.data().records.length===uiInitial+1&&!s.dirty);
  e=environment();s=e.ready(1);e.click('preview');e.flush();e.click('cancel-dialog');
  check('预览返回保留表单',s.draft.qty==='1'&&s.draft.confirmed&&s.dirty);
  e.click('nav',{page:'staff'});check('有草稿离开弹确认',s.dialog.type==='confirm');
  e.click('cancel-dialog');check('继续填写保留草稿',s.page==='work'&&s.draft.qty==='1');
  e.click('nav',{page:'staff'});e.click('discard');check('确认放弃进入员工产量',s.page==='staff'&&s.draft===null&&e.app.data().records.length===uiInitial);
  check('质控员工产量只含附加项',s.visibleRows.length>0&&s.visibleRows.every(r=>M.isVas(r)));
  e.click('drill',{date:M.day(),person:'V026',task:'贴纸',order:'DEMO-DD-001'});check('汇总下钻带入人员项目日期和订单号',s.page==='records'&&s.rf.person==='V026'&&s.rf.task==='贴纸'&&s.rf.order==='DEMO-DD-001'&&s.rf.start===M.day());
  check('质控报工明细只含附加项',s.visibleRows.every(r=>M.isVas(r)));
  e.click('return-summary');check('下钻返回恢复汇总页',s.page==='staff'&&!s.summaryReturn);
  e=environment();s=e.app.state();e.app.openReport('DDEMO001',true);check('订单快捷抽屉能打开',s.drawer==='report'&&s.loaded);
  e.click('report-tab',{value:'records'});check('抽屉记录页签可渲染',s.tab==='records');
  e.click('report-tab',{value:'report'});uiInitial=e.app.data().records.length;s.draft.qty='1';s.draft.confirmed=true;s.dirty=true;e.app.reportSubmit();e.flush();
  check('抽屉报工成功',e.app.data().records.length===uiInitial+1&&s.drawer==='report');
  e.click('close-drawer');e.app.openReport('DDEMO001',false);check('工作台读取抽屉最新累计',M.done(e.app.data(),'DDEMO001','T1')===6&&s.draft.done===6);
  for(const task of ['T1','T2','T3','T4']){e.click('select-task',{id:task});e.click('preview');e.flush();check(task+'预览内容可生成',s.dialog.type==='preview'&&s.previewState==='ready');e.click('cancel-dialog')}
  s.mode='preview-error';e.click('preview');e.flush();check('预览失败态',s.previewState==='error');e.click('retry-preview');e.flush();check('预览重试成功',s.previewState==='ready');e.click('cancel-dialog');
  s.mode='preview-missing';e.click('preview');e.flush();check('预览文件未生成态',s.previewState==='missing');e.click('cancel-dialog');
  e.app.navigate('work');e.app.lookup('VAS/DDEMO003');e.flush();check('VAS码查询暂无正品商品',s.goods==='DDEMO003'&&s.loaded);
  e.app.openReport('DDEMO004',false);check('无附加项页面可生成',M.getGood(e.app.data(),s.goods).tasks.length===0);
  e.click('nav',{page:'shipStaff'});check('发货单报工产量入口可生成',s.page==='shipStaff'&&s.visibleRows.length===4&&s.visibleRows.every(r=>r.source==='PDA'&&M.recordOrderType(e.app.data(),r)==='发货单'));
  e.click('drill',{date:M.day(),person:'V026',task:'配货',order:'SHIP-DEMO-001'});check('发货单产量下钻进入发货单明细',s.page==='shipRecords'&&s.rf.order==='SHIP-DEMO-001'&&s.visibleRows.every(r=>r.source==='PDA'&&M.recordOrderType(e.app.data(),r)==='发货单'));
  e.click('return-summary');check('发货单下钻返回产量页',s.page==='shipStaff'&&!s.summaryReturn);
  e.click('nav',{page:'records'});check('侧边栏进入质控明细会清除发货单范围',s.page==='records'&&s.visibleRows.every(r=>M.isVas(r)));
  for(const page of ['orders','order','work','staff','records','shipStaff','shipRecords']){e.app.navigate(page);check(page+'页面生成无异常',s.page===page)}
  e.click('config',{id:'DDEMO001'});check('清算配置抽屉只读可生成',s.drawer==='config');e.click('close-drawer');
  e.click('arrival',{id:'DDEMO001'});check('到货记录弹窗可生成',s.dialog.type==='arrival');e.click('cancel-dialog');
  e.click('record-detail',{id:e.app.data().records[0].id});check('报工详情弹窗可生成',s.dialog.type==='record');
  const beforeDelete=M.done(e.app.data(),'DDEMO001','T1');e.click('delete-record',{id:'RG000001'});check('删除确认弹窗可生成',s.dialog.type==='deleteRecord');e.click('confirm-delete-record',{id:'RG000001'});check('界面删除明细后回退累计',M.done(e.app.data(),'DDEMO001','T1')===beforeDelete-5);
  e.click('order-records',{id:'DEMO-DD-001'});check('订单报工记录入口只看附加项',s.page==='records'&&s.rf.recordType==='vas');
  return report;
}
