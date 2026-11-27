import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Search, CreditCard, X, ChevronRight, RefreshCw, Navigation, MapPin,
  Map as MapIcon, Grid, FileText, BarChart3, CheckCircle2, Compass, AlertTriangle,
  User, Heart, LogOut, Lock, Mail, Printer, Share2, Trash2
} from 'lucide-react';
import EVMap from './EVMap';
import { io } from 'socket.io-client';

const REGIONAL_DEFAULT = { lat: 17.6599, lng: 75.9064 }; // Solapur Central Base
const API_BASE = import.meta.env.VITE_API_URL || 'https://chargepulse-ev-platform.onrender.com';

export function ChargePulseLogo({ className = 'w-9 h-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cpBrandGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a3e635" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="16"
        fill="#0b1120"
        stroke="url(#cpBrandGrad)"
        strokeWidth="3"
      />
      <path d="M36 13L20 35h11l-2 16 16-22H34l2-16z" fill="url(#cpBrandGrad)" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [viewMode, setViewMode] = useState('grid');
  const [stations, setStations] = useState([]);
  const [bookingsHistory, setBookingsHistory] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  // Auth State (JWT)
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [favorites, setFavorites] = useState([]);

  // Filters & Emergency SOS Mode
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedVehicleType, setSelectedVehicleType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sosEmergencyOnly, setSosEmergencyOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Modals & In-App Focus
  const [bookingModalStation, setBookingModalStation] = useState(null);
  const [selectedMapStation, setSelectedMapStation] = useState(null);

  const [selectedPort, setSelectedPort] = useState('Port 1 (Fast DC 60kW)');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('10:00 AM - 11:00 AM');
  const [activeSession, setActiveSession] = useState(null);

  // Live GPS tracking state
  const [userLocation, setUserLocation] = useState({
    lat: REGIONAL_DEFAULT.lat,
    lng: REGIONAL_DEFAULT.lng,
    isLiveGPS: false
  });

  // Partner Registration Form
  const [newStation, setNewStation] = useState({
    name: '',
    district: 'Solapur',
    taluka: 'Solapur',
    address: '',
    type: 'Both',
    connector: 'CCS2 60kW DC',
    price: '16',
    portsTotal: '4'
  });

  // 1. Restore User Session, Favorites & Connect Socket.io Live Engine
  useEffect(() => {
    const savedToken = localStorage.getItem('chargepulse_token');
    const savedUser = localStorage.getItem('chargepulse_user');
    const savedFavs = localStorage.getItem('chargepulse_favs');

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('chargepulse_user');
      }
    }
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch {
        localStorage.removeItem('chargepulse_favs');
      }
    }

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Connected to ChargePulse live updates engine');
    });

    socket.on('station_updated', (data) => {
      setStations((prevStations) =>
        prevStations.map((st) => {
          const id = st.stationId || st._id;
          if (id === data.stationId) {
            return {
              ...st,
              portsAvail: data.portsAvail ?? Math.max(0, (st.portsAvail || 1) - 1)
            };
          }
          return st;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 2. Continuous Live GPS Watcher
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) =>
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            isLiveGPS: true
          }),
        (err) => console.log('GPS fallback active:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // 3. Distance Calculation
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  };

  // 4. Initial Load & User-Scoped Bookings
  useEffect(() => {
    async function loadStations() {
      try {
        const res = await fetch(`${API_BASE}/api/stations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.stations)) {
          setStations(data.stations);
        }
      } catch (err) {
        console.log('Backend server offline or waking up:', err.message);
      }
    }
    loadStations();
  }, []);

  useEffect(() => {
    async function loadUserBookings() {
      if (!user?.email) {
        const guestBookings = JSON.parse(localStorage.getItem('chargepulse_guest_bookings') || '[]');
        setBookingsHistory(guestBookings);
        return;
      }
      try {
        const resB = await fetch(
          `${API_BASE}/api/bookings?email=${encodeURIComponent(user.email)}`
        );
        if (!resB.ok) throw new Error(`HTTP ${resB.status}`);
        const dataB = await resB.json();
        if (dataB.success && Array.isArray(dataB.bookings)) {
          setBookingsHistory(dataB.bookings);
        }
      } catch (err) {
        console.log('Bookings API offline:', err.message);
      }
    }
    loadUserBookings();
  }, [user]);

  // JWT AUTHENTICATION HANDLERS
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = authForm.email.trim().toLowerCase();
    const trimmedName = authForm.name.trim();

    if (!trimmedEmail || !authForm.password) {
      alert('Fill out all credentials');
      return;
    }
    if (isSignUp && !trimmedName) {
      alert('Please enter your full name');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const payload = isSignUp
        ? { name: trimmedName, email: trimmedEmail, password: authForm.password }
        : { email: trimmedEmail, password: authForm.password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('chargepulse_token', data.token);
        localStorage.setItem('chargepulse_user', JSON.stringify(data.user));
        setUser(data.user);
        setAuthModalOpen(false);
        setAuthForm({ name: '', email: '', password: '' });
        alert(`Welcome, ${data.user.name}! Successfully authenticated.`);
      } else {
        alert(data.message || data.error || 'Authentication failed. Check your credentials.');
      }
    } catch (err) {
      const mockUser = { name: trimmedName || 'EV Driver', email: trimmedEmail };
      localStorage.setItem('chargepulse_token', 'mock_jwt_token_12345');
      localStorage.setItem('chargepulse_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setAuthModalOpen(false);
      setAuthForm({ name: '', email: '', password: '' });
      alert(`Welcome, ${mockUser.name}! (Offline Demo Session Active)`);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chargepulse_token');
    localStorage.removeItem('chargepulse_user');
    setUser(null);
    alert('Logged out successfully.');
  };

  // TOGGLE FAVORITES
  const toggleFavorite = (stationId) => {
    setFavorites((prev) => {
      const updated = prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId];
      localStorage.setItem('chargepulse_favs', JSON.stringify(updated));
      return updated;
    });
  };

  // External Google Maps Handler
  const openRealGoogleMapsView = (station = null) => {
    const target = station || selectedMapStation || processedStations[0];
    const origin = `${userLocation.lat},${userLocation.lng}`;
    const destination =
      target && target.lat && target.lng
        ? `${target.lat},${target.lng}`
        : `${REGIONAL_DEFAULT.lat},${REGIONAL_DEFAULT.lng}`;

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // In-App Route Handler
  const handleShowRouteInApp = (station) => {
    setSelectedMapStation(station);
    setViewMode('map');
  };

  // OpenChargeMap API Sync
  const handleSyncOpenChargeMap = async () => {
    setIsSyncing(true);
    const OCM_API_KEY = '31169d2d-ed90-4634-b460-545d3a814f62';
    try {
      const res = await fetch(
        `https://api.openchargemap.io/v3/poi/?output=json&countrycode=IN&latitude=${userLocation.lat}&longitude=${userLocation.lng}&distance=50&maxresults=50&compact=true&key=${OCM_API_KEY}`
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();

      const formatted = data.map((st) => {
        const info = st.AddressInfo || {};
        const fullText = `${info.Title || ''} ${info.Town || ''} ${info.AddressLine1 || ''}`.toLowerCase();

        let district = info.Town || 'Maharashtra';
        if (fullText.includes('solapur')) district = 'Solapur';
        else if (fullText.includes('pandharpur')) district = 'Pandharpur';
        else if (fullText.includes('pune')) district = 'Pune';
        else if (fullText.includes('nashik')) district = 'Nashik';
        else if (fullText.includes('thane')) district = 'Thane';
        else if (fullText.includes('mumbai')) district = 'Mumbai Suburban';
        else if (fullText.includes('kolhapur')) district = 'Kolhapur';

        return {
          stationId: `OCM-${st.ID}`,
          name: info.Title || 'Public EV Station',
          district,
          taluka: info.Town || district,
          address: info.AddressLine1 || 'Main Highway Road',
          lat: Number(info.Latitude),
          lng: Number(info.Longitude),
          type: 'Both',
          connector: st.Connections?.[0]?.ConnectionType?.Title || 'CCS2 / Type 2 AC',
          price: 18,
          portsTotal: st.Connections?.length || 2,
          portsAvail: Math.max(1, (st.Connections?.length || 2) - 1),
          operator: st.OperatorInfo?.Title || 'Public Network'
        };
      });

      setStations((prev) => {
        const ids = new Set(prev.map((s) => s.stationId));
        return [...formatted.filter((s) => !ids.has(s.stationId)), ...prev];
      });
      setSosEmergencyOnly(false);
      alert(`Successfully synced ${formatted.length} live local stations nearby!`);
    } catch (err) {
      alert(`Failed to connect to OpenChargeMap API (${err.message || 'Network error'}).`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Payment Handler
  const handlePayment = async (station) => {
    if (isPaying) return;
    setIsPaying(true);

    const stationId = station.stationId || station._id;
    const fallbackBooking = () => ({
      bookingId: `CP-${Math.floor(100000 + Math.random() * 900000)}`,
      stationId,
      date: new Date().toLocaleDateString(),
      stationName: station.name,
      connector: `${station.connector} (${selectedPort})`,
      slotTime: selectedTimeSlot,
      cost: station.price || 50
    });

    try {
      const token = localStorage.getItem('chargepulse_token');

      await fetch(`${API_BASE}/api/stations/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId })
      });

      const verifyRes = await fetch(`${API_BASE}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userEmail: user?.email || null,
          stationId,
          stationName: station.name,
          connector: `${station.connector} (${selectedPort})`,
          slotTime: selectedTimeSlot,
          cost: station.price || 50
        })
      });
      const verifyData = await verifyRes.json();

      const confirmedBooking =
        verifyRes.ok && verifyData.success && verifyData.booking
          ? verifyData.booking
          : fallbackBooking();

      setBookingsHistory((prev) => {
        const updated = [confirmedBooking, ...prev];
        if (!user?.email) {
          localStorage.setItem('chargepulse_guest_bookings', JSON.stringify(updated));
        }
        return updated;
      });
      setActiveSession({ station, port: selectedPort, time: selectedTimeSlot });
      alert(`Booking Confirmed!\nBooking ID: ${confirmedBooking.bookingId}`);
      setBookingModalStation(null);
      setActiveTab('bookings');
    } catch (err) {
      const offlineBooking = fallbackBooking();
      setBookingsHistory((prev) => {
        const updated = [offlineBooking, ...prev];
        if (!user?.email) {
          localStorage.setItem('chargepulse_guest_bookings', JSON.stringify(updated));
        }
        return updated;
      });
      setActiveSession({ station, port: selectedPort, time: selectedTimeSlot });
      alert(`Booking saved to local history.\nBooking ID: ${offlineBooking.bookingId}`);
      setBookingModalStation(null);
      setActiveTab('bookings');
    } finally {
      setIsPaying(false);
    }
  };

  // Print Receipt Handler
  const handlePrintBooking = (booking) => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) {
      alert('Please allow pop-ups to print your booking receipt.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>ChargePulse Receipt - ${booking.bookingId}</title>
          <style>
            body { font-family: sans-serif; padding: 32px; color: #0f172a; }
            .card { border: 2px solid #06b6d4; border-radius: 16px; padding: 24px; max-width: 480px; margin: auto; }
            h1 { color: #0891b2; margin-bottom: 4px; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .label { color: #64748b; font-size: 13px; }
            .value { font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>ChargePulse EV Receipt</h1>
            <p style="color:#64748b;font-size:12px;margin-top:0;">Maharashtra EV Charging Grid</p>
            <div class="row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
            <div class="row"><span class="label">Station</span><span class="value">${booking.stationName}</span></div>
            <div class="row"><span class="label">Connector & Port</span><span class="value">${booking.connector}</span></div>
            <div class="row"><span class="label">Time Slot</span><span class="value">${booking.slotTime}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">${booking.date || new Date().toLocaleDateString()}</span></div>
            <div class="row" style="border-bottom:none;"><span class="label">Amount Paid</span><span class="value">₹${booking.cost}</span></div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Share Booking Handler (Web Share API + Clipboard Fallback)
  const handleShareBooking = async (booking) => {
    const shareText = `⚡ ChargePulse EV Booking Confirmed!\nBooking ID: ${booking.bookingId}\nStation: ${booking.stationName}\nConnector: ${booking.connector}\nSlot: ${booking.slotTime}\nAmount Paid: ₹${booking.cost}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `ChargePulse Booking - ${booking.bookingId}`,
          text: shareText,
        });
        return;
      } catch (err) {
        // User cancelled or share unsupported; fall back to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      alert('Booking details copied to clipboard! Ready to paste and share.');
    } catch (err) {
      alert(shareText);
    }
  };

  // Delete / Cancel Booking Handler
  const handleDeleteBooking = async (booking) => {
    const targetId = booking._id || booking.bookingId;
    if (!window.confirm(`Cancel and delete booking ${booking.bookingId} at ${booking.stationName}?`)) {
      return;
    }

    try {
      await fetch(`${API_BASE}/api/bookings/${targetId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.log('Backend delete fallback active.');
    }

    setBookingsHistory((prev) => {
      const updated = prev.filter((b) => (b._id || b.bookingId) !== targetId);
      if (!user?.email) {
        localStorage.setItem('chargepulse_guest_bookings', JSON.stringify(updated));
      }
      return updated;
    });
    alert(`Booking ${booking.bookingId} deleted.`);
  };

  // Add Partner Station
  const handleAddStationDB = async () => {
    if (!newStation.name) {
      alert('Enter station name');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/stations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStation)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStations((prev) => [data.station, ...prev]);
        alert('Station published successfully!');
        setActiveTab('explore');
      } else {
        alert(data.error || 'Failed to publish station.');
      }
    } catch (err) {
      alert('Failed to publish station.');
    }
  };

  // Sorting & Filtering Memo
  const processedStations = useMemo(() => {
    const distTarget = selectedDistrict.toLowerCase().trim();
    const q = searchQuery.toLowerCase().trim();

    const mapped = stations.map((s) => ({
      ...s,
      calculatedDistanceKm: getDistanceKm(
        userLocation.lat,
        userLocation.lng,
        Number(s.lat),
        Number(s.lng)
      )
    }));

    const filtered = mapped.filter((s) => {
      const id = s.stationId || s._id;
      const district = (s.district || '').toLowerCase();
      const taluka = (s.taluka || '').toLowerCase();
      const address = (s.address || '').toLowerCase();
      const name = (s.name || '').toLowerCase();

      if (showFavoritesOnly && !favorites.includes(id)) return false;
      if (sosEmergencyOnly)
        return s.calculatedDistanceKm != null && s.calculatedDistanceKm <= 3.0;

      let matchesDistrict = true;
      if (selectedDistrict !== 'All') {
        const isNearbyRadius =
          s.calculatedDistanceKm != null && s.calculatedDistanceKm <= 15;
        matchesDistrict =
          district.includes(distTarget) ||
          taluka.includes(distTarget) ||
          address.includes(distTarget) ||
          isNearbyRadius;
      }

      let matchesType = true;
      if (selectedVehicleType === 'Car') {
        matchesType =
          s.type === 'Car' ||
          s.type === 'Both' ||
          (s.connector && (s.connector.includes('CCS') || s.connector.includes('DC')));
      } else if (selectedVehicleType === 'Bike') {
        matchesType =
          s.type === 'Bike' ||
          s.type === 'Both' ||
          (s.connector && (s.connector.includes('AC') || s.connector.includes('Socket')));
      }

      const matchesSearch =
        !q ||
        name.includes(q) ||
        taluka.includes(q) ||
        district.includes(q) ||
        address.includes(q);
      return matchesDistrict && matchesType && matchesSearch;
    });

    return filtered.sort(
      (a, b) => (a.calculatedDistanceKm ?? 9999) - (b.calculatedDistanceKm ?? 9999)
    );
  }, [
    stations,
    selectedDistrict,
    selectedVehicleType,
    searchQuery,
    sosEmergencyOnly,
    showFavoritesOnly,
    favorites,
    userLocation
  ]);

  const totalRevenue = bookingsHistory.reduce((acc, b) => acc + (Number(b.cost) || 0), 0);
  const totalEnergy = bookingsHistory.length * 24;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-400 selection:text-slate-950">
      {/* HEADER */}
      <header className="bg-[#070b14]/90 backdrop-blur-xl border-b border-cyan-500/15 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <ChargePulseLogo className="w-10 h-10 shrink-0 shadow-lg shadow-cyan-500/15" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">ChargePulse</h1>
              <span className="text-[10px] text-lime-300 bg-lime-400/10 border border-lime-400/30 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                Maharashtra Grid v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Real-World EV Station Discovery & Navigation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <button
            onClick={handleSyncOpenChargeMap}
            disabled={isSyncing}
            className="hidden sm:flex bg-[#0c1322] hover:bg-slate-800 border border-cyan-500/20 text-cyan-300 text-xs px-3.5 py-2 rounded-xl items-center space-x-2 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live API'}</span>
          </button>

          {user ? (
            <div className="flex items-center space-x-2 bg-[#0c1322] border border-slate-800 px-3 py-1.5 rounded-xl">
              <User className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200 hidden md:inline">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                title="Logout"
                className="text-slate-400 hover:text-rose-400 ml-1 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="bg-gradient-to-r from-cyan-400 to-lime-300 hover:brightness-105 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-md shadow-cyan-500/15"
            >
              Sign In / Driver Profile
            </button>
          )}

          <nav className="flex space-x-1 bg-[#0c1322] border border-slate-800 p-1 rounded-full">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                activeTab === 'explore'
                  ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                activeTab === 'bookings'
                  ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bookings
            </button>
            {activeSession && (
              <button
                onClick={() => setActiveTab('session')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition animate-pulse ${
                  activeTab === 'session'
                    ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-slate-950'
                    : 'text-lime-300'
                }`}
              >
                Charging
              </button>
            )}
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Partner
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* HERO BANNER */}
            <div className="bg-gradient-to-br from-cyan-950/60 via-[#0d1526] to-[#090e1a] border border-cyan-400/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-semibold">
                  <Compass className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {userLocation.isLiveGPS
                      ? 'Live GPS Position Active'
                      : 'Regional Default Base Active'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Find & Navigate EV Stations Across Maharashtra
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Nearest fast chargers ranked automatically by distance from your current location.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition ${
                    showFavoritesOnly
                      ? 'bg-rose-600 text-white border border-rose-400'
                      : 'bg-[#0c1322] hover:bg-slate-800 text-slate-200 border border-slate-800'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      showFavoritesOnly ? 'fill-current text-white' : 'text-rose-400'
                    }`}
                  />
                  <span>
                    {showFavoritesOnly ? 'Saved Favorites' : `Saved (${favorites.length})`}
                  </span>
                </button>

                <button
                  onClick={() => setSosEmergencyOnly(!sosEmergencyOnly)}
                  className={`w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition shadow-lg ${
                    sosEmergencyOnly
                      ? 'bg-rose-600 text-white animate-bounce shadow-rose-600/40 border border-rose-400'
                      : 'bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>
                    {sosEmergencyOnly
                      ? 'Showing Local SOS Chargers'
                      : 'SOS Emergency (Under 3km)'}
                  </span>
                </button>

                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="bg-[#070b14] border border-cyan-500/20 p-4 rounded-2xl text-center flex-1 sm:w-28">
                    <span className="text-2xl font-black text-cyan-300">
                      {processedStations.length}
                    </span>
                    <p className="text-[10px] text-slate-400">Hubs Found</p>
                  </div>
                  {processedStations[0] && (
                    <div className="bg-[#070b14] border border-lime-400/20 p-4 rounded-2xl text-center flex-1 sm:w-28">
                      <span className="text-2xl font-black text-lime-300">
                        {processedStations[0].calculatedDistanceKm <= 1
                          ? `${Math.round(processedStations[0].calculatedDistanceKm * 1000)} m`
                          : `${processedStations[0].calculatedDistanceKm} km`}
                      </span>
                      <p className="text-[10px] text-slate-400">Closest Station</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="bg-[#0c1322] border border-slate-800/90 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search station, taluka, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 text-ellipsis overflow-hidden"
                >
                  <option value="All">All Maharashtra Districts</option>
                  <option value="Solapur">Solapur</option>
                  <option value="Pandharpur">Pandharpur</option>
                  <option value="Pune">Pune</option>
                  <option value="Mumbai Suburban">Mumbai</option>
                  <option value="Thane">Thane</option>
                  <option value="Nashik">Nashik</option>
                  <option value="Kolhapur">Kolhapur</option>
                  <option value="Chhatrapati Sambhajinagar">Chhatrapati Sambhajinagar</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="All">All Vehicle Types</option>
                  <option value="Car">E-Cars (CCS2 / DC)</option>
                  <option value="Bike">E-Bikes / 2W</option>
                </select>
              </div>

              <div className="flex bg-[#070b14] p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'grid'
                      ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => openRealGoogleMapsView()}
                  className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-400/30 transition"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Map View</span>
                </button>
              </div>
            </div>

            {/* GRID VIEW */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {processedStations.length === 0 ? (
                  <div className="col-span-full bg-[#0c1322] border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
                    <h3 className="text-base font-bold text-white">No stations found nearby</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {sosEmergencyOnly
                        ? 'Try toggling off the SOS filter or click "Sync Live API" to fetch micro-chargers nearby.'
                        : 'Try searching for your village or taluka name in the search bar above.'}
                    </p>
                  </div>
                ) : (
                  processedStations.map((station, index) => {
                    const stId = station.stationId || station._id;
                    const isFav = favorites.includes(stId);
                    const distKm = station.calculatedDistanceKm;
                    const isUltraNear = distKm != null && distKm <= 1.0;

                    return (
                      <div
                        key={stId}
                        className={`bg-[#0c1322] border rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-lg transition ${
                          isUltraNear
                            ? 'border-rose-500/80 shadow-rose-500/10'
                            : 'border-slate-800/90 hover:border-cyan-400/40'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold px-2.5 py-1 bg-[#070b14] text-cyan-300 rounded-xl border border-slate-800">
                              {station.operator}
                            </span>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleFavorite(stId)}
                                className={`p-1.5 rounded-xl border transition ${
                                  isFav
                                    ? 'bg-rose-950 border-rose-800 text-rose-400'
                                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-rose-400'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                              </button>

                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                                  isUltraNear
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : index === 0
                                    ? 'bg-gradient-to-r from-cyan-400 to-lime-300 text-slate-950'
                                    : 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/25'
                                }`}
                              >
                                <MapPin className="w-3 h-3" />
                                {distKm != null
                                  ? distKm <= 1
                                    ? `${Math.round(distKm * 1000)} meters away`
                                    : `${distKm} km away`
                                  : 'Calculating...'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-white tracking-tight">
                              {station.name}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                              {station.address} ({station.district})
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-slate-800/80">
                          <div className="flex items-center justify-between bg-[#070b14] p-3 rounded-2xl border border-slate-800/80">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                Connector
                              </p>
                              <p className="text-xs font-bold text-slate-200 mt-0.5">
                                {station.connector}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                Tariff
                              </p>
                              <p className="text-sm font-black text-lime-300 mt-0.5">
                                ₹{station.price}/kWh
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              onClick={() => setBookingModalStation(station)}
                              className="bg-gradient-to-r from-cyan-400 to-lime-300 hover:brightness-105 text-slate-950 font-extrabold py-2.5 px-3 rounded-2xl text-xs transition flex items-center justify-center space-x-1"
                            >
                              <span>Book Slot</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleShowRouteInApp(station)}
                              className="bg-[#070b14] hover:bg-slate-800 text-cyan-300 border border-slate-700 font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Show Route</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* IN-APP LEAFLET MAP VIEW */}
            {viewMode === 'map' && (
              <div className="bg-[#0c1322] border border-slate-800 rounded-3xl overflow-hidden shadow-xl p-2 h-[550px] relative">
                <div className="absolute top-4 right-4 z-[400] bg-[#070b14]/90 backdrop-blur border border-cyan-500/20 p-2 rounded-xl flex items-center gap-2 shadow-lg">
                  <span className="text-xs text-cyan-300 font-medium px-2">
                    In-App Routing Active
                  </span>
                  <button
                    onClick={() => setViewMode('grid')}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg"
                  >
                    Back to Grid
                  </button>
                </div>
                <EVMap
                  userLocation={userLocation}
                  stations={processedStations}
                  selectedStation={selectedMapStation}
                  onSelectStation={setSelectedMapStation}
                  onBookStation={setBookingModalStation}
                />
              </div>
            )}
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0c1322] border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Total Sessions</p>
                <p className="text-2xl font-black text-white mt-1">{bookingsHistory.length}</p>
              </div>
              <div className="bg-[#0c1322] border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Estimated Energy</p>
                <p className="text-2xl font-black text-lime-300 mt-1">{totalEnergy} kWh</p>
              </div>
              <div className="bg-[#0c1322] border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Total Spent</p>
                <p className="text-2xl font-black text-cyan-300 mt-1">₹{totalRevenue}</p>
              </div>
            </div>

            <div className="bg-[#0c1322] border border-slate-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>Booking Receipts</span>
              </h2>
              {bookingsHistory.length === 0 ? (
                <p className="text-xs text-slate-400">No bookings yet. Reserve a slot from Explore.</p>
              ) : (
                <div className="space-y-3">
                  {bookingsHistory.map((b, i) => (
                    <div
                      key={b._id || b.bookingId || i}
                      className="bg-[#070b14] border border-slate-800 p-4 rounded-2xl space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-cyan-300">{b.bookingId}</p>
                          <p className="text-sm font-bold text-white">{b.stationName}</p>
                          <p className="text-xs text-slate-400">
                            {b.connector} • {b.slotTime}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-sm font-black text-lime-300">₹{b.cost}</p>
                          <p className="text-[11px] text-slate-400">{b.date}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => handlePrintBooking(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c1322] hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                        >
                          <Printer className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Print Receipt</span>
                        </button>

                        <button
                          onClick={() => handleShareBooking(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c1322] hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                        >
                          <Share2 className="w-3.5 h-3.5 text-lime-300" />
                          <span>Share</span>
                        </button>

                        <button
                          onClick={() => handleDeleteBooking(b)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-800 transition ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE CHARGING SESSION TAB */}
        {activeTab === 'session' && activeSession && (
          <div className="bg-[#0c1322] border border-cyan-400/30 rounded-3xl p-8 max-w-xl mx-auto text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 text-lime-300 mx-auto animate-pulse" />
            <h2 className="text-xl font-black text-white">Charging Session Active</h2>
            <p className="text-sm text-slate-300">{activeSession.station.name}</p>
            <p className="text-xs text-slate-400">
              {activeSession.port} • {activeSession.time}
            </p>
            <button
              onClick={() => {
                setActiveSession(null);
                setActiveTab('explore');
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl"
            >
              Stop Charging Session
            </button>
          </div>
        )}

        {/* PARTNER REGISTRATION TAB */}
        {activeTab === 'admin' && (
          <div className="bg-[#0c1322] border border-slate-800 rounded-3xl p-6 max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <span>Register Partner Charging Hub</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Station Name"
                value={newStation.name}
                onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="District (e.g. Solapur)"
                value={newStation.district}
                onChange={(e) => setNewStation({ ...newStation, district: e.target.value })}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Address"
                value={newStation.address}
                onChange={(e) => setNewStation({ ...newStation, address: e.target.value })}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white sm:col-span-2"
              />
              <input
                type="text"
                placeholder="Connector (e.g. CCS2 60kW DC)"
                value={newStation.connector}
                onChange={(e) => setNewStation({ ...newStation, connector: e.target.value })}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Price per kWh (₹)"
                value={newStation.price}
                onChange={(e) => setNewStation({ ...newStation, price: e.target.value })}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
            <button
              onClick={handleAddStationDB}
              className="w-full bg-gradient-to-r from-cyan-400 to-lime-300 hover:brightness-105 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs"
            >
              Publish Charging Station
            </button>
          </div>
        )}
      </main>

      {/* BOOKING MODAL */}
      {bookingModalStation && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c1322] border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Reserve Charging Slot</h3>
              <button
                onClick={() => !isPaying && setBookingModalStation(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400">{bookingModalStation.name}</p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Select Port</label>
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option>Port 1 (Fast DC 60kW)</option>
                  <option>Port 2 (Type 2 AC 22kW)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Select Time Slot</label>
                <select
                  value={selectedTimeSlot}
                  onChange={(e) => setSelectedTimeSlot(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option>10:00 AM - 11:00 AM</option>
                  <option>11:00 AM - 12:00 PM</option>
                  <option>02:00 PM - 03:00 PM</option>
                  <option>06:00 PM - 07:00 PM</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => handlePayment(bookingModalStation)}
              disabled={isPaying}
              className="w-full bg-gradient-to-r from-cyan-400 to-lime-300 hover:brightness-105 text-slate-950 font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isPaying
                  ? 'Confirming Booking...'
                  : `Confirm & Pay ₹${bookingModalStation.price}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c1322] border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {isSignUp ? 'Create Driver Account' : 'Driver Sign In'}
              </h3>
              <button
                onClick={() => !isAuthSubmitting && setAuthModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {isSignUp && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              )}
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full bg-gradient-to-r from-cyan-400 to-lime-300 hover:brightness-105 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs disabled:opacity-60"
              >
                {isAuthSubmitting
                  ? isSignUp
                    ? 'Creating Account...'
                    : 'Signing In...'
                  : isSignUp
                  ? 'Sign Up'
                  : 'Sign In'}
              </button>
            </form>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-xs text-cyan-300 hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'New driver? Create an account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
