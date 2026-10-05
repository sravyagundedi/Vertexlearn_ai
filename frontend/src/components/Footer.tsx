import { Link } from 'react-router-dom';
import { BrainCircuit, Github, Twitter, Linkedin, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-grid">
        <div className="footer-col">
          <div className="brand" style={{ padding: 0, marginBottom: '14px' }}>
            <div className="brand-icon">
              <BrainCircuit size={18} />
            </div>
            <span>VertexLearn</span>
            <span style={{ color: '#2dd4bf', fontSize: '11px', background: 'rgba(45, 212, 191, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>AI</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, maxWidth: '300px' }}>
            Next-generation learning management system with course-grounded AI tutoring, automated quiz generation, and personalized study plans.
          </p>
        </div>

        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li><Link to="/courses">Course Catalog</Link></li>
            <li><a href="/#ai-tutor">AI Tutor</a></li>
            <li><a href="/#features">Interactive Quizzes</a></li>
            <li><a href="/#features">Flashcards & Summaries</a></li>
            <li><a href="/#features">Study Planner</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="#docs">Documentation</a></li>
            <li><a href="#architecture">Architecture</a></li>
            <li><a href="#api">API Reference</a></li>
            <li><a href="#community">Community</a></li>
            <li><a href="#guides">Guides</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Company & Legal</h4>
          <ul>
            <li><a href="#about">About VertexLearn</a></li>
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#terms">Terms of Service</a></li>
            <li><a href="#security">Security</a></li>
            <li><a href="#contact">Contact Support</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>
          © {new Date().getFullYear()} VertexLearn AI. All rights reserved.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          Built with intelligence & care for learners worldwide.
        </div>
      </div>
    </footer>
  );
}
