const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const API_BASE_URL = 'http://localhost:7000';
const PORT = process.env.PORT || 7000;
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// MongoDB Atlas connection (placeholder - user will need to provide connection string)
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/donation-sharing';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
    productImage: { type: String, required: true },
    productName: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    description: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['Pending', 'Available', 'Requested', 'Delivered', 'Rejected'], 
        default: 'Pending' 
    },
    donorId: { type: String, required: true },
    requesterId: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    urgentFlag: { type: String, enum: ['none', '24h', '48h', '96h'], default: 'none' },
    urgentFlagTime: { type: Date, default: null },
    deleteAt: { type: Date, default: null },

    // Field cusub oo lagu qarinayo products-ka admin profile
    isHiddenFromAdmin: { type: Boolean, default: false }
});


const Product = mongoose.model('Product', productSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
    donorId: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    requesterId: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// User Schema (simple role management)
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    role: { type: String, enum: ['admin', 'donor', 'recipient'], required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Routes

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

//today

// Get all products (for admin and recipients)
// app.get('/api/products', async (req, res) => {
//     try {
//         const { status, role } = req.query;
//         let filter = {};
        
//         if (role === 'recipient') {
//             filter.status = 'Available';
//         } else if (status) {
//             filter.status = status;
//         }
        
//         const products = await Product.find(filter).sort({ createdAt: -1 });
//         res.json(products);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// Get all products (for admin and recipients)
app.get('/api/products', async (req, res) => {
    try {
        const { status, role } = req.query;
        let filter = {};
        
        if (role === 'recipient') {
            // Recipients arkaan kaliya Available products
            filter.status = 'Available';
        } else if (status === 'pending') {
            // Admin arkaa pending products, laakiin ka saar kuwa la approve-gareeyay
            filter = { status: 'Pending', isHiddenFromAdmin: { $ne: true } };
        } else if (status) {
            filter.status = status;
        }
        
        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});





// Get products by donor
app.get('/api/products/donor/:donorId', async (req, res) => {
    try {
        const products = await Product.find({ donorId: req.params.donorId }).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new product
app.post('/api/products', upload.single('productImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Product image is required' });
        }

        const productData = {
            ...req.body,
            productImage: `/uploads/${req.file.filename}`
        };

        const product = new Product(productData);
        await product.save();
        
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product (donor only)
// app.put('/api/products/:id', upload.single('productImage'), async (req, res) => {
//     try {
//         const product = await Product.findById(req.params.id);
//         if (!product) {
//             return res.status(404).json({ error: 'Product not found' });
//         }

//         // Check if donor owns this product
//         if (product.donorId !== req.body.donorId) {
//             return res.status(403).json({ error: 'Not authorized to update this product' });
//         }

//         const updateData = { ...req.body };
        
//         // If new image uploaded, update image path
//         if (req.file) {
//             // Delete old image file
//             if (product.productImage && fs.existsSync(path.join(__dirname, product.productImage))) {
//                 fs.unlinkSync(path.join(__dirname, product.productImage));
//             }
//             updateData.productImage = `/uploads/${req.file.filename}`;
//         }

//         // If product was approved and being updated, set back to pending
//         if (product.status === 'Available') {
//             updateData.status = 'Pending';
//             updateData.urgentFlag = 'none';
//             updateData.urgentFlagTime = null;
//             updateData.deleteAt = null;
//         }

//         const updatedProduct = await Product.findByIdAndUpdate(
//             req.params.id,
//             updateData,
//             { new: true }
//         );

//         res.json(updatedProduct);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });


app.put('/api/products/:id', upload.single('productImage'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check ownership
        if (product.donorId !== req.body.donorId) {
            return res.status(403).json({ error: 'Not authorized to update this product' });
        }

        const updateData = { ...req.body };

        // Handle new image upload
        if (req.file) {
            if (product.productImage && fs.existsSync(path.join(__dirname, product.productImage))) {
                fs.unlinkSync(path.join(__dirname, product.productImage));
            }
            updateData.productImage = `/uploads/${req.file.filename}`;
        }

        // Update status if product was 'Available' or 'Rejected'
        if (product.status === 'Available' || product.status === 'Rejected') {
            updateData.status = 'Pending';
            updateData.urgentFlag = 'none';
            updateData.urgentFlagTime = null;
            updateData.deleteAt = null;
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });

        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Approve product (admin only)
app.patch('/api/products/:id/approve', async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { status: 'Available' },
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Request product (recipient)
app.post('/api/products/:id/request', async (req, res) => {
    try {
        const { requesterId } = req.body;
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (product.status !== 'Available') {
            return res.status(400).json({ error: 'Product is not available for request' });
        }
        
        // Update product status
        product.status = 'Requested';
        product.requesterId = requesterId;
        product.requestedAt = new Date();
        await product.save();
        
        // Create notification for donor
        const notification = new Notification({
            donorId: product.donorId,
            productId: product._id,
            requesterId: requesterId,
            message: `Someone has requested your product: ${product.productName}`
        });
        await notification.save();
        
        res.json({ message: 'Product request sent successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get notifications for donor
app.get('/api/notifications/:donorId', async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            donorId: req.params.donorId 
        }).populate('productId').sort({ createdAt: -1 });
        
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Respond to product request
app.post('/api/notifications/:id/respond', async (req, res) => {
    try {
        const { response } = req.body; // 'yes' or 'no'
        
        const notification = await Notification.findById(req.params.id).populate('productId');
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        const product = notification.productId;
        
        if (response === 'yes') {
            product.status = 'Delivered';
        } else {
            product.status = 'Available';
            product.requesterId = null;
            product.requestedAt = null;
            // Set urgent flag and timer
            product.urgentFlag = '24h';
            product.urgentFlagTime = new Date();
            product.deleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        }
        
        await product.save();
        
        // Delete notification after response
        await Notification.findByIdAndDelete(notification._id);
        
        res.json({ message: 'Response recorded successfully', product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product (admin)
// app.delete('/api/products/:id', async (req, res) => {
//     try {
//         const product = await Product.findByIdAndDelete(req.params.id);
//         if (!product) {
//             return res.status(404).json({ error: 'Product not found' });
//         }
        
//         // Delete associated image file
//         if (product.productImage && fs.existsSync(path.join(__dirname, product.productImage))) {
//             fs.unlinkSync(path.join(__dirname, product.productImage));
//         }
        
//         res.json({ message: 'Product deleted successfully' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

app.delete('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Bedel status-ka product-ka
        product.status = 'Rejected';
        await product.save();

        res.json({ message: 'Product marked as Rejected successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/////////////////////////////////////////////////rejected delete router





// app.get('/api/products/admin', async (req, res) => {
//     try {
//         const products = await Product.find({ status: { $ne: 'Rejected' } }); // $ne = not equal
//         res.json(products);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// app.get('/api/products/admin', async (req, res) => {
//     try {
//         const { status } = req.query;
//         let filter = { isHiddenFromAdmin: { $ne: true } };

//         if (status) {
//             filter.status = status; // Pending, Urgent, etc.
//         } else {
//             // Default: show all except Rejected
//             filter.status = { $ne: 'Rejected' };
//         }

//         const products = await Product.find(filter).sort({ createdAt: -1 });
//         res.json(products);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

app.get('/api/products/admin', async (req, res) => {
    try {
        const { status } = req.query;
        let filter = { isHiddenFromAdmin: { $ne: true } };

        if (status) {
            if (status === 'Pending') filter.status = 'Pending';
            else if (status === 'Urgent') filter.urgentFlag = { $ne: 'none' }; // Keliya urgent
        } else {
            filter.status = 'Available'; // Default: All Products
        }

        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});









// app.get('/api/products/admin', async (req, res) => {
//     try {
//         // Soo qaad kaliya pending products oo aan la qarin admin-ka
//         const products = await Product.find({ 
//             isHiddenFromAdmin: { $ne: true }, 
//             status: 'Pending' // kaliya pending
//         }).sort({ createdAt: -1 }); // order cusub
//         res.json(products);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });










// Hide all rejected products from admin view
// Qari dhammaan rejected products admin profile-ka
app.put('/api/products/hide-rejected', async (req, res) => {
    try {
        const result = await Product.updateMany(
            { status: 'Rejected' },
            { $set: { isHiddenFromAdmin: true } }
        );

        res.json({ 
            message: `${result.modifiedCount} rejected products hidden from admin profile`
        });
    } catch (error) {
        console.error('Error hiding rejected products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});





////////////////////////////////////////////end rejecte reouter 







// User management
app.post('/api/users', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (error) {
        if (error.code === 11000) {
            // User already exists
            const existingUser = await User.findOne({ userId: req.body.userId });
            res.json(existingUser);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/users/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto timer jobs
cron.schedule('*/5 * * * *', async () => { // Run every 5 minutes
    try {
        const now = new Date();
        
        // Hide requested products after 30 minutes
        const requestedProducts = await Product.find({
            status: 'Requested',
            requestedAt: { $lte: new Date(now - 30 * 60 * 1000) } // 30 minutes ago
        });
        
        for (let product of requestedProducts) {
            product.status = 'Available';
            product.requesterId = null;
            product.requestedAt = null;
            await product.save();
        }
        
        if (requestedProducts.length > 0) {
            console.log(`Auto-unhid ${requestedProducts.length} products after 30 minutes`);
        }
    } catch (error) {
        console.error('Auto-hide timer job error:', error);
    }
});

cron.schedule('0 * * * *', async () => { // Run every hour
    try {
        const now = new Date();
        
        // Find products that need urgent flag updates
        const products24h = await Product.find({
            urgentFlag: '24h',
            urgentFlagTime: { $lte: new Date(now - 24 * 60 * 60 * 1000) }
        });
        
        for (let product of products24h) {
            product.urgentFlag = '48h';
            product.deleteAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            await product.save();
        }
        
        const products48h = await Product.find({
            urgentFlag: '48h',
            urgentFlagTime: { $lte: new Date(now - 48 * 60 * 60 * 1000) }
        });
        
        for (let product of products48h) {
            product.urgentFlag = '96h';
            product.deleteAt = new Date(now.getTime() + 96 * 60 * 60 * 1000);
            await product.save();
        }
        
        // Delete products that have reached their delete time
        const productsToDelete = await Product.find({
            deleteAt: { $lte: now }
        });
        
        for (let product of productsToDelete) {
            // Delete image file
            if (product.productImage && fs.existsSync(path.join(__dirname, product.productImage))) {
                fs.unlinkSync(path.join(__dirname, product.productImage));
            }
            await Product.findByIdAndDelete(product._id);
        }
        
        console.log(`Timer job completed: Updated ${products24h.length + products48h.length} products, deleted ${productsToDelete.length} products`);
    } catch (error) {
        console.error('Timer job error:', error);
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
        }
    }
    res.status(500).json({ error: error.message });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to view the application`);
});