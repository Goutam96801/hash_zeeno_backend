const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    mobileNumber: {
        type: String,
        required: true,
        unique: true
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastLocation: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        timestamp: { type: Date, default: null },
    },
    name: {
        type: String
    },
    email: {
        type: String
    },
    age: {
        type: Number
    },
    gender: {
        type: String
    }
},
{
    timestamps: {
        createdAt: 'createdAt'
    }
});

module.exports = mongoose.model("users", userSchema);
