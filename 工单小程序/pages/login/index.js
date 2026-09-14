const session = require('../../services/session')
Page({
  data: { employees: session.employees, selected: 'demo-a', loading: false, error: '' },
  onShow() {
    this.setData({ loading: false })
    if (session.get()) this.enter()
  },
  select(e) { if (!this.data.loading) this.setData({ selected: e.currentTarget.dataset.id, error: '' }) },
  login() {
    if (this.data.loading) return
    this.setData({ loading: true, error: '' })
    try { session.login(this.data.selected); this.enter() }
    catch (e) { this.setData({ loading: false, error: e.message }) }
  },
  enter() {
    wx.reLaunch({
      url: '/pages/workbench/index',
      fail: () => { session.logout(); this.setData({ loading: false, error: '进入工作台失败，请重试。' }) }
    })
  },
  help() { wx.showModal({ title: '正式账号登录', content: '正式员工登录尚未开放，请联系项目管理员配置企业账号与登录服务。当前可选择演示身份体验报工，请勿输入真实账号或密码。', showCancel: false }) }
})
