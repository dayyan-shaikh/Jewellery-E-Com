import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Product } from '../types'

export default function ProductCard({ product }: { product: Product }) {
  return <article className="product-card">
    <Link to={`/products/${product.id}`} className="product-image-wrap">
      <img src={product.imageUrl} alt={product.name} />
      {product.tag && <span className="product-tag">{product.tag}</span>}
      <span className="image-arrow"><ArrowUpRight size={17}/></span>
    </Link>
    <div className="product-card-meta"><span>{product.category}</span><span>{product.metal.toUpperCase()}</span></div>
    <div className="product-card-title"><div><Link to={`/products/${product.id}`}>{product.name}</Link><p>{product.subtitle}</p></div><ArrowUpRight size={16}/></div>
  </article>
}
