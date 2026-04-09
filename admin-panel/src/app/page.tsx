'use client'

import { useState } from 'react'
import { 
  Users, 
  Building2, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Settings,
  Bell,
  Search,
  Menu,
  ChevronRight,
  MapPin,
  CreditCard,
  BarChart3,
  FileText,
  LogOut
} from 'lucide-react'

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const stats = [
    { label: 'Total Employees', value: '2,847', change: '+12%', icon: Users, color: 'text-secondary-300' },
    { label: 'Present Today', value: '2,156', change: '+8%', icon: Clock, color: 'text-green-600' },
    { label: 'On Leave', value: '89', change: '-3%', icon: Calendar, color: 'text-primary-400' },
    { label: 'Revenue', value: '₹54,080', change: '+15%', icon: TrendingUp, color: 'text-accent-300' },
  ]

  const menuItems = [
    { icon: BarChart3, label: 'Dashboard', active: true },
    { icon: Users, label: 'Employees' },
    { icon: Building2, label: 'Companies' },
    { icon: Calendar, label: 'Attendance' },
    { icon: FileText, label: 'Leave Requests' },
    { icon: MapPin, label: 'Geofences' },
    { icon: CreditCard, label: 'Subscriptions' },
    { icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-neu-bg flex">
      {/* Sidebar */}
      <aside className={`neu-sidebar ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 p-4`}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-lg">
            Q
          </div>
          {sidebarOpen && <span className="text-xl font-bold text-gray-800">QHR Admin</span>}
        </div>

        {/* Menu */}
        <nav className="space-y-2">
          {menuItems.map((item, i) => (
            <button
              key={i}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                item.active 
                  ? 'gradient-button text-white' 
                  : 'neu-button text-gray-600 hover:text-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <button className="absolute bottom-4 left-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl neu-button text-red-500">
          <LogOut className="w-5 h-5" />
          {sidebarOpen && <span className="font-medium">Logout</span>}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl neu-button"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
              <p className="text-gray-500 text-sm">Welcome back, Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..."
                className="pl-12 pr-4 py-3 w-64 rounded-xl neu-input"
              />
            </div>

            {/* Notifications */}
            <button className="p-3 rounded-xl neu-button relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Profile */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
              A
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="neu-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl neu-card-sm ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <span className={`text-sm font-medium ${
                  stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-gray-800 mb-1">{stat.value}</h3>
              <p className="text-gray-500 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 neu-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
              <button className="text-primary-500 text-sm font-medium flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { name: 'Rahul Sharma', action: 'checked in', time: '2 min ago', type: 'checkin' },
                { name: 'Priya Patel', action: 'requested leave', time: '15 min ago', type: 'leave' },
                { name: 'Amit Kumar', action: 'checked out', time: '1 hour ago', type: 'checkout' },
                { name: 'Sneha Gupta', action: 'submitted report', time: '2 hours ago', type: 'report' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl neu-inset">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                    {activity.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      <span className="font-bold">{activity.name}</span> {activity.action}
                    </p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Overview */}
          <div className="neu-card p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-6">Subscription</h2>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-primary-500">₹19</div>
              <div className="text-gray-500">per user/month</div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl neu-inset">
                <span className="text-gray-600">Active Users</span>
                <span className="font-bold text-gray-800">2,847</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl neu-inset">
                <span className="text-gray-600">Monthly Revenue</span>
                <span className="font-bold text-green-500">₹54,093</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl neu-inset">
                <span className="text-gray-600">Companies</span>
                <span className="font-bold text-gray-800">156</span>
              </div>
            </div>

            <button className="w-full mt-6 py-3 rounded-xl gradient-button font-medium">
              Manage Subscriptions
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
