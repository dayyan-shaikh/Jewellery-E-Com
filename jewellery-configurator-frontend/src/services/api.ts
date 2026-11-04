import type { CartItem, Order, Product, Quote, Variant } from '../types'
import { clearToken, token } from '../auth'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')
export const DEMO_MODE = import.meta.env.VITE_USE_DEMO_DATA !== 'false'
const SESSION_KEY = 'maison-session-id'
function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY)
  // Migrate the old shared guest cart once. New sessions are isolated per tab;
  // signed-in customer IDs are also kept separately in localStorage by account.
  if (!id) {
    id = localStorage.getItem(SESSION_KEY) || `maison_${crypto.randomUUID().replace(/-/g, '')}`
    sessionStorage.setItem(SESSION_KEY, id)
    localStorage.removeItem(SESSION_KEY)
  }
  return id
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId(), ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(init?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) { if (response.status === 401 && token()) clearToken(); throw new Error(payload?.message || payload?.error?.message || `Request failed (${response.status})`) }
  return (payload && 'data' in payload ? payload.data : payload) as T
}

type ProductRow = { id: number | string; name: string; description?: string; metal_type: string; wastage_percentage: number | string; making_charge_per_gram: number | string; variant_id: number | string | null; sku?: string; purity?: string; weight_grams?: number | string; stone_charge?: number | string; stock_quantity?: number }
const productImages = [
  'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1000&q=85',
]
function normalizeProducts(rows: ProductRow[]): Product[] {
  const grouped = new Map<string, Product>()
  rows.forEach((row, index) => {
    const id = String(row.id)
    let product = grouped.get(id)
    if (!product) {
      product = { id, name: row.name, subtitle: '', description: row.description || '', category: '', metal: row.metal_type.toLowerCase() as Product['metal'], purities: [], defaultPurity: '', weightOptions: [], defaultWeight: 0, wastagePercent: Number(row.wastage_percentage), makingChargePerGram: Number(row.making_charge_per_gram), stoneCost: 0, stock: 0, imageUrl: productImages[index % productImages.length], variants: [] }
      grouped.set(id, product)
    }
    if (row.variant_id != null) {
      const variant: Variant = { id: String(row.variant_id), sku: row.sku || '', purity: row.purity || '', weightGrams: Number(row.weight_grams), stoneCharge: Number(row.stone_charge || 0), stock: Number(row.stock_quantity || 0) }
      product.variants.push(variant)
      if (!product.purities.includes(variant.purity)) product.purities.push(variant.purity)
      if (!product.weightOptions.includes(variant.weightGrams)) product.weightOptions.push(variant.weightGrams)
      product.stock += variant.stock
    }
    product.defaultPurity ||= row.purity || ''
    product.defaultWeight ||= Number(row.weight_grams || 0)
  })
  return [...grouped.values()]
}
type PriceResponse = { product: { id: number; variant_id: number; purity: string; weight_grams: string; stock_quantity: number; metal_type: string }; price_breakdown: { rate_per_gram: string; metal_cost: string; wastage_amount: string; making_charge: string; stone_charge: string; subtotal: string; gst_amount: string; total_price: string; currency: string } }
function normalizeQuote(raw: PriceResponse, id = '', expiresAt = ''): Quote {
  const p = raw.price_breakdown
  return { id, productId: String(raw.product.id), variantId: String(raw.product.variant_id), purity: raw.product.purity, weightGrams: Number(raw.product.weight_grams), currency: p.currency, metalRatePerGram: Number(p.rate_per_gram), metalValue: Number(p.metal_cost), wastage: Number(p.wastage_amount), makingCharges: Number(p.making_charge), stoneCost: Number(p.stone_charge), subtotal: Number(p.subtotal), gst: Number(p.gst_amount), total: Number(p.total_price), createdAt: new Date().toISOString(), expiresAt }
}
type LockResponse = { lock: { id: number; expires_at: string; total_price: string }; product: PriceResponse['product']; price_breakdown: PriceResponse['price_breakdown'] }
type CartResponse = { items: Array<{ id: number; productVariantId: number; priceLockId: number; productName: string; metalType: string; purity: string; weightGrams: string; quantity: number; lockedUnitPrice: string; currentUnitPrice: string; payableUnitPrice: string; priceStatus: string; priceLockExpiresAt: string; priceLockExpired: boolean; stockQuantity: number; lockRatePerGram: string; lockMetalCost: string; lockWastageAmount: string; lockMakingCharge: string; lockStoneCharge: string; lockSubtotal: string; lockGstAmount: string }> }

export const api = {
  products: async () => normalizeProducts((await request<{ products: ProductRow[] }>('/products')).products || []),
  product: async (id: string) => {
    const raw = (await request<{ product: ProductRow & { variants: Array<{ id: number; sku: string; purity: string; weight_grams: string; stone_charge: string; stock_quantity: number }> } }>(`/products/${id}`)).product
    const p = raw
    return normalizeProducts(p.variants.map(v => ({ ...p, variant_id: v.id, sku: v.sku, purity: v.purity, weight_grams: v.weight_grams, stone_charge: v.stone_charge, stock_quantity: v.stock_quantity })))[0]
  },
  calculate: async (variantId: string) => normalizeQuote(await request<PriceResponse>('/pricing/calculate', { method: 'POST', body: JSON.stringify({ variantId: Number(variantId) }) })),
  createLock: async (variantId: string) => {
    const raw = await request<LockResponse>('/price-locks', { method: 'POST', body: JSON.stringify({ variantId: Number(variantId) }) })
    return normalizeQuote(raw, String(raw.lock.id), raw.lock.expires_at)
  },
  cart: async (products: Product[]): Promise<CartItem[]> => {
    let raw: CartResponse
    try { raw = await request<CartResponse>('/cart/') } catch (error) { if (error instanceof Error && error.message === 'Cart not found') return []; throw error }
    return Promise.all((raw.items || []).map(async item => {
      const product = products.find(p => p.variants.some(v => v.id === String(item.productVariantId))) || await api.product(String(products.find(p => p.variants.some(v => v.id === String(item.productVariantId)))?.id || ''))
      const variant = product.variants.find(v => v.id === String(item.productVariantId))
      const calculated = await api.calculate(String(item.productVariantId))
      const payable = item.priceStatus === 'PRICE_DECREASED' || item.priceStatus === 'PRICE_INCREASED_PENDING' ? Number(item.currentUnitPrice) : Number(item.lockedUnitPrice)
      const useProtectedSnapshot = Number(item.currentUnitPrice) > Number(item.lockedUnitPrice) && item.priceStatus !== 'PRICE_INCREASED_PENDING'
      const quote = { ...calculated, id: String(item.priceLockId), total: payable, expiresAt: item.priceLockExpiresAt,
        ...(useProtectedSnapshot ? { metalRatePerGram: Number(item.lockRatePerGram), metalValue: Number(item.lockMetalCost), wastage: Number(item.lockWastageAmount), makingCharges: Number(item.lockMakingCharge), stoneCost: Number(item.lockStoneCharge), subtotal: Number(item.lockSubtotal), gst: Number(item.lockGstAmount) } : {}) }
      const status = item.priceStatus === 'PRICE_INCREASED_PENDING' ? 'AWAITING_CONFIRMATION' : item.priceStatus === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'CONFIRMED'
      const delta = Number(item.currentUnitPrice) - Number(item.lockedUnitPrice)
      return { id: String(item.id), product: { ...product, stock: item.stockQuantity ?? variant?.stock ?? product.stock }, quantity: item.quantity, quote, status, previousTotal: delta !== 0 ? Number(item.lockedUnitPrice) : undefined, priceDelta: delta, stockAvailable: item.stockQuantity ?? variant?.stock ?? product.stock, priceChange: delta > 0 ? 'INCREASED' : delta < 0 ? 'DECREASED' : 'UNCHANGED' }
    }))
  },
  addCartItem: (lockId: string, quantity = 1) => request('/cart/items', { method: 'POST', body: JSON.stringify({ lockId: Number(lockId), quantity }) }),
  removeCartItem: (id: string) => request<void>(`/cart/items/${id}`, { method: 'DELETE' }),
  updateQuantity: (id: string, quantity: number) => request(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  confirmPrice: (id: string) => request(`/cart/items/${id}/confirm-price`, { method: 'POST' }),
  refreshLock: async (id: string) => {
    const raw = await request<LockResponse>(`/price-locks/${id}/refresh`, { method: 'POST' })
    return normalizeQuote(raw, String(raw.lock.id), raw.lock.expires_at)
  },
  checkout: async (idempotencyKey: string) => normalizeOrder(await request<Record<string, unknown>>('/checkout/', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } })),
}

export function normalizeOrder(raw: Record<string, unknown>): Order {
  const items = Array.isArray(raw.items) ? raw.items as Array<Record<string, unknown>> : []
  return { id: String(raw.id ?? ''), orderNumber: String(raw.id ?? ''), status: String(raw.status ?? 'PLACED'), total: Number(raw.total_amount ?? raw.total ?? 0), createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()), items: items.map(item => ({ productName: String(item.product_name ?? ''), quantity: Number(item.quantity ?? 0), total: Number(item.total_price ?? 0) })) }
}
export const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
