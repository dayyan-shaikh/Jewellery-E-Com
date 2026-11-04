import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck, Truck } from 'lucide-react'
import Countdown from '../components/Countdown'
import PriceBreakdown from '../components/PriceBreakdown'
import { useStore } from '../store/Store'
import { api } from '../services/api'
import type { Quote } from '../types'
import { money } from '../services/api'
import { useAuth } from '../auth'

export default function ProductDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { products, getQuote, lockPrice, addToCart } = useStore()
  const [loadedProduct, setLoadedProduct] = useState<typeof products[number] | null>(null)
  const product = loadedProduct || products.find(p => p.id === id)
  const [purity, setPurity] = useState(product?.defaultPurity || '')
  const [weight, setWeight] = useState(product?.defaultWeight || 0)
  const selectedVariant = product?.variants.find(v => v.purity === purity && v.weightGrams === weight)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [action, setAction] = useState<'cart' | 'buy' | null>(null)

  useEffect(() => { let active = true; api.product(id).then(p => { if (active) setLoadedProduct(p) }).catch(e => { if (active) setMessage(e.message) }); return () => { active = false } }, [id])

  useEffect(() => {
    if (!product) return
    const firstAvailable = product.variants.find(v => v.stock > 0)
    setPurity(firstAvailable?.purity || product.defaultPurity)
    setWeight(firstAvailable?.weightGrams || product.defaultWeight)
  }, [product?.id])
  useEffect(() => {
    if (!product || !purity || !weight) return
    let active = true
    setQuote(null)
    const timer = window.setTimeout(() => {
    const variant = product.variants.find(v => v.purity === purity && v.weightGrams === weight)
    if (!variant) return
    getQuote(variant.id).then(q => { if (active) setQuote(q) }).catch(e => { if (active) setMessage(e.message) })
    }, 220)
    return () => { active = false; window.clearTimeout(timer) }
  }, [product?.id, purity, weight, getQuote])

  const handleAction = async (kind: 'cart' | 'buy') => {
    if (!user) { navigate('/login', { state: { from: { pathname: `/products/${id}` } } }); return }
    if (!product || !quote) return
    setBusy(true); setMessage(''); setAction(kind)
    try {
      if (!quote.id || !quote.expiresAt || new Date(quote.expiresAt).getTime() <= Date.now()) {
        const locked = await lockPrice(quote.variantId)
        setQuote(locked)
        await addToCart(locked.id)
      } else await addToCart(quote.id)
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
        <div className="config-section"><div className="config-label"><span>01 — SELECT PURITY</span><small>Metal fineness</small></div><div className="choice-row">{product.purities.map(p => <button key={p} className={`choice ${purity === p ? 'choice--active' : ''}`} onClick={() => { setPurity(p); const available = product.variants.filter(v => v.purity === p); if (!available.some(v => v.weightGrams === weight)) setWeight(available[0]?.weightGrams || 0) }}>{p}{purity === p && <Check size={13}/>}</button>)}</div></div>
        <div className="config-section"><div className="config-label"><span>02 — SELECT WEIGHT</span><small>Available finished weights</small></div><div className="choice-row">{product.variants.filter(v => v.purity === purity).map(v => <button key={v.id} className={`choice ${weight === v.weightGrams ? 'choice--active' : ''}`} disabled={v.stock < 1} onClick={() => setWeight(v.weightGrams)}>{v.weightGrams}g {v.stock < 1 ? '· unavailable' : ''}</button>)}</div></div>
        <div className="live-price-card">
          <div className="live-price-head"><span>YOUR PERSONAL PRICE</span><span className="live-dot">LIVE RATE</span></div>
          {quote ? <><div className="live-price">{money(quote.total)}</div>{quote.expiresAt && <Countdown expiresAt={quote.expiresAt}/>}<PriceBreakdown quote={quote}/></> : <div className="quote-loading">Calculating your piece…</div>}
        </div>
        {message && <div className={`notice ${message.startsWith('Added') ? 'notice-success' : 'notice-error'}`}>{message}</div>}
        <div className="detail-actions"><button className="button button-dark button-wide" disabled={!quote || busy || !selectedVariant || selectedVariant.stock < 1} onClick={() => handleAction('cart')}>{busy && action === 'cart' ? 'LOCKING PRICE…' : quote?.expiresAt ? 'ADD TO BAG' : 'LOCK PRICE & ADD TO BAG'} <ArrowUpRight size={16}/></button><button className="button button-outline button-wide" disabled={!quote || busy || !selectedVariant || selectedVariant.stock < 1} onClick={() => handleAction('buy')}>{busy && action === 'buy' ? 'LOCKING PRICE…' : 'BUY NOW'}</button></div>
        <div className="service-promises"><span><ShieldCheck size={16}/> Secure price lock for 10 minutes</span><span><Truck size={16}/> Insured delivery across India</span></div>
        <p className="stock-note">{selectedVariant?.stock ? `${selectedVariant.stock} available for this purity and weight` : 'This configuration is currently unavailable'}</p>
      </div>
    </div>
  </div>
}
