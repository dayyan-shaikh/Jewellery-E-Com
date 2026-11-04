import { Link } from 'react-router-dom'
export default function NotFound() { return <div className="page-shell empty-state"><span className="eyebrow">404 · NOT FOUND</span><h2>This page has wandered.</h2><Link to="/" className="text-link">Return to the Maison →</Link></div> }
