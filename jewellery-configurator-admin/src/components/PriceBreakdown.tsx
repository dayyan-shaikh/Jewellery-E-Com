import type { Quote } from '../types'
import { money } from '../services/api'

export default function PriceBreakdown({ quote, compact = false }: { quote: Quote; compact?: boolean }) {
  return <div className={`price-breakdown ${compact ? 'price-breakdown--compact' : ''}`}>
    <div className="breakdown-heading"><span>PRICE DETAILS</span><span>INR</span></div>
    <div className="breakdown-row"><span>Metal value <small>{quote.weightGrams}g · {quote.purity} · {money(quote.metalRatePerGram)}/g</small></span><strong>{money(quote.metalValue)}</strong></div>
    <div className="breakdown-row"><span>Wastage</span><strong>{money(quote.wastage)}</strong></div>
    <div className="breakdown-row"><span>Making charges</span><strong>{money(quote.makingCharges)}</strong></div>
    {quote.stoneCost > 0 && <div className="breakdown-row"><span>Stone value</span><strong>{money(quote.stoneCost)}</strong></div>}
    <div className="breakdown-row"><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div>
    <div className="breakdown-row"><span>GST (3%)</span><strong>{money(quote.gst)}</strong></div>
    <div className="breakdown-total"><span>YOUR PRICE</span><strong>{money(quote.total)}</strong></div>
  </div>
}
