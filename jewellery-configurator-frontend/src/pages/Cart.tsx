import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import Countdown from '../components/Countdown'
import PriceBreakdown from '../components/PriceBreakdown'
import { money } from '../services/api'
import { useStore } from '../store/Store'

export default function Cart() {
  const { cart, reloadCart, removeFromCart, refreshCartItem, acceptPrice, updateQuantity } = useStore()
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [, setClock] = useState(0)
  const navigate = useNavigate()
  useEffect(() => { void reloadCart().catch(e => setError(e instanceof Error ? e.message : 'Unable to refresh cart')) }, [reloadCart])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!cart.length || document.visibilityState !== 'visible') return
      void reloadCart().catch(e => setError(e instanceof Error ? e.message : 'Unable to refresh cart'))
    }, 15000)
    return () => window.clearInterval(timer)
  }, [cart.length, reloadCart])
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const total = cart.reduce((sum, item) => sum + item.quote.total * item.quantity, 0)
  const pending = cart.filter(item => item.status === 'AWAITING_CONFIRMATION').length
  const outOfStock = cart.filter(item => item.status === 'OUT_OF_STOCK' || item.stockAvailable < item.quantity).length
  const canCheckout = cart.length > 0 && pending === 0 && outOfStock === 0 && cart.every(item => new Date(item.quote.expiresAt).getTime() > Date.now())

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id); setError('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusyId('') }
  }

  return <div className="page-shell cart-page">
    <div className="page-title-row"><div><span className="eyebrow">YOUR SELECTION</span><h1>The shopping <em>bag.</em></h1><p>A collection of pieces, chosen by you.</p></div><span className="cart-count">{cart.reduce((s, x) => s + x.quantity, 0).toString().padStart(2, '0')} PIECES</span></div>
    {error && <div className="notice notice-error">{error}</div>}
    {cart.length === 0 ? <div className="empty-state"><div className="empty-mark">MA</div><h2>Your bag is waiting.</h2><p>Find a piece that feels like it belongs to your story.</p><Link to="/" className="button button-dark">Explore the collection <ArrowRight size={16}/></Link></div> :
    <div className="cart-layout">
      <div className="cart-items">
        <div className="cart-list-heading"><span>THE PIECES ({cart.length})</span><span>PRICE & DETAILS</span></div>
        {cart.map(item => <article className="cart-item" key={item.id}>
          <Link to={`/products/${item.product.id}`} className="cart-image"><img src={item.product.imageUrl} alt={item.product.name}/></Link>
          <div className="cart-item-main">
            <div className="cart-item-top"><div><span className="eyebrow">{item.product.category || item.product.metal} · {item.quote.purity}</span><h3>{item.product.name}</h3><p>{item.quote.weightGrams}g · Qty <button className="quantity-control" disabled={item.quantity <= 1 || busyId === item.id} onClick={() => run(item.id, () => updateQuantity(item.id, item.quantity - 1))}>−</button> {item.quantity} <button className="quantity-control" disabled={busyId === item.id || item.quantity >= item.stockAvailable} onClick={() => run(item.id, () => updateQuantity(item.id, item.quantity + 1))}>+</button></p><small className={item.stockAvailable < item.quantity ? 'stock-unavailable' : 'stock-availability'}>{item.stockAvailable < item.quantity ? 'Unavailable' : `${item.stockAvailable} in stock`}</small></div><button className="icon-button" aria-label="Remove item" onClick={() => run(item.id, () => removeFromCart(item.id))}><Trash2 size={16}/></button></div>
            <div className="cart-item-price-row"><div><strong>{money(item.quote.total)}</strong>{item.priceDelta !== 0 && <small className={item.priceDelta > 0 ? 'stock-unavailable' : 'stock-availability'}>{item.priceDelta > 0 ? 'Market price increased' : 'Price decreased'} by {money(Math.abs(item.priceDelta))}{item.priceDelta > 0 && item.status !== 'AWAITING_CONFIRMATION' ? ' · original price protected' : ''}</small>}</div><Countdown expiresAt={item.quote.expiresAt}/></div>
            {item.status === 'AWAITING_CONFIRMATION' && <div className="price-change-alert"><div><strong>Price update needs your approval</strong><p>The live metal rate has increased. Please accept the new price to continue.</p></div><button className="button button-dark button-small" disabled={busyId === item.id} onClick={() => run(item.id, () => acceptPrice(item.id))}>ACCEPT NEW PRICE</button></div>}
            {item.priceChange === 'DECREASED' && <div className="price-change-alert"><div><strong>Good news: the price decreased</strong><p>The lower live price is applied to your order total.</p></div></div>}
            {item.status === 'OUT_OF_STOCK' && <div className="price-change-alert alert-error"><strong>This piece is currently out of stock.</strong></div>}
            <details className="cart-breakdown"><summary>View price breakdown</summary><PriceBreakdown quote={item.quote} compact/></details>
            <button className="refresh-link" disabled={busyId === item.id} onClick={() => run(item.id, () => refreshCartItem(item.id))}><RefreshCw size={13}/> {busyId === item.id ? 'CHECKING…' : 'REFRESH PRICE & AVAILABILITY'}</button>
          </div>
        </article>)}
        <Link to="/" className="continue-link">← CONTINUE EXPLORING</Link>
      </div>
      <aside className="order-summary">
        <span className="eyebrow">A LITTLE RECAP</span><h2>Order <em>summary.</em></h2>
        <div className="summary-row"><span>Pieces ({cart.reduce((s, x) => s + x.quantity, 0)})</span><strong>{money(total)}</strong></div>
        <div className="summary-row"><span>Insured delivery</span><strong className="included">Complimentary</strong></div>
        <div className="summary-divider"/>
        <div className="summary-total"><span>ESTIMATED TOTAL</span><strong>{money(total)}</strong></div>
        <p className="summary-includes">Inclusive of 3% GST. Final total confirmed at order placement.</p>
        {pending > 0 && <div className="summary-warning">{pending} {pending === 1 ? 'piece needs' : 'pieces need'} your price confirmation.</div>}
        {outOfStock > 0 && <div className="summary-warning">{outOfStock} {outOfStock === 1 ? 'piece is' : 'pieces are'} unavailable.</div>}
        <button className="button button-dark button-wide checkout-button" disabled={!canCheckout} onClick={() => navigate('/checkout')}>PROCEED TO CHECKOUT <ArrowRight size={16}/></button>
        {!canCheckout && <p className="checkout-hint">Refresh expired prices and confirm any changes before checkout.</p>}
        <div className="secure-note"><ShieldCheck size={16}/><span>Every order is securely placed and carefully prepared.</span></div>
      </aside>
    </div>}
  </div>
}
