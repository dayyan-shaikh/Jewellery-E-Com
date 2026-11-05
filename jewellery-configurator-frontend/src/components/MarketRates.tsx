import { useEffect, useState } from 'react'
import { api, money, type PublicMetalRate } from '../services/api'

const metals = [
  { key: 'GOLD', label: 'Gold', basePurity: '24K' },
  { key: 'SILVER', label: 'Silver', basePurity: '999' },
  { key: 'PLATINUM', label: 'Platinum', basePurity: '999' },
] as const

export default function MarketRates() {
  const [rates, setRates] = useState<PublicMetalRate[]>([])
  useEffect(() => { void api.metalRates().then(setRates).catch(() => setRates([])) }, [])

  return <section className="market-rate-strip" aria-label="Latest metal rates">
    <div className="market-rate-heading">
      <span className="eyebrow">METAL MARKET</span>
      <p>Latest reference rates <small>INR per gram</small></p>
    </div>
    <div className="market-rate-list">
      {metals.map(metal => {
        const rate = rates.find(row => row.metal_type === metal.key && row.purity.toUpperCase() === metal.basePurity)
          || rates.find(row => row.metal_type === metal.key)
        return <div className="market-rate-item" key={metal.key}>
          <span>{metal.label}<small>{rate ? `${rate.purity} reference` : 'Awaiting rate sync'}</small></span>
          <strong>{rate ? `${money(Number(rate.rate_per_gram))}/g` : '—'}</strong>
        </div>
      })}
    </div>
  </section>
}
