import { Link } from 'react-router-dom'
import { Check, ArrowUpRight } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import type { Order } from '../types'
import { money } from '../services/api'

export default function OrderSuccess() {
  const [order, setOrder] = useState<Order | null>(null)
  useEffect(() => {
    const raw = sessionStorage.getItem('maison-last-order')
    if (raw) setOrder(JSON.parse(raw) as Order)
  }, [])
  return <div className="page-shell success-page"><div className="success-seal"><Check size={28}/></div><span className="eyebrow">A MOMENT TO REMEMBER</span><h1>Consider it <em>yours.</em></h1><p className="success-copy">Thank you for choosing Maison Aurelia. Your order has been placed with care, and its story begins here.</p>{order && <div className="order-reference"><span>ORDER REFERENCE</span><strong>{order.orderNumber}</strong><span>ORDER STATUS</span><strong>{order.status}</strong>{order.items.map((item, index) => <Fragment key={`${item.productName}-${index}`}><span>{item.productName} · Qty {item.quantity}</span><strong>{money(item.total)}</strong></Fragment>)}<span>ORDER TOTAL</span><strong>{money(order.total)}</strong></div>}<Link to="/" className="button button-dark">RETURN TO THE MAISON <ArrowUpRight size={16}/></Link></div>
}
