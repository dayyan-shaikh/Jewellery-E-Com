import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { useStore } from '../store/Store'

export default function Home() {
  const { products, loading, error } = useStore()
  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow"><i/> THE ART OF KEEPING</span>
        <h1>Jewellery for<br/><em>your own story.</em></h1>
        <p>Considered forms, precious materials and enduring details. Discover pieces that feel like they have always been yours.</p>
        <Link to="/#collection" className="button button-dark">Explore the collection <ArrowUpRight size={16}/></Link>
        <div className="hero-footnote"><span>01 / 03</span><span>THE SIGNATURE COLLECTION</span></div>
      </div>
      <div className="hero-visual">
        <img src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1400&q=90" alt="Gold jewellery styled on warm ivory fabric"/>
        <div className="hero-stamp"><span>MAISON</span><strong>AURELIA</strong><small>EST. MMXXIV</small></div>
        <div className="hero-caption"><span>THE SOLENNE EDIT</span><span>01 — 06</span></div>
      </div>
      <div className="hero-scroll"><ArrowDown size={14}/> SCROLL TO DISCOVER</div>
    </section>
    <section className="intro-strip"><span>01 — A MORE PERSONAL KIND OF LUXURY</span><p>Made to mark a moment.<br/><em>Made to outlast it.</em></p><span>CRAFTED WITH INTENTION</span></section>
    <section className="collection-section" id="collection">
      <div className="section-heading"><div><span className="eyebrow">THE COLLECTION · 2026</span><h2>Pieces with <em>presence.</em></h2></div><p>Every detail has a purpose.<br/>Every piece, a point of view.</p></div>
      {error && <div className="notice notice-error">{error} — showing available collection data.</div>}
      {loading ? <div className="loading-state">Preparing the collection…</div> : <div className="product-grid">{products.map(product => <ProductCard key={product.id} product={product}/>)}</div>}
      <div className="collection-note"><Sparkles size={16}/><span>Each piece is made with care. Your final price is calculated from the live metal rate and held for ten minutes.</span></div>
    </section>
    <section className="craft-banner">
      <div className="craft-image"><img src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=85" alt="Jewellery craft detail"/></div>
      <div className="craft-copy"><span className="eyebrow">02 — THE MAISON STANDARD</span><h2>Beauty is in<br/><em>the details.</em></h2><p>We believe the pieces you keep should be made with the same care you give to the moments they represent. Thoughtful proportions, honest materials and a finish that rewards a closer look.</p><a href="mailto:concierge@maisonaurelia.example" className="text-link">Discover our approach <ArrowUpRight size={15}/></a></div>
    </section>
    <section className="closing-note"><span>MAISON AURELIA</span><p>Keep what <em>matters.</em></p><span>FINE JEWELLERY · INDIA</span></section>
  </>
}
