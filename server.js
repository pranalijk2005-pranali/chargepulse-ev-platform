const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Root health/status route
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'ChargePulse EV Platform API',
    status: 'running'
  });
});

// 📦 MongoDB Connection & Secrets
const MONGODB_URI = 'mongodb+srv://ev_admin:evpass1234@cluster0.u596shs.mongodb.net/chargepulse_mh?retryWrites=true&w=majority';
const JWT_SECRET = 'chargepulse_mh_super_secret_jwt_key_2026';

// --- Database Schemas & Models ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const stationSchema = new mongoose.Schema({
  stationId: { type: String, unique: true, required: true },
  name: String,
  district: String,
  taluka: String,
  address: String,
  lat: Number,
  lng: Number,
  type: String,
  connector: String,
  price: Number,
  portsTotal: Number,
  portsAvail: Number,
  operator: String
});

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true, required: true },
  stationId: String,
  stationName: String,
  connector: String,
  slotTime: String,
  cost: Number,
  date: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Station = mongoose.model('Station', stationSchema);
const Booking = mongoose.model('Booking', bookingSchema);

// --- Socket.io Real-Time Connection ---
io.on('connection', (socket) => {
  console.log('⚡ Client connected to ChargePulse Real-Time Engine:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 🌱 Initial Database Seeding Routine
async function seedDatabase() {
  try {
    const count = await Station.countDocuments();
    if (count === 0) {
      const initialStations = [
        // 📍 SOLAPUR & PANDHARPUR
        {
          stationId: 'ST-SOL-01',
          name: 'Tata Power - Balaji Sarovar Premiere',
          district: 'Solapur',
          taluka: 'Solapur',
          address: 'Aasara Chowk, Hotgi Rd, Model Colony, Solapur, MH 413003',
          lat: 17.6377,
          lng: 75.9184,
          type: 'Both',
          connector: 'CCS2 30kW DC / Type 2 AC',
          price: 18,
          portsTotal: 3,
          portsAvail: 2,
          operator: 'Tata Power EZ Charge'
        },
        {
          stationId: 'ST-SOL-02',
          name: 'MSEDCL - MIDC Substation EV Charging Hub',
          district: 'Solapur',
          taluka: 'Solapur',
          address: 'MIDC Industrial Area, Solapur, MH 413006',
          lat: 17.6604,
          lng: 75.9334,
          type: 'Both',
          connector: 'CCS2 60kW DC / CHAdeMO',
          price: 13,
          portsTotal: 4,
          portsAvail: 3,
          operator: 'MSEDCL / Plugeasy'
        },
        {
          stationId: 'ST-SOL-03',
          name: 'Jio-bp pulse Station - Kegaon NH-52',
          district: 'Solapur',
          taluka: 'Kegaon',
          address: 'NH-52 Pune-Solapur Highway, Kegaon, Solapur, MH 413255',
          lat: 17.6892,
          lng: 75.8450,
          type: 'Both',
          connector: 'CCS2 120kW Fast DC',
          price: 14,
          portsTotal: 4,
          portsAvail: 3,
          operator: 'Jio-bp pulse'
        },
        {
          stationId: 'ST-PND-01',
          name: 'Swastik EV Fast Charging Station',
          district: 'Pandharpur',
          taluka: 'Pandharpur',
          address: 'Beside Ashwamedha Hotel, Link Road, Pandharpur, MH 413304',
          lat: 17.6754,
          lng: 75.3125,
          type: 'Both',
          connector: 'CCS2 60kW DC / Type 2 AC',
          price: 15,
          portsTotal: 2,
          portsAvail: 2,
          operator: 'Bolt.Earth'
        },
        {
          stationId: 'ST-PND-02',
          name: 'Jio-bp pulse Station - Pandharpur Highway',
          district: 'Pandharpur',
          taluka: 'Pandharpur',
          address: 'Mangalwedha-Bijapur Road, Pandharpur, MH 413304',
          lat: 17.6710,
          lng: 75.3280,
          type: 'Both',
          connector: 'CCS2 60kW Fast DC',
          price: 16,
          portsTotal: 4,
          portsAvail: 4,
          operator: 'Jio-bp pulse'
        },

        // 📍 PUNE & PCMC
        {
          stationId: 'ST-PUN-01',
          name: 'ChargeZone - Wakad Expressway Hub',
          district: 'Pune',
          taluka: 'Pimpri-Chinchwad',
          address: 'Old Mumbai-Pune Highway, Wakad, Pune, MH 411057',
          lat: 18.5987,
          lng: 73.7628,
          type: 'Car',
          connector: 'CCS2 120kW Supercharger',
          price: 19,
          portsTotal: 6,
          portsAvail: 4,
          operator: 'ChargeZone'
        },
        {
          stationId: 'ST-PUN-02',
          name: 'Tata Power - Viman Nagar Phoenix Station',
          district: 'Pune',
          taluka: 'Haveli',
          address: 'Sakore Nagar, Viman Nagar, Pune, MH 411014',
          lat: 18.5679,
          lng: 73.9143,
          type: 'Both',
          connector: 'CCS2 60kW DC / Type 2 AC',
          price: 18,
          portsTotal: 4,
          portsAvail: 2,
          operator: 'Tata Power EZ Charge'
        },
        {
          stationId: 'ST-PUN-03',
          name: 'Statiq EV Charging Station - Hinjewadi Phase 1',
          district: 'Pune',
          taluka: 'Mulshi',
          address: 'Rajiv Gandhi Infotech Park, Hinjewadi, Pune, MH 411057',
          lat: 18.5912,
          lng: 73.7389,
          type: 'Both',
          connector: 'CCS2 60kW DC',
          price: 17,
          portsTotal: 4,
          portsAvail: 3,
          operator: 'Statiq'
        },

        // 📍 MUMBAI & THANE / NAVI MUMBAI
        {
          stationId: 'ST-MUM-01',
          name: 'GO EC - BKC G-Block Fast Hub',
          district: 'Mumbai Suburban',
          taluka: 'Bandra',
          address: 'Bandra Kurla Complex, G Block, Bandra East, Mumbai, MH 400051',
          lat: 19.0657,
          lng: 72.8686,
          type: 'Car',
          connector: 'CCS2 60kW Fast DC',
          price: 20,
          portsTotal: 6,
          portsAvail: 5,
          operator: 'GO EC'
        },
        {
          stationId: 'ST-MUM-02',
          name: 'Tata Power - Mahalaxmi Racecourse Hub',
          district: 'Mumbai City',
          taluka: 'Byculla',
          address: 'Keshavrao Khadye Marg, Mahalaxmi, Mumbai, MH 400034',
          lat: 18.9823,
          lng: 72.8197,
          type: 'Both',
          connector: 'CCS2 60kW DC',
          price: 19,
          portsTotal: 4,
          portsAvail: 2,
          operator: 'Tata Power EZ Charge'
        },
        {
          stationId: 'ST-NVM-01',
          name: 'Tata Power - MIDC Nerul Substation',
          district: 'Thane',
          taluka: 'Navi Mumbai',
          address: 'MIDC Industrial Area, Nerul, Navi Mumbai, MH 400706',
          lat: 19.0330,
          lng: 73.0297,
          type: 'Both',
          connector: 'CCS2 / Type 2 22kW AC',
          price: 17,
          portsTotal: 4,
          portsAvail: 3,
          operator: 'Tata Power EZ Charge'
        },

        // 📍 NASHIK
        {
          stationId: 'ST-NSK-01',
          name: 'ChargeZone - Pathardi Phata Expressway',
          district: 'Nashik',
          taluka: 'Nashik',
          address: 'Mumbai-Agra National Highway, Pathardi Phata, Nashik, MH 422010',
          lat: 19.9538,
          lng: 73.7682,
          type: 'Both',
          connector: 'CCS2 60kW DC',
          price: 18,
          portsTotal: 4,
          portsAvail: 2,
          operator: 'ChargeZone'
        },
        {
          stationId: 'ST-NSK-02',
          name: 'Jio-bp pulse - Tapovan Nashik Road',
          district: 'Nashik',
          taluka: 'Nashik',
          address: 'Tapovan Link Road, Nashik, MH 422101',
          lat: 19.9975,
          lng: 73.8112,
          type: 'Both',
          connector: 'CCS2 60kW Fast DC',
          price: 17,
          portsTotal: 3,
          portsAvail: 3,
          operator: 'Jio-bp pulse'
        },

        // 📍 NAGPUR
        {
          stationId: 'ST-NGP-01',
          name: 'Tata Power - Sitabuldi Interchange Station',
          district: 'Nagpur',
          taluka: 'Nagpur Urban',
          address: 'Sitabuldi Metro Station Parking, Nagpur, MH 440012',
          lat: 21.1458,
          lng: 79.0882,
          type: 'Both',
          connector: 'CCS2 60kW DC / Type 2 AC',
          price: 17,
          portsTotal: 4,
          portsAvail: 3,
          operator: 'Tata Power EZ Charge'
        },
        {
          stationId: 'ST-NGP-02',
          name: 'ChargeZone - Wardha Road Highway Hub',
          district: 'Nagpur',
          taluka: 'Nagpur Rural',
          address: 'Near Airport Metro Station, Wardha Road, Nagpur, MH 440005',
          lat: 21.0938,
          lng: 79.0604,
          type: 'Car',
          connector: 'CCS2 120kW Supercharger',
          price: 19,
          portsTotal: 6,
          portsAvail: 5,
          operator: 'ChargeZone'
        },

        // 📍 CHHATRAPATI SAMBHAJINAGAR (AURANGABAD)
        {
          stationId: 'ST-AUR-01',
          name: 'Jio-bp Pulse - Jalna Road Hub',
          district: 'Chhatrapati Sambhajinagar',
          taluka: 'Chhatrapati Sambhajinagar',
          address: 'Jalna Road, Opposite Airport, Chhatrapati Sambhajinagar, MH 431001',
          lat: 19.8762,
          lng: 75.3850,
          type: 'Both',
          connector: 'CCS2 60kW DC',
          price: 17,
          portsTotal: 4,
          portsAvail: 4,
          operator: 'Jio-bp pulse'
        },

        // 📍 KOLHAPUR
        {
          stationId: 'ST-KOL-01',
          name: 'ChargeZone x TATA.ev - GPT Complex',
          district: 'Kolhapur',
          taluka: 'Karveer',
          address: 'Old Pune-Bangalore Highway, GPT Complex, Kolhapur, MH 416004',
          lat: 16.7050,
          lng: 74.2433,
          type: 'Car',
          connector: 'CCS2 120kW Fast DC',
          price: 18,
          portsTotal: 4,
          portsAvail: 3,
          operator: 'ChargeZone x TATA.ev'
        }
      ];
      await Station.insertMany(initialStations);
      console.log('🌱 Seeded Maharashtra EV stations into MongoDB!');
    }
  } catch (err) {
    console.error('❌ Seeding error:', err);
  }
}

// --- API Endpoints ---

// 🔐 1. User Signup (JWT + MongoDB)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔐 2. User Login (JWT + MongoDB)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get all stations
app.get('/api/stations', async (req, res) => {
  try {
    const stations = await Station.find({});
    res.json({ success: true, stations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Book a slot & broadcast live update via Socket.io
app.post('/api/stations/book', async (req, res) => {
  try {
    const { stationId } = req.body;
    const station = await Station.findOne({ stationId });
    if (station && station.portsAvail > 0) {
      station.portsAvail -= 1;
      await station.save();

      // Broadcast real-time update to all connected clients
      io.emit('station_updated', {
        stationId: station.stationId,
        portsAvail: station.portsAvail,
        timestamp: new Date()
      });
    }
    res.json({ success: true, station });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Register a new partner station
app.post('/api/stations', async (req, res) => {
  try {
    const newStation = new Station({
      stationId: `ST-PARTNER-${Date.now().toString().slice(-4)}`,
      ...req.body,
      lat: Number(req.body.lat) || 18.5204,
      lng: Number(req.body.lng) || 73.8567,
      price: Number(req.body.price) || 16,
      portsTotal: Number(req.body.portsTotal) || 4,
      portsAvail: Number(req.body.portsTotal) || 4,
      operator: 'Partner Network'
    });
    await newStation.save();
    res.json({ success: true, station: newStation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Create dummy payment order ID
app.post('/api/payments/create-order', (req, res) => {
  res.json({ success: true, orderId: `order_${Date.now()}` });
});

// 7. Verify payment & save booking
app.post('/api/payments/verify', async (req, res) => {
  try {
    const booking = new Booking({
      bookingId: `BK-${Date.now().toString().slice(-6)}`,
      ...req.body,
      date: new Date().toLocaleDateString()
    });
    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get bookings history
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Delete a booking by MongoDB _id or bookingId
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const query = isValidObjectId
      ? { $or: [{ _id: id }, { bookingId: id }] }
      : { bookingId: id };

    const deletedBooking = await Booking.findOneAndDelete(query);

    if (!deletedBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (deletedBooking.stationId) {
      const updatedStation = await Station.findOneAndUpdate(
        {
          stationId: deletedBooking.stationId,
          $expr: { $lt: ['$portsAvail', '$portsTotal'] }
        },
        { $inc: { portsAvail: 1 } },
        { new: true }
      );

      if (updatedStation) {
        io.emit('station_updated', {
          stationId: updatedStation.stationId,
          portsAvail: updatedStation.portsAvail,
          timestamp: new Date()
        });
      }
    }

    return res.json({
      success: true,
      message: 'Booking deleted successfully',
      deleted: deletedBooking
    });
  } catch (err) {
    console.error('❌ Error deleting booking:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- Server Startup Sequence (Ensures DB is connected before listening) ---
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { family: 4 });
    console.log('📦 Connected to MongoDB successfully!');

    // Run seed routine after connection is confirmed
    await seedDatabase();

    // Note: Use server.listen (not app.listen) so Socket.io works!
    server.listen(PORT, () => {
      console.log(`🚀 ChargePulse Server with Socket.io & Auth running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server. Check your connection string.');
    console.error(err);
  }
}

startServer();
