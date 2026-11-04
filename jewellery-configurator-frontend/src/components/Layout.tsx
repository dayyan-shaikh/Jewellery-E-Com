import { Link, NavLink, Outlet } from 'react-router-dom'
import { ArrowUpRight, Instagram, ShoppingBag } from 'lucide-react'
import { useStore } from '../store/Store'

export default function Layout() {
  const { cart } = useStore()
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  return <>
    <div className="announcement">A considered collection. Crafted to be kept. <span>Complimentary insured delivery on every order</span></div>
    <header className="site-header">
      <Link to="/" className="wordmark"><span>MAISON</span><strong>AURELIA</strong><small>FINE JEWELLERY</small></Link>
      <nav className="main-nav">
        <NavLink to="/" end>Discover</NavLink>
        <a href="/#collection">The collection</a>
        <a href="/#craft">Our craft</a>
      </nav>
      <div className="header-actions">
        <span className="header-note">Made with intention</span>
        <Link to="/cart" className="bag-link" aria-label="Shopping bag"><ShoppingBag size={19} /><span>Bag ({count})</span></Link>
      </div>
    </header>
    <main><Outlet /></main>
    <footer className="site-footer" id="craft">
      <div className="footer-top">
        <div><Link to="/" className="wordmark footer-wordmark"><span>MAISON</span><strong>AURELIA</strong><small>FINE JEWELLERY</small></Link><p>Objects of beauty. Stories that stay.</p></div>
        <div className="footer-links"><a href="/#collection">Explore the collection <ArrowUpRight size={14}/></a><a href="mailto:concierge@maisonaurelia.example">Speak to our concierge <ArrowUpRight size={14}/></a><a href="#craft">Care & craftsmanship <ArrowUpRight size={14}/></a></div>
        <div className="footer-social"><Instagram size={18}/><span>Follow the considered life</span></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Maison Aurelia</span><span>Thoughtfully made. Timelessly yours.</span><span>India · INR</span></div>
    </footer>
  </>
}
