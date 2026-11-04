export type Metal = 'gold' | 'silver' | 'platinum'
export type QuoteChange = 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'OUT_OF_STOCK'
export type CartStatus = 'CONFIRMED' | 'AWAITING_CONFIRMATION' | 'OUT_OF_STOCK'

export interface Product {
  id: string
  name: string
  subtitle: string
  description: string
  category: string
  metal: Metal
  purities: string[]
  defaultPurity: string
  weightOptions: number[]
  defaultWeight: number
  wastagePercent: number
  makingChargePerGram: number
  stoneCost: number
  stock: number
  imageUrl: string
  variants: Variant[]
  tag?: string
}

export interface Variant { id: string; sku: string; purity: string; weightGrams: number; stoneCharge: number; stock: number }

export interface Quote {
  id: string
  productId: string
  purity: string
  weightGrams: number
  currency: string
  metalRatePerGram: number
  metalValue: number
  wastage: number
  makingCharges: number
  stoneCost: number
  subtotal: number
  gst: number
  total: number
  createdAt: string
  expiresAt: string
  variantId: string
}

export interface CartItem {
  id: string
  product: Product
  quantity: number
  quote: Quote
  status: CartStatus
  previousTotal?: number
  priceChange?: QuoteChange
  priceDelta: number
  stockAvailable: number
}

export interface Order {
  id: string
  orderNumber: string
  total: number
  createdAt: string
  status: string
  items: Array<{ productName: string; quantity: number; total: number }>
}
