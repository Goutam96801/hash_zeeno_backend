const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const twilio = require('twilio');
const UserSchema = require('./UserSchema');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 5000;
const allowedOrigins = [
  'https://hash-zeeno-frontend.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }));

  app.get('/', (req, res) => {
    res.send('Socket.IO server is running.');
  });

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'], // WebSocket with fallback to polling
  });
  

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('message', (data) => {
        console.log('Received message:', data);
        // Broadcast message to all connected clients
        io.emit('message', data);
      });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});


app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, {
    autoIndex: true
});

// Initialize Twilio Client
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Send OTP to User
app.post('/sendOtp', async (req, res) => {
    const { mobileNumber } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    let user = await UserSchema.findOne({ mobileNumber });

    if (user) {
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60000); // OTP valid for 10 minutes
        await user.save();
    } else {
        user = await new UserSchema({ mobileNumber, otp, otpExpires: new Date(Date.now() + 10 * 60000) }).save();
    }

    client.messages.create({
        body: `Your OTP is ${otp}`,
        from: '+1 856 422 3316', // Twilio phone number
        to: `+91${mobileNumber}` // Indian mobile number format
    })
    .then(message => console.log(message.sid))
    .catch(error => console.error(error));

    res.status(200).json({ message: 'OTP sent' });
});

// Verify OTP and handle login/registration
app.post('/verifyOtp', async (req, res) => {
    const { mobileNumber, otp } = req.body;
    const user = await UserSchema.findOne({ mobileNumber });

    if (user && user.otp === otp && user.otpExpires > Date.now()) {
        user.isOnline = true;
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        if (user.name && user.age) {
            res.status(200).json({ message: 'Login successful', userExists: true });
        } else {
            return res.status(200).json({ message: 'OTP verified, registration required', userExists: false });
        }
    } else {
        return res.status(401).json({ message: 'Invalid OTP or OTP expired' });
    }
});

// Register new user after OTP verification
app.post('/register', async (req, res) => {
    const { mobileNumber, name, age, gender, email } = req.body;

    const user = await UserSchema.findOne({ mobileNumber });

    if (user) {
        user.name = name;
        user.age = age;
        user.gender = gender;
        user.email = email;
        await user.save();

        return res.status(200).json({ message: 'Registration successful', user });
        
    } else {
        return res.status(404).json({ message: 'User not found' });
    }
});

app.get('/userDetails', async (req, res) => {
    const { mobileNumber } = req.query;  // Assuming you are passing mobileNumber as a query param

    try {
        const user = await UserSchema.findOne({ mobileNumber });
        if (user) {
            res.status(200).json({
                name: user.name,
                email: user.email,
                age: user.age,
                gender: user.gender,
                mobileNumber: user.mobileNumber,
                isOnline: user.isOnline,
                lastLocation: user.lastLocation,
            });
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Route to update user's real-time location
app.post('/updateLocation', async (req, res) => {
    const { mobileNumber, latitude, longitude } = req.body;

    try {
        const user = await UserSchema.findOne({ mobileNumber });
        if (user) {
            user.lastLocation = {
                latitude,
                longitude,
                timestamp: new Date(),
            };
            await user.save();
            return res.status(200).json({ message: 'Location updated successfully' });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
});

// Route to get user's latest location
app.get('/getLocation', async (req, res) => {
    const { mobileNumber } = req.query;

    try {
        const user = await UserSchema.findOne({ mobileNumber });
        if (user && user.lastLocation.latitude && user.lastLocation.longitude) {
            return res.status(200).json({
                latitude: user.lastLocation.latitude,
                longitude: user.lastLocation.longitude,
                timestamp: user.lastLocation.timestamp,
            });
        } else {
            return res.status(404).json({ message: 'Location data not found for this user' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
});

app.get('/getAllUsers', async (req, res) => {
    try {
        const users = await UserSchema.find({"otp": null}, '-otp -otpExpires'); // Exclude sensitive fields like OTP
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

// SOS trigger route
app.post('/triggerSOS', async (req, res) => {
    const { mobileNumber } = req.body;  // Get mobile number from the request body

    try {
        const user = await UserSchema.findOne({ mobileNumber });
        if (user) {
            // Emit an SOS alert event to the website via WebSocket
            io.emit('sosAlert', {
                name: user.name,
                email: user.email,
                mobileNumber: user.mobileNumber,
                location: user.lastLocation,  // Use lastLocation for tracking
                message: 'User is in danger!',
            });
            res.status(200).send('SOS alert sent');
            console.log('SOS alert sent')
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// WebSocket connection
io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log("Server is running at PORT: " + PORT);
});
