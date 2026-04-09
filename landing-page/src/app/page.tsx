'use client'

import { motion } from 'framer-motion'
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  Shield, 
  Smartphone,
  Monitor,
  Users,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Play,
  Star,
  Zap,
  Globe,
  BarChart3,
  Calendar,
  CreditCard,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen mesh-gradient text-white overflow-hidden">
      {/* Aurora Overlay */}
      <div className="fixed inset-0 aurora-gradient opacity-20 pointer-events-none" />
      
      {/* Floating Orbs */}
      <div className="fixed top-20 left-10 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl floating" />
      <div className="fixed top-40 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl floating" style={{ animationDelay: '-2s' }} />
      <div className="fixed bottom-20 left-1/3 w-80 h-80 bg-indigo-500/25 rounded-full blur-3xl floating" style={{ animationDelay: '-4s' }} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass ios-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center glow-primary">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold">QHR</span>
            </motion.div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-white/80 hover:text-white transition">Features</a>
              <a href="#pricing" className="text-white/80 hover:text-white transition">Pricing</a>
              <a href="#testimonials" className="text-white/80 hover:text-white transition">Testimonials</a>
              <a href="#faq" className="text-white/80 hover:text-white transition">FAQ</a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <button className="px-4 py-2 text-white/80 hover:text-white transition">
                Login
              </button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full font-medium glow-primary"
              >
                Start Free Trial
              </motion.button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden glass-dark px-6 py-4 space-y-4"
          >
            <a href="#features" className="block py-2">Features</a>
            <a href="#pricing" className="block py-2">Pricing</a>
            <a href="#testimonials" className="block py-2">Testimonials</a>
            <button className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full font-medium">
              Start Free Trial
            </button>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full mb-8"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm">AI-Powered HR Management</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              <span className="gradient-text">Transform</span> Your
              <br />
              Workforce Management
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl text-white/70 mb-10 max-w-2xl mx-auto"
            >
              GPS-based attendance, smart analytics, and AI-powered insights. 
              Everything you need to manage your team effectively.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full font-semibold text-lg flex items-center gap-2 glow-primary-lg"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 glass-button rounded-full font-semibold text-lg flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </motion.button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              {[
                { value: '10K+', label: 'Active Users' },
                { value: '500+', label: 'Companies' },
                { value: '99.9%', label: 'Uptime' },
                { value: '4.9★', label: 'Rating' },
              ].map((stat, i) => (
                <div key={i} className="glass-card rounded-2xl p-6">
                  <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-white/60 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-20 relative"
          >
            <div className="glass-card rounded-3xl p-4 md:p-8 glow-primary">
              <div className="aspect-video bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <Monitor className="w-16 h-16 mx-auto mb-4 text-indigo-400" />
                  <p className="text-white/60">Dashboard Preview</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Powerful <span className="gradient-text">Features</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Everything you need to manage your workforce efficiently
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: MapPin, title: 'GPS Attendance', desc: 'Automatic check-in/out with geofencing technology' },
              { icon: Smartphone, title: 'Mobile App', desc: 'iOS & Android apps for employees on the go' },
              { icon: Monitor, title: 'Desktop Tracking', desc: 'Activity monitoring for remote workers' },
              { icon: Calendar, title: 'Leave Management', desc: 'Streamlined leave requests and approvals' },
              { icon: BarChart3, title: 'Smart Analytics', desc: 'AI-powered insights and productivity reports' },
              { icon: Shield, title: 'Enterprise Security', desc: 'Bank-grade encryption and compliance' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card rounded-2xl p-6 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:glow-primary transition-all">
                  <feature.icon className="w-7 h-7 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple <span className="gradient-text">Pricing</span>
            </h2>
            <p className="text-white/60 text-lg">
              Pay per user. No hidden fees. Cancel anytime.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-3xl p-8"
            >
              <h3 className="text-xl font-semibold mb-2">Starter</h3>
              <p className="text-white/60 text-sm mb-6">For small teams</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Free</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Up to 5 users', 'Basic attendance', 'Mobile app access', 'Email support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 glass-button rounded-xl font-medium">
                Get Started
              </button>
            </motion.div>

            {/* Pro Plan - Featured */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="gradient-border rounded-3xl p-8 relative glow-primary"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold mb-2">Professional</h3>
              <p className="text-white/60 text-sm mb-6">For growing businesses</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">₹19</span>
                <span className="text-white/60">/user/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited users',
                  'GPS geofencing',
                  'Leave management',
                  'Desktop tracking',
                  'Analytics dashboard',
                  'Priority support',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl font-medium">
                Start Free Trial
              </button>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-3xl p-8"
            >
              <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
              <p className="text-white/60 text-sm mb-6">For large organizations</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Everything in Pro',
                  'Custom integrations',
                  'Dedicated support',
                  'SLA guarantee',
                  'On-premise option',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 glass-button rounded-xl font-medium">
                Contact Sales
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Loved by <span className="gradient-text">Teams</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Rahul Sharma', role: 'HR Manager, TechCorp', quote: 'QHR transformed how we manage attendance. The GPS feature is incredibly accurate.' },
              { name: 'Priya Patel', role: 'CEO, StartupX', quote: 'Simple pricing, powerful features. We saved 10+ hours per week on HR tasks.' },
              { name: 'Amit Kumar', role: 'Operations Head, RetailCo', quote: 'The mobile app is fantastic. Our field team loves the easy check-in process.' },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/80 mb-6">"{t.quote}"</p>
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-white/60 text-sm">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-3xl p-12 text-center glow-primary-lg"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
              Join 500+ companies already using QHR to manage their workforce efficiently.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full font-semibold text-lg"
            >
              Start Your Free Trial
            </motion.button>
            <p className="text-white/50 text-sm mt-4">No credit card required</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold">QHR</span>
              </div>
              <p className="text-white/60 text-sm">
                AI-powered HR management for modern teams.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-white/50 text-sm">
            © 2024 QHR. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
