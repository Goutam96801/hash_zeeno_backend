import mongoose, { Schema } from "mongoose";
const userSchema = mongoose.Schema({
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
    gender:{
        type:String
    }
},
    {
        timestamps: {
            createdAt: 'createdAt'
        }
    }
)

export default mongoose.model("users", userSchema);