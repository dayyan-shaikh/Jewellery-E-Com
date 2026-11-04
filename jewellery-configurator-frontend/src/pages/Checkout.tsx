import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/Store'
import { money } from '../services/api'

export default function Checkout() {
  const { cart, checkout } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const total = cart.reduce((sum, item) => sum + item.quote.total * item.quantity, 0)
  const blocked = cart.length === 0 || cart.some(item => item.status !== 'CONFIRMED' || new Date(item.quote.expiresAt).getTime() <= Date.now() || item.stockAvailable < item.quantity)
  const placeOrder = async () => {
    setBusy(true); setError('')
    try {
      const order = await checkout()
      sessionStorage.setItem('maison-last-order', JSON.stringify(order))
      navigate('/order-success')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to place order') }
    finally { setBusy(false) }
  }
  if (cart.length === 0) return <div className="page-shell empty-state"><h2>Your bag is empty.</h2><Link to="/" className="text-link">Return to collection</Link></div>
  return <div className="page-shell checkout-page">
    <Link to="/cart" className="back-link"><ArrowLeft size={14}/> BACK TO YOUR BAG</Link>
    <div className="page-title-row"><div><span className="eyebrow">THE FINAL DETAILS</span><h1>Review & <em>confirm.</em></h1><p>One last look before your piece begins its journey.</p></div></div>
    <div className="checkout-grid">
      <section className="checkout-card"><span className="eyebrow">ORDER CONTENTS</span><h2>Your chosen pieces</h2>
        {cart.map(item => <div className="checkout-item" key={item.id}><img src={item.product.imageUrl} alt={item.product.name}/><div><strong>{item.product.name}</strong><p>{item.quote.purity} · {item.quote.weightGrams}g · Qty {item.quantity}</p></div><b>{money(item.quote.total * item.quantity)}</b></div>)}
        <div className="checkout-total"><span>Total payable</span><strong>{money(total)}</strong></div>
      </section>
      <aside className="checkout-card checkout-aside"><span className="eyebrow">ORDER PLACEMENT</span><h2>Ready when you are.</h2><p className="checkout-copy">Your prices are secured by individual ten-minute quotes. We will validate each quote and reserve stock atomically when you place the order.</p><div className="summary-row"><span>Delivery</span><strong className="included">Complimentary</strong></div><div className="summary-row"><span>GST</span><strong>Included</strong></div>
        {error && <div className="notice notice-error">{error}</div>}
        <button className="button button-dark button-wide" disabled={blocked || busy} onClick={placeOrder}>{busy ? 'PLACING ORDER…' : 'PLACE ORDER'} <ArrowRight size={16}/></button>
        {blocked && <p className="checkout-hint">Return to your bag to refresh expired prices or resolve pending confirmations.</p>}
        <div className="secure-note"><ShieldCheck size={16}/><span>Secure order placement · Inventory checked at confirmation</span></div>
      </aside>
    </div>
  </div>
}
