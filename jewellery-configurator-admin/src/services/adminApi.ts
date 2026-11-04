import type { Product, Metal, Order } from '../types'
import { DEMO_MODE } from './api'
import { demoProducts } from './demo'
import { token, clearToken } from '../auth'

export interface MakingChargeRule {
  id: string
  name: string
  metal: Metal | 'all'
  category: string
  purity: string | 'all'
  amountPerGram: number
  status: 'active' | 'inactive'
  updatedAt: string
}

export interface MetalRate {
  metal: Metal
  ratePerGram: number
  updatedAt: string
}

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(init?.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) { if (response.status === 401 && token()) clearToken(); throw new Error(body?.error?.message || body?.message || `Request failed (${response.status})`) }
  return (body && 'data' in body ? body.data : body) as T
}

let demoRules: MakingChargeRule[] = []
let demoInventory: Product[] = []
let demoRates: MetalRate[] = [
  { metal: 'gold', ratePerGram: 6900, updatedAt: new Date().toISOString() },
  { metal: 'silver', ratePerGram: 82, updatedAt: new Date().toISOString() },
  { metal: 'platinum', ratePerGram: 3100, updatedAt: new Date().toISOString() },
]
let demoOrders: Order[] = [
  { id: 'ord-1048', orderNumber: 'MA-1048', total: 42860, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'ord-1047', orderNumber: 'MA-1047', total: 18640, createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  { id: 'ord-1046', orderNumber: 'MA-1046', total: 72950, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
]

async function seed() {
  if (!demoInventory.length) {
    demoInventory = await demoProducts()
    demoRules = demoInventory.map((p) => ({
      id: `rule-${p.id}`, name: `${p.category} · ${p.metal}`, metal: p.metal,
      category: p.category, purity: 'all', amountPerGram: p.makingChargePerGram,
      status: 'active', updatedAt: new Date().toISOString(),
    }))
  }
}

export const adminApi = {
  access: () => request<{ user: { id: number; name: string; email: string; role: string } }>('/admin/access'),
  products: async () => {
    if (DEMO_MODE) { await seed(); return [...demoInventory] }
    return request<Product[]>('/admin/products')
  },
  updateProduct: async (id: string, patch: Partial<Product>) => {
    if (DEMO_MODE) { await seed(); demoInventory = demoInventory.map(p => p.id === id ? { ...p, ...patch } : p); return demoInventory.find(p => p.id === id)! }
    return request<Product>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
  },
  createProduct: async (product: Omit<Product, 'id'>) => {
    if (DEMO_MODE) { await seed(); const created = { ...product, id: `product-${Date.now()}` }; demoInventory = [...demoInventory, created]; return created }
    return request<Product>('/admin/products', { method: 'POST', body: JSON.stringify(product) })
  },
  rates: async () => DEMO_MODE ? [...demoRates] : request<MetalRate[]>('/admin/metal-rates'),
  updateRate: async (metal: Metal, ratePerGram: number) => {
    if (DEMO_MODE) { demoRates = demoRates.map(r => r.metal === metal ? { ...r, ratePerGram, updatedAt: new Date().toISOString() } : r); return demoRates.find(r => r.metal === metal)! }
    return request<MetalRate>(`/admin/metal-rates/${metal}`, { method: 'PATCH', body: JSON.stringify({ ratePerGram }) })
  },
  rules: async () => { if (DEMO_MODE) { await seed(); return [...demoRules] } return request<MakingChargeRule[]>('/admin/making-charge-rules') },
  saveRule: async (rule: MakingChargeRule) => {
    if (DEMO_MODE) { await seed(); const exists = demoRules.some(r => r.id === rule.id); demoRules = exists ? demoRules.map(r => r.id === rule.id ? rule : r) : [...demoRules, rule]; return rule }
    return rule.id.startsWith('new-')
      ? request<MakingChargeRule>('/admin/making-charge-rules', { method: 'POST', body: JSON.stringify(rule) })
      : request<MakingChargeRule>(`/admin/making-charge-rules/${rule.id}`, { method: 'PUT', body: JSON.stringify(rule) })
  },
  orders: async () => DEMO_MODE ? [...demoOrders] : request<Order[]>('/admin/orders'),
}
