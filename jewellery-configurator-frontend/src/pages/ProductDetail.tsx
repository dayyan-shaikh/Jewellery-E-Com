import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck, Truck } from 'lucide-react'
import Countdown from '../components/Countdown'
import PriceBreakdown from '../components/PriceBreakdown'
import { useStore } from '../store/Store'
import type { Quote } from '../types'
import { money } from '../services/api'

export default function ProductDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { products, getQuote, addToCart } = useStore()
  const product = products.find(p => p.id === id)
  const [purity, setPurity] = useState(product?.defaultPurity || '')
  const [weight, setWeight] = useState(product?.defaultWeight || 0)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [action, setAction] = useState<'cart' | 'buy' | null>(null)

  useEffect(() => {
    if (!product) return
    setPurity(product.defaultPurity); setWeight(product.defaultWeight)
  }, [product?.id])
  useEffect(() => {
    if (!product || !purity || !weight) return
    let active = true
    setQuote(null)
    const timer = window.setTimeout(() => {
      getQuote(product.id, purity, weight).then(q => { if (active) setQuote(q) }).catch(e => { if (active) setMessage(e.message) })
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [product?.id, purity, weight, getQuote])

  const handleAction = async (kind: 'cart' | 'buy') => {
    if (!product || !quote) return
    setBusy(true); setMessage(''); setAction(kind)
    try {
      await addToCart(product.id, quote)
      if (kind === 'buy') navigate('/cart')
      else setMessage('Added to your bag. Your price is held for ten minutes.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to add this piece.') }
    finally { setBusy(false); setAction(null) }
  }

  if (!product) return <div className="page-shell"><div className="empty-state"><h2>Piece not found</h2><Link to="/" className="text-link">Return to the collection</Link></div></div>
  return <div className="page-shell product-detail-page">
    <div className="breadcrumbs"><Link to="/">Collection</Link><span>/</span><span>{product.name}</span></div>
    <div className="product-detail-grid">
      <div className="detail-gallery"><div className="detail-main-image"><img src={product.imageUrl} alt={product.name}/><span className="gallery-label">MAISON AURELIA · OBJECTS TO KEEP</span></div><div className="gallery-caption"><span>01 / 01</span><span>AN EXERCISE IN FORM & FEELING</span></div></div>
      <div className="detail-panel">
        <Link to="/" className="back-link"><ArrowLeft size={14}/> BACK TO COLLECTION</Link>
        <span className="eyebrow">{product.category.toUpperCase()} · {product.metal.toUpperCase()}</span>
        <h1>{product.name}</h1><p className="detail-subtitle">{product.subtitle}</p>
        <p className="detail-description">{product.description}</p>
        <div className="detail-rule"/>
        <div className="config-section"><div className="config-label"><span>01 — SELECT PURITY</span><small>Metal fineness</small></div><div className="choice-row">{product.purities.map(p => <button key={p} className={`choice ${purity === p ? 'choice--active' : ''}`} onClick={() => setPurity(p)}>{p}{purity === p && <Check size={13}/>}</button>)}</div></div>
        <div className="config-section"><div className="config-label"><span>02 — SELECT WEIGHT</span><small>Approx. finished weight</small></div><div className="choice-row">{product.weightOptions.map(w => <button key={w} className={`choice ${weight === w ? 'choice--active' : ''}`} onClick={() => setWeight(w)}>{w}g</button>)}</div></div>
        <div className="live-price-card">
          <div className="live-price-head"><span>YOUR PERSONAL PRICE</span><span className="live-dot">LIVE RATE</span></div>
          {quote ? <><div className="live-price">{money(quote.total)}</div><Countdown expiresAt={quote.expiresAt}/><PriceBreakdown quote={quote}/></> : <div className="quote-loading">Calculating your piece…</div>}
        </div>
        {message && <div className={`notice ${message.startsWith('Added') ? 'notice-success' : 'notice-error'}`}>{message}</div>}
        <div className="detail-actions"><button className="button button-dark button-wide" disabled={!quote || busy || product.stock < 1} onClick={() => handleAction('cart')}>{busy && action === 'cart' ? 'ADDING…' : 'ADD TO BAG'} <ArrowUpRight size={16}/></button><button className="button button-outline button-wide" disabled={!quote || busy || product.stock < 1} onClick={() => handleAction('buy')}>BUY NOW</button></div>
        <div className="service-promises"><span><ShieldCheck size={16}/> Secure price lock for 10 minutes</span><span><Truck size={16}/> Insured delivery across India</span></div>
        <p className="stock-note">{product.stock > 0 && product.stock <= 3 ? `Only ${product.stock} ${product.stock === 1 ? 'piece' : 'pieces'} available` : 'Made with care, for years to come'}</p>
      </div>
    </div>
  </div>
}
