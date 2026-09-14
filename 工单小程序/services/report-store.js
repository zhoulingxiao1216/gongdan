const KEY = 'work-report-demo-v1'
const goods = [
{id:'DDEMO001',name:'纯棉圆领短袖',good:10,items:['贴纸','吊牌','洗标','FBA','换包装']},
{id:'DDEMO002',name:'帆布手提袋',good:8,items:[]},
{id:'DDEMO003',name:'针织开衫',good:0,items:['吊牌']}
]
function read(){const s=wx.getStorageSync(KEY);if(!s)return {records:[],increments:{}};if(!Array.isArray(s.records)||!s.increments)throw Error('演示数据读取异常，请保留数据联系开发人员。');return s}
function records(){return read().records.slice().reverse()}
function product(code){const p=goods.find(g=>g.id===String(code||'').trim().toUpperCase());if(!p)return null;const s=read(),good=p.good+(s.increments[p.id]||0);return {...p,good,items:p.items.map((name,id)=>{const reported=s.records.filter(r=>r.productId===p.id&&r.itemId===id).reduce((n,r)=>n+r.quantity,0);return {id,name,reported,remaining:Math.max(0,good-reported),status:reported===0?'未报工':reported>=good?'已报齐':'部分报工',input:'',preview:name!=='换包装'}})}}
function submit(p){const s=read(),old=s.records.find(r=>r.requestId===p.requestId);if(old){if(['productId','itemId','quantity','employee'].some(k=>old[k]!==p[k]))throw Error('重复请求内容不一致');return old}const g=product(p.productId),item=g&&g.items.find(i=>i.id===p.itemId);if(!p.requestId||!p.employee||!item)throw Error('报工信息不完整');if(!Number.isSafeInteger(p.quantity)||p.quantity<=0||p.quantity>item.remaining)throw Error('请输入不超过剩余未报数量的正整数');const d=new Date(),pad=n=>String(n).padStart(2,'0'),date=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());const row={...p,id:p.requestId,itemName:item.name,productName:g.name,date,time:date+' '+pad(d.getHours())+':'+pad(d.getMinutes())};s.records.push(row);wx.setStorageSync(KEY,s);return row}
function increase(id){if(!goods.some(g=>g.id===id))throw Error('商品不存在');const s=read();s.increments[id]=(s.increments[id]||0)+2;wx.setStorageSync(KEY,s)}
function summary(rows){const map={};rows.forEach(r=>{const k=[r.date,r.employee,r.itemName].join('|');if(!map[k])map[k]={date:r.date,employee:r.employee,itemName:r.itemName,quantity:0};map[k].quantity+=r.quantity});return Object.keys(map).map(k=>map[k])}
module.exports={records,product,submit,increase,summary}
