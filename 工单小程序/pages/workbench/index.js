const store=require('../../services/report-store')
const session=require('../../services/session')
Page({
data:{tab:'home',code:'',product:null,records:[],summary:[],count:0,total:0,error:'',submitting:false,employees:['演示员工 A','演示员工 B'],employee:0,filterLabel:''},
onShow(){const user=session.get();if(!user){wx.reLaunch({url:'/pages/login/index'});return}this.setData({loginName:user.name,employee:this.data.employees.indexOf(user.name)});this.refresh()},
logout(){wx.showModal({title:'退出演示登录',content:'退出后保留当前设备的演示报工记录。',success:res=>{if(res.confirm){session.logout();wx.reLaunch({url:'/pages/login/index'})}}})},
refresh(){try{const records=store.records();this.setData({records,summary:store.summary(records),count:records.length,total:records.reduce((n,r)=>n+r.quantity,0)});if(this.data.product)this.setData({product:store.product(this.data.product.id)})}catch(e){this.setData({error:e.message})}},
changeTab(e){this.setData({tab:e.currentTarget.dataset.tab,error:'',filterLabel:''});this.refresh()},
inputCode(e){this.setData({code:e.detail.value})},
chooseEmployee(e){this.setData({employee:Number(e.detail.value)})},
demo(e){this.setData({code:e.currentTarget.dataset.code});this.search()},
search(){try{const product=store.product(this.data.code);this.setData({product,error:product?'':'未找到商品，请尝试 DDEMO001、DDEMO002 或 DDEMO003。',tab:'home'})}catch(e){this.setData({error:e.message})}},
scan(){wx.scanCode({success:res=>{this.setData({code:res.result});this.search()},fail:err=>{if(!/cancel/.test(err.errMsg||''))this.setData({error:'扫码失败，请重试或手动输入商品 ID。'})}})},
quantity(e){this.setData({'product.items':this.data.product.items.map(i=>i.id===Number(e.currentTarget.dataset.id)?{...i,input:e.detail.value}:i)})},
submit(e){if(!session.get()){wx.reLaunch({url:'/pages/login/index'});return}if(this.data.submitting)return;const item=this.data.product.items.find(i=>i.id===Number(e.currentTarget.dataset.id)),quantity=Number(item.input);if(!Number.isSafeInteger(quantity)||quantity<=0||quantity>item.remaining){this.setData({error:'请输入大于 0 且不超过剩余未报数量的整数。'});return}
const p={requestId:Date.now()+'-'+Math.random().toString(36).slice(2),productId:this.data.product.id,itemId:item.id,quantity,submitterId:session.get().id,submitterName:session.get().name,employee:this.data.employees[this.data.employee]};this.setData({submitting:true,error:''});wx.showModal({title:'确认演示报工',content:p.employee+' · '+item.name+' · '+quantity+' 件。仅保存到当前设备。',success:res=>{if(!res.confirm)return;try{store.submit(p);this.refresh();wx.showToast({title:'演示记录已保存'})}catch(err){this.setData({error:err.message})}},complete:()=>this.setData({submitting:false})})},
preview(e){wx.showModal({title:e.currentTarget.dataset.name+'预览',content:'此演示商品尚未接入预览文件。提供后台文件后，将在这里显示对应内容。',showCancel:false})},
adjust(){try{store.increase(this.data.product.id);this.refresh();wx.showToast({title:'正品已增加 2',icon:'none'})}catch(e){this.setData({error:e.message})}},
filterSummary(e){const s=this.data.summary[e.currentTarget.dataset.index];this.setData({tab:'records',filterLabel:s.date+' · '+s.employee+' · '+s.itemName,records:store.records().filter(r=>r.date===s.date&&r.employee===s.employee&&r.itemName===s.itemName)})},
allRecords(){this.setData({filterLabel:''});this.refresh()}
})
