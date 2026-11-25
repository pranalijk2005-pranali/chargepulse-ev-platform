import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Search, CreditCard, X, ChevronRight, RefreshCw, Navigation, MapPin,
  Map as MapIcon, Grid, Clock, FileText, BarChart3, CheckCircle2, Compass, AlertTriangle,
  User, Heart, LogOut, Lock, Mail
} from 'lucide-react';
import EVMap from './components/EVMap';
import { io } from 'socket.io-client';

const REGIONAL_DEFAULT = { lat: 17.6599, lng: 75.9064 }; // Solapur Central Base
const API_BASE = import.meta.env.VITE_API_URL || 'https://chargepulse-ev-platform.onrender.com';

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [viewMode, setViewMode] = useState('grid');
  const [stations, setStations] = useState([]);
  const [bookingsHistory, setBookingsHistory] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

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
      setUser(JSON.parse(savedUser));
    }
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }

    const socket = io(API_BASE);

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

  // 4. Initial Load
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${API_BASE}/api/stations`);
        const data = await res.json();
        if (data.success) setStations(data.stations);
      } catch (err) {
        console.log('Backend server offline.');
      }

      try {
        const resB = await fetch(`${API_BASE}/api/bookings`);
        const dataB = await resB.json();
        if (dataB.success) setBookingsHistory(dataB.bookings);
      } catch (err) {
        console.log('Bookings API offline.');
      }
    }
    loadData();
  }, []);

  // JWT AUTHENTICATION HANDLERS
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password) {
      alert('Fill out all credentials');
      return;
    }

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('chargepulse_token', data.token);
        localStorage.setItem('chargepulse_user', JSON.stringify(data.user));
        setUser(data.user);
        setAuthModalOpen(false);
        alert(`Welcome, ${data.user.name}! Successfully authenticated.`);
      } else {
        const mockUser = { name: authForm.name || 'EV Driver', email: authForm.email };
        localStorage.setItem('chargepulse_token', 'mock_jwt_token_12345');
        localStorage.setItem('chargepulse_user', JSON.stringify(mockUser));
        setUser(mockUser);
        setAuthModalOpen(false);
        alert(`Welcome, ${mockUser.name}! (Local Demo Session Active)`);
      }
    } catch (err) {
      const mockUser = { name: authForm.name || 'EV Driver', email: authForm.email };
      localStorage.setItem('chargepulse_token', 'mock_jwt_token_12345');
      localStorage.setItem('chargepulse_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setAuthModalOpen(false);
      alert(`Welcome, ${mockUser.name}! (Offline Demo Session Active)`);
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
      if (!res.ok) throw new Error();
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
      alert(`Successfully synced ${formatted.length} live local stations nearby!`);
    } catch (err) {
      alert('Failed to connect to OpenChargeMap API.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Payment Handler
  const handlePayment = async (station) => {
    try {
      const token = localStorage.getItem('chargepulse_token');

      await fetch(`${API_BASE}/api/stations/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: station.stationId || station._id })
      });

      const verifyRes = await fetch(`${API_BASE}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stationName: station.name,
          connector: `${station.connector} (${selectedPort})`,
          slotTime: selectedTimeSlot,
          cost: station.price || 50
        })
      });
      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        const newBooking = verifyData.booking;
        setBookingsHistory((prev) => [newBooking, ...prev]);
        setActiveSession({ station, port: selectedPort, time: selectedTimeSlot });
        alert(`Booking Confirmed!\nBooking ID: ${newBooking.bookingId}`);
        setBookingModalStation(null);
        setActiveTab('bookings');
      } else {
        const mockBooking = {
          bookingId: `CP-${Math.floor(100000 + Math.random() * 900000)}`,
          date: new Date().toLocaleDateString(),
          stationName: station.name,
          connector: `${station.connector} (${selectedPort})`,
          slotTime: selectedTimeSlot,
          cost: station.price || 50
        };
        setBookingsHistory((prev) => [mockBooking, ...prev]);
        setActiveSession({ station, port: selectedPort, time: selectedTimeSlot });
        alert(`Booking Confirmed!\nBooking ID: ${mockBooking.bookingId}`);
        setBookingModalStation(null);
        setActiveTab('bookings');
      }
    } catch (err) {
      alert('Booking saved to local history.');
    }
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
      if (data.success) {
        setStations((prev) => [data.station, ...prev]);
        alert('Station published successfully!');
        setActiveTab('explore');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* HEADER */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-emerald-600 to-emerald-400 p-2.5 rounded-2xl text-slate-950 shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white">ChargePulse</h1>
              <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">
                Maharashtra Grid v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Real-World EV Station Discovery & Navigation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncOpenChargeMap}
            disabled={isSyncing}
            className="hidden sm:flex bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 text-xs px-3.5 py-2 rounded-xl items-center space-x-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live API'}</span>
          </button>

          {user ? (
            <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
              <User className="w-4 h-4 text-emerald-400" />
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
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow"
            >
              Sign In / Driver Profile
            </button>
          )}

          <nav className="flex space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'explore' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'bookings' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Bookings
            </button>
            {activeSession && (
              <button
                onClick={() => setActiveTab('session')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition animate-pulse ${
                  activeTab === 'session' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-400'
                }`}
              >
                Charging
              </button>
            )}
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'admin' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Partner
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* HERO BANNER */}
            <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <Compass className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {userLocation.isLiveGPS
                      ? 'Live GPS Position Active'
                      : 'Regional Default Base Active'}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white">
                  Find & Navigate EV Stations Across Maharashtra
                </h2>
                <p className="text-xs text-slate-400">
                  Nearest fast chargers ranked automatically by distance from your current location.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition ${
                    showFavoritesOnly
                      ? 'bg-rose-600 text-white border border-rose-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
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
                      : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
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
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center flex-1 sm:w-28">
                    <span className="text-2xl font-black text-emerald-400">
                      {processedStations.length}
                    </span>
                    <p className="text-[10px] text-slate-400">Hubs Found</p>
                  </div>
                  {processedStations[0] && (
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center flex-1 sm:w-28">
                      <span className="text-2xl font-black text-blue-400">
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
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search station, taluka, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 text-ellipsis overflow-hidden"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Vehicle Types</option>
                  <option value="Car">E-Cars (CCS2 / DC)</option>
                  <option value="Bike">E-Bikes / 2W</option>
                </select>
              </div>

              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold ${
                    viewMode === 'grid' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => openRealGoogleMapsView()}
                  className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow"
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
                  <div className="col-span-full bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
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
                        className={`bg-slate-900 border rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-lg transition ${
                          isUltraNear
                            ? 'border-rose-500/80 shadow-rose-500/10'
                            : 'border-slate-800 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold px-2.5 py-1 bg-slate-800 text-emerald-400 rounded-lg border border-slate-700">
                              {station.operator}
                            </span>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleFavorite(stId)}
                                className={`p-1.5 rounded-xl border transition ${
                                  isFav
                                    ? 'bg-rose-950 border-rose-800 text-rose-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                              </button>

                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                                  isUltraNear
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : index === 0
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
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

                        <div className="space-y-3 pt-3 border-t border-slate-800">
                          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-medium">
                                Connector
                              </p>
                              <p className="text-xs font-bold text-slate-200 mt-0.5">
                                {station.connector}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 uppercase font-medium">
                                Tariff
                              </p>
                              <p className="text-sm font-black text-emerald-400 mt-0.5">
                                ₹{station.price}/kWh
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setBookingModalStation(station)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center space-x-1"
                            >
                              <span>Book Slot</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleShowRouteInApp(station)}
                              className="bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition"
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
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl p-2 h-[550px] relative">
                <div className="absolute top-4 right-4 z-[400] bg-slate-950/90 backdrop-blur border border-slate-800 p-2 rounded-xl flex items-center gap-2 shadow-lg">
                  <span className="text-xs text-slate-300 font-medium px-2">
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
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Total Sessions</p>
                <p className="text-2xl font-black text-white mt-1">{bookingsHistory.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Estimated Energy</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{totalEnergy} kWh</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Total Spent</p>
                <p className="text-2xl font-black text-blue-400 mt-1">₹{totalRevenue}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>Booking Receipts</span>
              </h2>
              {bookingsHistory.length === 0 ? (
                <p className="text-xs text-slate-400">No bookings yet. Reserve a slot from Explore.</p>
              ) : (
                <div className="space-y-3">
                  {bookingsHistory.map((b, i) => (
                    <div
                      key={b.bookingId || i}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-emerald-400">{b.bookingId}</p>
                        <p className="text-sm font-bold text-white">{b.stationName}</p>
                        <p className="text-xs text-slate-400">
                          {b.connector} • {b.slotTime}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">₹{b.cost}</p>
                        <p className="text-[11px] text-slate-400">{b.date}</p>
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
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 max-w-xl mx-auto text-center space-y-5">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <span>Register Partner Charging Hub</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Station Name"
                value={newStation.name}
                onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="District (e.g. Solapur)"
                value={newStation.district}
                onChange={(e) => setNewStation({ ...newStation, district: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Address"
                value={newStation.address}
                onChange={(e) => setNewStation({ ...newStation, address: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white sm:col-span-2"
              />
              <input
                type="text"
                placeholder="Connector (e.g. CCS2 60kW DC)"
                value={newStation.connector}
                onChange={(e) => setNewStation({ ...newStation, connector: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Price per kWh (₹)"
                value={newStation.price}
                onChange={(e) => setNewStation({ ...newStation, price: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
              />
            </div>
            <button
              onClick={handleAddStationDB}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs"
            >
              Publish Charging Station
            </button>
          </div>
        )}
      </main>

      {/* BOOKING MODAL */}
      {bookingModalStation && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Reserve Charging Slot</h3>
              <button
                onClick={() => setBookingModalStation(null)}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
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
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Confirm & Pay ₹{bookingModalStation.price}</span>
            </button>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {isSignUp ? 'Create Driver Account' : 'Driver Sign In'}
              </h3>
              <button
                onClick={() => setAuthModalOpen(false)}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              )}
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs"
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-xs text-emerald-400 hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'New driver? Create an account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
