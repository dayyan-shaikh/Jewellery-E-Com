import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem, Order, Product, Quote } from '../types'
import { api, DEMO_MODE } from '../services/api'
import * as demo from '../services/demo'

interface StoreValue {
  products: Product[]
  cart: CartItem[]
  loading: boolean
  error: string
  refreshProducts: () => Promise<void>
  getQuote: (productId: string, purity: string, weight: number) => Promise<Quote>
  addToCart: (productId: string, quote: Quote) => Promise<void>
  removeFromCart: (id: string) => Promise<void>
  refreshCartItem: (id: string) => Promise<void>
  acceptPrice: (id: string, quoteId: string) => Promise<void>
  checkout: () => Promise<Order>
}
const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshProducts = useCallback(async () => {
    try {
      setError('')
      setProducts(DEMO_MODE ? await demo.demoProducts() : await api.products())
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load products') }
  }, [])

  const refreshCart = useCallback(async () => {
    if (DEMO_MODE) setCart(await demo.demoCart())
    else setCart(await api.cart())
  }, [])

  useEffect(() => {
    Promise.all([refreshProducts(), refreshCart()]).finally(() => setLoading(false))
  }, [refreshProducts, refreshCart])

  const getQuote = async (productId: string, purity: string, weight: number) =>
    DEMO_MODE ? demo.demoQuote(productId, purity, weight) : api.createQuote(productId, purity, weight)

  const addToCart = async (productId: string, quote: Quote) => {
    if (DEMO_MODE) await demo.demoAdd(productId, quote)
    else await api.addCartItem(productId, quote.id)
    await refreshCart()
  }
  const removeFromCart = async (id: string) => {
    if (DEMO_MODE) await demo.demoRemove(id); else await api.removeCartItem(id)
    await refreshCart()
  }
  const refreshCartItem = async (id: string) => {
    if (DEMO_MODE) await demo.demoRefresh(id); else await api.refreshCartItem(id)
    await refreshCart()
  }
  const acceptPrice = async (id: string, quoteId: string) => {
    if (DEMO_MODE) await demo.demoAccept(id, quoteId); else await api.acceptCartPrice(id, quoteId)
    await refreshCart()
  }
  const checkout = async () => {
    const order = DEMO_MODE ? await demo.demoCheckout() : await api.checkout(crypto.randomUUID())
    await refreshCart()
    return order
  }

  const value = useMemo(() => ({
    products, cart, loading, error, refreshProducts, getQuote, addToCart, removeFromCart,
    refreshCartItem, acceptPrice, checkout,
  }), [products, cart, loading, error, refreshProducts])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
