# Donation Sharing Web Application

## Project Overview
A comprehensive donation sharing platform that connects donors with recipients through a role-based access system. Built with vanilla HTML, CSS, JavaScript frontend and Node.js + Express + MongoDB Atlas backend.

## Technology Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend**: Node.js + Express (single server.js file)
- **Database**: MongoDB Atlas
- **File Upload**: Multer for image handling
- **Scheduling**: node-cron for automated tasks

## Project Architecture

### Backend Structure
- **Single File Backend**: All backend logic contained in `server.js`
- **Database Models**: Product, Notification, User schemas using Mongoose
- **File Storage**: Local uploads directory for product images
- **Auto-timers**: Cron jobs for product lifecycle management

### Frontend Structure
- **Single Page Application**: All pages managed in `public/index.html`
- **Styling**: Complete responsive design in `public/styles.css`
- **Functionality**: Full application logic in `public/script.js`

## Key Features

### User Roles
1. **Admin**
   - View and moderate all products
   - Approve pending products
   - Monitor urgent products with visual indicators
   - Delete products

2. **Donor (Bixiye)**
   - Create product listings (status: Pending)
   - Receive in-app notifications for requests
   - Accept/reject requests via notification buttons
   - Track own products

3. **Recipient (Qaate/Guest)**
   - Browse available products (no login required)
   - Submit product requests
   - View product details

### Product Workflow
1. Donor creates product → Status: "Pending"
2. Admin approves → Status: "Available"
3. Recipient requests product → Status: "Requested"
4. Donor responds:
   - Accept → Status: "Delivered"
   - Reject → Status: "Available" + urgent flag + timer

### Auto-Timer System
- **24h timer**: First rejection, red border, pulse animation
- **48h timer**: Second phase, darker red border
- **96h timer**: Final phase, black border
- **Auto-deletion**: Products automatically deleted after timer expires

### Notification System
- Real-time in-app notifications for donors
- Notification polling every 30 seconds
- Visual badge counter for unread notifications
- Two-button response system (Yes/No)

## API Endpoints

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/donor/:donorId` - Get products by donor
- `POST /api/products` - Create new product (with image upload)
- `PATCH /api/products/:id/approve` - Approve product (admin)
- `POST /api/products/:id/request` - Request product (recipient)
- `DELETE /api/products/:id` - Delete product (admin)

### Notifications
- `GET /api/notifications/:donorId` - Get notifications for donor
- `POST /api/notifications/:id/respond` - Respond to product request

### Users
- `POST /api/users` - Register/login user
- `GET /api/users/:userId` - Get user details

## Database Schema

### Product
```javascript
{
  productImage: String (required),
  productName: String (required),
  contact: String (required),
  email: String (required),
  country: String (required),
  city: String (required),
  district: String (required),
  description: String (optional),
  status: Enum ['Pending', 'Available', 'Requested', 'Delivered', 'Rejected'],
  donorId: String (required),
  requesterId: String,
  urgentFlag: Enum ['none', '24h', '48h', '96h'],
  urgentFlagTime: Date,
  deleteAt: Date
}
```

### Notification
```javascript
{
  donorId: String (required),
  productId: ObjectId (required),
  requesterId: String (required),
  message: String (required),
  isRead: Boolean,
  createdAt: Date
}
```

### User
```javascript
{
  userId: String (required, unique),
  role: Enum ['admin', 'donor', 'recipient'],
  createdAt: Date
}
```

## Setup Instructions

### Prerequisites
- Node.js 20+
- MongoDB Atlas connection string

### Environment Variables
Set `MONGODB_URI` environment variable with your MongoDB Atlas connection string.

### Installation
1. Dependencies are already installed: express, mongoose, multer, cors, node-cron
2. Run: `node server.js`
3. Access: `http://localhost:3000`

## User Preferences
- Technology requirements: Strict vanilla JavaScript frontend, single-file Node.js backend
- Database: MongoDB Atlas preferred over in-memory storage
- File structure: Minimal files, consolidated backend logic
- Authentication: Simple role-based system without complex auth

## Recent Changes
- **System Updates** (August 11, 2025): Fixed critical user experience issues
  - Fixed page reload on delete - system now stays on current page
  - Added donor product editing for pending/approved products
  - Implemented contact/email hiding until request is made
  - Added automatic notification removal after donor response
  - Added 30-minute auto-unhide for requested products
- **Initial Implementation**: Complete donation sharing platform with all specified features
- **Backend**: Single server.js file with all API endpoints, database models, and auto-timers
- **Frontend**: Responsive SPA with role-based navigation and real-time features
- **File Upload**: Complete image upload system with preview and storage
- **Timer System**: Automated product lifecycle management with visual indicators

## Next Steps
1. Set up MongoDB Atlas connection
2. Configure environment variables
3. Test all user roles and workflows
4. Deploy to production environment