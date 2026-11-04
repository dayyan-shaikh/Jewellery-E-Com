import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem, Order, Product, Quote } from '../types'
import { api } from '../services/api'
import { useAuth } from '../auth'

interface StoreValue {
  products: Product[]; cart: CartItem[]; loading: boolean; error: string
  refreshProducts: () => Promise<void>; reloadCart: () => Promise<void>; getQuote: (variantId: string) => Promise<Quote>
  lockPrice: (variantId: string) => Promise<Quote>; addToCart: (lockId: string) => Promise<void>; removeFromCart: (id: string) => Promise<void>
  refreshCartItem: (id: string) => Promise<void>; acceptPrice: (id: string) => Promise<void>
  updateQuantity: (id: string, quantity: number) => Promise<void>; checkout: () => Promise<Order>
}
const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshProducts = useCallback(async () => {
    try { setError(''); setProducts(await api.products()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load products') }
  }, [])
  const refreshCart = useCallback(async () => { setCart(await api.cart(products)) }, [products])
  const reloadCart = refreshCart

  useEffect(() => { void refreshProducts() }, [refreshProducts])
  useEffect(() => {
    if (!user || !products.length) { setCart([]); setLoading(false); return }
    void refreshCart().catch(e => setError(e instanceof Error ? e.message : 'Unable to load cart')).finally(() => setLoading(false))
  }, [products, refreshCart, user?.id])

  const getQuote = useCallback((variantId: string) => api.calculate(variantId), [])
  const lockPrice = useCallback((variantId: string) => api.createLock(variantId), [])
  const addToCart = useCallback(async (lockId: string) => {
    await api.addCartItem(lockId)
    await refreshCart()
  }, [refreshCart])
  const removeFromCart = useCallback(async (id: string) => { await api.removeCartItem(id); await refreshCart() }, [refreshCart])
  const refreshCartItem = useCallback(async (id: string) => {
    if (!cart.some(x => x.id === id)) return
    // GET /cart revalidates each line independently and only replaces locks
    // that have expired; valid quotes for the other items remain untouched.
    await refreshCart()
  }, [cart, refreshCart])
  const acceptPrice = useCallback(async (id: string) => { await api.confirmPrice(id); await refreshCart() }, [refreshCart])
  const updateQuantity = useCallback(async (id: string, quantity: number) => { await api.updateQuantity(id, quantity); await refreshCart() }, [refreshCart])
  const checkout = useCallback(async () => {
    const keyName = 'maison-checkout-idempotency-key'
    let key = sessionStorage.getItem(keyName)
    if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(keyName, key) }
    const order = await api.checkout(key)
    sessionStorage.removeItem(keyName)
    await refreshCart()
    return order
  }, [refreshCart])

  const value = useMemo(() => ({ products, cart, loading, error, refreshProducts, reloadCart, getQuote, lockPrice, addToCart, removeFromCart, refreshCartItem, acceptPrice, updateQuantity, checkout }), [products, cart, loading, error, refreshProducts, reloadCart, getQuote, lockPrice, addToCart, removeFromCart, refreshCartItem, acceptPrice, updateQuantity, checkout])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
