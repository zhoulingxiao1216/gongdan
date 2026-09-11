/* Non-browser logic harness. This checks state transitions with a minimal DOM
   substitute; it deliberately does not claim layout or browser click coverage. */
function runPrototypeChecks(source) {
  const nodes = new Map();
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {
        style: {}, innerHTML: '', textContent: '', value: '', disabled: false,
        scrollTop: 0, addEventListener() {}, focus() {}
      });
      return nodes.get(selector);
    },
    querySelectorAll() { return []; }
  };
  const data = new Map(), pending = new Map();
  let nextTimer = 0;
  const storage = { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v) };
  function later(fn) { pending.set(++nextTimer, fn); return nextTimer; }
  function cancel(id) { pending.delete(id); }
  function flush() {
    const jobs = [...pending.values()]; pending.clear();
    jobs.forEach(fn => fn());
  }
  const checks = `
    const checks = runTests();
    const assert = (name, condition) => { if (!condition) throw new Error(name); checks.push('通过 · '+name); };
    function fresh(){db=seed();gid='DDEMO001';taskName='贴纸';dirty=false;busy=false;draft=null;page='home';requestMode='normal';lastRecord=null;render();}
    function ready(n){startReport('贴纸');draft.qty=String(n);draft.confirmed=true;dirty=true;validateLive();}
    fresh();ready(2);submit();submit();flush();
    assert('连续两次提交只新增一笔', db.records.length===3 && task().done===7 && page==='success');
    increase();startReport('贴纸');draft.qty='2';draft.confirmed=true;submit();flush();
    assert('正品增加后完整增量提交链路', good().good===9 && task().done===9 && db.records.length===4);
    assert('增量不覆盖原始5件记录', db.records.some(r=>r.id==='DEMO-R001' && r.qty===5 && r.good===7));
    fresh();ready(2);requestMode='network';submit();flush();
    assert('失败保留草稿且不写记录',page==='form' && draft.qty==='2' && db.records.length===2 && task().done===5);
    submit();flush();assert('失败重试只写一次',db.records.length===3 && task().done===7);
    fresh();ready(1);good().version++;good().good=9;submit();
    assert('上游版本变更先要求复核',page==='form' && db.records.length===2 && draft.version===2);
    submit();flush();assert('版本复核后可提交',page==='success' && task().done===6);
    fresh();ready(2);document.querySelector('#concurrent').onclick();submit();
    assert('并发后超出剩余拒绝入账',page==='form' && task().done===6 && db.records.length===3);
    draft.qty='1';submit();submit();flush();assert('并发重新核对后仅提交剩余',task().done===7 && db.records.length===4);
    fresh();ready(2);openPreview('贴纸','form');flush();back();
    assert('预览返回保留已填数量和人员',page==='form' && draft.qty==='2' && draft.confirmed);
    for(const name of PREVIEW){dirty=false;openPreview(name,'goods');flush();assert(name+'预览页面可渲染',page==='preview' && previewState==='normal');back();}
    requestMode='preview';openPreview('贴纸','goods');flush();assert('预览错误态可渲染',previewState==='error');
    requestMode='missing';openPreview('贴纸','goods');flush();assert('预览未生成态可渲染',previewState==='missing');
    fresh();page='scan';render();lookup('VAS/DDEMO002');flush();
    assert('无附加项商品匹配后可渲染',page==='goods' && good().tasks.length===0);
    page='scan';render();lookup('DDEMO003');flush();assert('无正品商品匹配后可渲染',good().good===0);
    page='scan';render();lookup('DNOTFOUND');flush();assert('不存在商品保持扫码页',page==='scan');
    fresh();ready(1);go('goods');document.querySelector('[data-modal="0"]').onclick();
    assert('取消退出保留填写',page==='form' && draft.qty==='1');
    go('goods');document.querySelector('[data-modal="1"]').onclick();
    assert('确认放弃只清除草稿',page==='goods' && draft===null && db.records.length===2);
    fresh();for(const p of ['home','scan','goods','records','reserved']){page=p;render();assert(p+'页面渲染无异常',true);}
    lastRecord=db.records[0];page='detail';render();assert('报工详情页面渲染无异常',true);
    return checks;
  `;
  return new Function('document','localStorage','sessionStorage','window','setTimeout','clearTimeout','flush',
    source+'\n'+checks)(document,storage,storage,{addEventListener(){}},later,cancel,flush);
}
