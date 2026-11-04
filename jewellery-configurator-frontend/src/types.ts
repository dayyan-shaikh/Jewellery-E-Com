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
  tag?: string
}

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
}

export interface CartItem {
  id: string
  product: Product
  quantity: number
  quote: Quote
  status: CartStatus
  previousTotal?: number
  priceChange?: QuoteChange
}

export interface Order {
  id: string
  orderNumber: string
  total: number
  createdAt: string
}
