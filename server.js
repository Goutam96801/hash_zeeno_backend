// import express from 'express';
// import mongoose from 'mongoose';
// import cors from 'cors';
// import 'dotenv/config';
// import { nanoid } from 'nanoid';
// import twilio from 'twilio';
// import bodyParser from 'body-parser';
// import UserSchema from './UserSchema.js';

// const app = express();
// const PORT = 5000;

// app.use(express.json());
// app.use(cors());

// mongoose.connect(process.env.MONGODB_URL, {
//     autoIndex: true
// })

// const accountSid = process.env.TWILIO_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const client = twilio(accountSid, authToken);

// app.post('/sendOtp', async (req, res) => {
//     const {mobileNumber} = req.body;
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     const user = await UserSchema.findOne({mobileNumber});
//     if(user) {
//         user.otp = otp;
//         user.otpExpires = new Date(Date.now() + 10*60000) //otp valid for 10 minutes
//         await user.save();
//     }
//     else{
//         await new UserSchema({mobileNumber, otp, otpExpires: new Date(Date.now() + 10 * 60000)}).save();
//     }

//     // otp send to user
//     client.messages.create({
//         body: `Your OTP is ${otp}`,
//         from: '+1 856 422 3316',
//         to: `+91${mobileNumber}`
//     })
//     .then(message => console.log(message.sid))
//     .catch(error => console.error(error));

//     res.status(200).send('OTP sent');
// });

// app.post('/verifyOtp', async(req, res) => {
//     const {mobileNumber, otp} = req.body;
//     const user = await UserSchema.findOne({mobileNumber});

//     if (user && user.otp === otp && user.otpExpires > Date.now()) {
//         user.isOnline = true;
//         user.otp = null;
//         user.otpExpires = null;
//         await user.save();
//         res.status(200).send('Login successful');
//     } else {
//         res.status(401).send('Invalid OTP or OTP expired');
//     }
// })

// app.listen(PORT, () => {
//     console.log("Server is running at PORT: " + PORT);
// })


import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import { nanoid } from 'nanoid';
import twilio from 'twilio';
import bodyParser from 'body-parser';
import UserSchema from './UserSchema.js';

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

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
        // Update OTP if user already exists
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60000); // OTP valid for 10 minutes
        await user.save();
    } else {
        // Create new user with OTP
        user = await new UserSchema({ mobileNumber, otp, otpExpires: new Date(Date.now() + 10 * 60000) }).save();
    }

    // Send OTP to user's mobile number
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
            // User is already registered, login successful
            res.status(200).json({ message: 'Login successful', userExists: true });
        } else {
            // New user, registration needed
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
            // Send user details excluding sensitive info like OTP
            res.status(200).json({
                name: user.name, // Assuming name is stored in the user schema
                email: user.email,
                age:user.age,
                gender:user.gender,
                mobileNumber: user.mobileNumber,
                isOnline: user.isOnline,
                lastLocation:user.lastLocation,
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


app.listen(PORT, () => {
    console.log("Server is running at PORT: " + PORT);
});
