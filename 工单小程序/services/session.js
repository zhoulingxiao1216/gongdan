// 演示身份仅驻留内存，不代表服务端认证。
const employees = [{ id: 'demo-a', name: '演示员工 A', code: 'DEMO001' }, { id: 'demo-b', name: '演示员工 B', code: 'DEMO002' }]
let current = null
function login(id) {
  const employee = employees.find(item => item.id === id)
  if (!employee) throw new Error('请选择有效的演示身份')
  current = { ...employee, mode: 'demo' }
  return get()
}
function get() { return current ? { ...current } : null }
function logout() { current = null }
module.exports = { employees, login, get, logout }
