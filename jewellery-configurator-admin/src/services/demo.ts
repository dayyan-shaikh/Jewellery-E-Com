import type { CartItem, Product, Quote, Order } from '../types'

const now = () => new Date()
const expiry = (minutes = 10) => new Date(now().getTime() + minutes * 60_000).toISOString()
const products: Product[] = [
  {
    id: 'solenne-ring', name: 'The Solenne Ring', subtitle: 'A quiet kind of radiance',
    description: 'A softly sculpted band with a considered silhouette. Made to become part of your everyday ritual.',
    category: 'Rings', metal: 'gold', purities: ['18K', '22K'], defaultPurity: '18K',
    weightOptions: [3.5, 4, 4.5, 5], defaultWeight: 4, wastagePercent: 5, makingChargePerGram: 850,
    stoneCost: 0, stock: 3, tag: 'Bestseller',
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'celeste-earrings', name: 'Celeste Diamond Studs', subtitle: 'Light, held in its finest form',
    description: 'A luminous pair of diamond studs set in warm gold. Understated brilliance for every hour.',
    category: 'Earrings', metal: 'gold', purities: ['18K', '22K'], defaultPurity: '18K',
    weightOptions: [2.5, 3, 3.5, 4], defaultWeight: 3, wastagePercent: 4, makingChargePerGram: 1100,
    stoneCost: 12500, stock: 2, tag: 'With diamonds',
    imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'atelier-band', name: 'The Atelier Band', subtitle: 'Pure form. Lasting meaning.',
    description: 'A clean-lined platinum band, finished with a subtle satin sheen and a comfortable profile.',
    category: 'Bands', metal: 'platinum', purities: ['950'], defaultPurity: '950',
    weightOptions: [5, 5.5, 6, 6.5], defaultWeight: 6, wastagePercent: 3, makingChargePerGram: 1250,
    stoneCost: 0, stock: 1, tag: 'Only one available',
    imageUrl: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1000&q=85',
  },
]
const rates = { gold: 6900, silver: 82, platinum: 3100 }
const factors: Record<string, number> = { '18K': 0.75, '22K': 0.9167, '950': 0.95, '925': 0.925 }
let cart: CartItem[] = []

export function demoProducts() { return Promise.resolve(products) }
export function demoProduct(id: string) { return Promise.resolve(products.find(p => p.id === id) || products[0]) }
export function demoQuote(productId: string, purity: string, weightGrams: number): Promise<Quote> {
  const p = products.find(x => x.id === productId) || products[0]
  const rate = rates[p.metal]
  const metalValue = rate * weightGrams * (factors[purity] || 1)
  const wastage = metalValue * p.wastagePercent / 100
  const makingCharges = p.makingChargePerGram * weightGrams
  const subtotal = metalValue + wastage + makingCharges + p.stoneCost
  const gst = subtotal * 0.03
  return Promise.resolve({
    id: `demo-${crypto.randomUUID()}`, productId, purity, weightGrams, currency: 'INR',
    metalRatePerGram: rate, metalValue, wastage, makingCharges, stoneCost: p.stoneCost,
    subtotal, gst, total: subtotal + gst, createdAt: now().toISOString(), expiresAt: expiry(),
  })
}
export async function demoAdd(productId: string, quote: Quote) {
  const p = products.find(x => x.id === productId) || products[0]
  const existing = cart.find(x => x.product.id === productId && x.quote.purity === quote.purity && x.quote.weightGrams === quote.weightGrams)
  if (existing) { existing.quantity += 1; return existing }
  const item: CartItem = { id: crypto.randomUUID(), product: p, quantity: 1, quote, status: 'CONFIRMED' }
  cart = [...cart, item]
  return item
}
export function demoCart() { return Promise.resolve([...cart]) }
export function demoRemove(id: string) { cart = cart.filter(x => x.id !== id); return Promise.resolve() }
export async function demoRefresh(itemId: string) {
  const item = cart.find(x => x.id === itemId)
  if (!item) throw new Error('Cart item not found')
  const next = await demoQuote(item.product.id, item.quote.purity, item.quote.weightGrams)
  // Deterministic demonstration of an increase on refresh.
  next.metalRatePerGram += 35
  next.metalValue = next.metalRatePerGram * next.weightGrams * (factors[next.purity] || 1)
  next.wastage = next.metalValue * item.product.wastagePercent / 100
  next.subtotal = next.metalValue + next.wastage + next.makingCharges + next.stoneCost
  next.gst = next.subtotal * 0.03
  next.total = next.subtotal + next.gst
  item.previousTotal = item.quote.total
  item.quote = next
  item.priceChange = next.total > item.previousTotal ? 'INCREASED' : 'DECREASED'
  item.status = item.priceChange === 'INCREASED' ? 'AWAITING_CONFIRMATION' : 'CONFIRMED'
  return item
}
export function demoAccept(itemId: string, quoteId: string) {
  const item = cart.find(x => x.id === itemId)
  if (!item || item.quote.id !== quoteId) throw new Error('The price quote has changed. Refresh and try again.')
  item.status = 'CONFIRMED'
  return Promise.resolve(item)
}
export function demoCheckout(): Promise<Order> {
  if (cart.some(x => x.status !== 'CONFIRMED')) throw new Error('Please resolve all price changes before checkout.')
  if (cart.some(x => x.product.stock < x.quantity)) throw new Error('One or more items are out of stock.')
  const total = cart.reduce((sum, item) => sum + item.quote.total * item.quantity, 0)
  const order = { id: crypto.randomUUID(), orderNumber: `MA-${Math.floor(10000 + Math.random() * 89999)}`, total, createdAt: now().toISOString() }
  cart = []
  return Promise.resolve(order)
}
