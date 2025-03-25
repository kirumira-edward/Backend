# Tomato Blight AI Assessment System - Backend

This repository contains the backend API for the Tomato Blight AI Assessment System, a solution designed to help farmers monitor environmental conditions and assess the risk of early and late blight in tomato crops.

## Features

- Real-time environmental data collection from weather APIs and soil sensors
- Blight risk assessment using Cumulative Risk Index (CRI)
- Authentication and user management for farmers
- Personalized environmental data tracking
- Historical data analysis with trend reporting
- Location-based data collection

## Prerequisites

- Node.js (v16+)
- MongoDB database
- OpenWeather API key
- ThingSpeak API key (optional, for soil moisture)
- Resend API key (for email verification)
- Cloudinary account (for image storage)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tomato-blight-backend.git
cd tomato-blight-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
# MongoDB Connection
MONGO_URI=your_mongodb_connection_string

# JWT Secrets
JWT_SECRET=your_jwt_secret_key
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL
FRONTEND_URL=http://localhost:8080

# Environment
NODE_ENV=development

# Resend Email Service 
RESEND_API_KEY=your_resend_api_key

# OpenWeather API
OPENWEATHER_API_KEY=your_openweather_api_key

# ThingSpeak API (Optional for soil moisture)
THINGSPEAK_API_KEY=your_thingspeak_api_key
THINGSPEAK_CHANNEL=your_channel_id
```

4. Start the server:
```bash
npm start
```

The server will start on port 5000 by default or the port specified in your environment variables.

## API Documentation

### Authentication Endpoints

#### Register a new farmer
**URL:** `/api/register`  
**Method:** `POST`  
**Authentication:** None  
**Request Body:**
```json
{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "securepassword"
}
```

**Response:**
```json
{
    "message": "Farmer registered successfully. Please check your email for verification code.",
    "email": "john@example.com"
}
```

#### Verify email with code
**URL:** `/api/verify-email`  
**Method:** `POST`  
**Authentication:** None  
**Request Body:**
```json
{
    "email": "john@example.com",
    "code": "123456"
}
```

**Response:**
```json
{
    "message": "Email verified successfully. You can now log in."
}
```

#### Resend verification code
**URL:** `/api/resend-verification`  
**Method:** `POST`  
**Authentication:** None  
**Request Body:**
```json
{
    "email": "john@example.com"
}
```

**Response:**
```json
{
    "message": "Verification code resent. Please check your email."
}
```

#### Login
**URL:** `/api/login`  
**Method:** `POST`  
**Authentication:** None  
**Request Body:**
```json
{
    "email": "john@example.com",
    "password": "securepassword"
}
```

**Response:**
```json
{
    "accessToken": "your_jwt_token",
    "user": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "profilePhoto": "profile_url"
    },
    "message": "Login successful."
}
```

#### Refresh token
**URL:** `/api/refresh-token`  
**Method:** `POST`  
**Authentication:** None  
**Request Body:**
```json
{
    "refreshToken": "your_refresh_token"  // Optional if sent as cookie
}
```

**Response:**
```json
{
    "accessToken": "new_jwt_token"
}
```

#### Logout
**URL:** `/api/logout`  
**Method:** `POST`  
**Authentication:** Bearer Token  
**Response:**
```json
{
    "message": "Logged out successfully."
}
```

### User Profile Endpoints

#### Get user profile
**URL:** `/api/user`  
**Method:** `GET`  
**Authentication:** Bearer Token  
**Response:**
```json
{
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "profilePhoto": "profile_url",
    "defaultLocation": {
        "latitude": 0.3321332652604399,
        "longitude": 32.570457568263755
    },
    "isVerified": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-02T00:00:00.000Z"
}
```

#### Upload profile photo
**URL:** `/api/user/photo`  
**Method:** `PUT`  
**Authentication:** Bearer Token  
**Request Body:**
```json
{
    "image": "base64_encoded_image_data"
}
```

**Response:**
```json
{
    "message": "Profile photo updated successfully.",
    "profilePhoto": "cloudinary_image_url"
}
```

### Environmental Data Endpoints

#### Get latest environmental data
**URL:** `/api/environmental/latest`  
**Method:** `GET`  
**Authentication:** Optional (personalized data if authenticated)  
**Response:**
```json
{
    "date": "2023-05-20T00:00:00.000Z",
    "currentConditions": {
        "temperature": "24.5°C",
        "humidity": "65%",
        "rainfall": "2.1mm",
        "soilMoisture": "45%"
    },
    "cri": 48.75,
    "riskLevel": "Low",
    "percentageChanges": {
        "daily": {
            "temperature": 2.1,
            "humidity": -5.2,
            "rainfall": 100,
            "soilMoisture": 12.5,
            "cri": 3.8
        },
        "weekly": {
            "temperature": 5.3,
            "humidity": -8.7,
            "rainfall": 200,
            "soilMoisture": 15.0,
            "cri": 8.2
        },
        "monthly": {
            "temperature": 10.5,
            "humidity": -12.3,
            "rainfall": 150,
            "soilMoisture": 20.1,
            "cri": 12.5
        }
    }
}
```

#### Get environmental data within a date range
**URL:** `/api/environmental/range`  
**Method:** `GET`  
**Authentication:** Bearer Token  
**Query Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `locationId`: Optional location identifier

**Response:** Array of environmental data records

#### Get CRI history and trends
**URL:** `/api/environmental/cri-history`  
**Method:** `GET`  
**Authentication:** Bearer Token  
**Query Parameters:**
- `period`: "week", "month", or "quarter" (default: "month")
- `locationId`: Optional location identifier

**Response:**
```json
{
    "history": [
        {
            "date": "2023-05-01T00:00:00.000Z",
            "cri": 45.2,
            "riskLevel": "Low",
            "percentageChanges": {
                "daily": {
                    "cri": 1.2
                }
            }
        }
        // Additional daily records...
    ],
    "trend": {
        "averageChange": 2.5,
        "direction": "increasing"
    }
}
```

#### Update user location
**URL:** `/api/environmental/update-location`  
**Method:** `POST`  
**Authentication:** Bearer Token  
**Request Body:**
```json
{
    "latitude": 0.3321332652604399,
    "longitude": 32.570457568263755
}
```

**Response:**
```json
{
    "message": "Location updated successfully",
    "coordinates": {
        "latitude": 0.3321332652604399,
        "longitude": 32.570457568263755
    }
}
```

#### Refresh environmental data
**URL:** `/api/environmental/refresh`  
**Method:** `POST`  
**Authentication:** Bearer Token  
**Request Body:**
```json
{
    "coordinates": {  // Optional
        "latitude": 0.3321332652604399,
        "longitude": 32.570457568263755
    }
}
```

**Response:**
```json
{
    "message": "Environmental data refreshed successfully",
    "data": {
        // Full environmental data record
    }
}
```

## CRI (Cumulative Risk Index) Calculation

The system calculates a Cumulative Risk Index (CRI) on a scale of 1-100:

- **50**: Baseline (healthy plants)
- **<50**: Early blight risk (lower value = higher risk)
- **>50**: Late blight risk (higher value = higher risk)

Risk levels are categorized as:

- **Low**: Minor risk
- **Medium**: Moderate risk
- **High**: Significant risk
- **Critical**: Severe risk

The CRI is calculated based on temperature, humidity, and soil moisture, with each factor having specific influence on early or late blight risk.
