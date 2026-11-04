import type { CartItem, Order, Product, Quote, QuoteChange } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')
export const DEMO_MODE = import.meta.env.VITE_USE_DEMO_DATA !== 'false'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`
    throw new Error(message)
  }
  return (payload && 'data' in payload ? payload.data : payload) as T
}

export const api = {
  products: () => request<Product[]>('/products'),
  product: (id: string) => request<Product>(`/products/${id}`),
  createQuote: (productId: string, purity: string, weightGrams: number) =>
    request<Quote>('/pricing/quote', { method: 'POST', body: JSON.stringify({ productId, purity, weightGrams }) }),
  refreshQuote: (quoteId: string) =>
    request<{ quote?: Quote; change: QuoteChange; previousTotal?: number }>(`/pricing/quotes/${quoteId}/refresh`, { method: 'POST' }),
  cart: () => request<CartItem[]>('/cart'),
  addCartItem: (productId: string, quoteId: string, quantity = 1) =>
    request<CartItem>('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quoteId, quantity }) }),
  removeCartItem: (itemId: string) =>
    request<void>(`/cart/items/${itemId}`, { method: 'DELETE' }),
  refreshCartItem: (itemId: string) =>
    request<CartItem>(`/cart/items/${itemId}/refresh-price`, { method: 'POST' }),
  acceptCartPrice: (itemId: string, quoteId: string) =>
    request<CartItem>(`/cart/items/${itemId}/accept-price`, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  checkout: (idempotencyKey: string) =>
    request<Order>('/orders/checkout', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
}

export const money = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
