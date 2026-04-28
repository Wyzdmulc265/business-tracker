require('dotenv').config();
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const { sequelize } = require('./models');
const routes = require('./routes/index');
const pgSession = connectPgSimple(session);

// Validate required environment variables
if (!process.env.SECRET_KEY) {
  console.error('ERROR: SECRET_KEY is required in .env file');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static')));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

let sessionStore;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres') && process.env.NODE_ENV === 'production') {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
  });
  sessionStore = new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  });
}

const sessionConfig = {
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
};

if (sessionStore) {
  sessionConfig.store = sessionStore;
}

app.use(session(sessionConfig));

app.use(flash());

// CSRF protection middleware - must come after session
const csrfProtection = csrf({ cookie: false });

// Apply CSRF protection to all routes except public auth routes
app.use((req, res, next) => {
  // Skip CSRF for login, register, and logout
  if (['/login', '/register', '/logout'].includes(req.path)) {
    return next();
  }
  csrfProtection(req, res, next);
});

// Custom render wrapper
const originalRender = express.response.render;
express.response.render = function(view, options, callback) {
  const res = this;
  const req = res.req;
  
  if (view === 'layout') {
    return originalRender.call(res, view, options, callback);
  }
  
  originalRender.call(res, view, options, function(err, html) {
    if (err) {
      console.error('Render error:', err);
      return res.status(500).send('Error rendering view');
    }
    
    originalRender.call(res, 'layout', {
      ...options,
      body: html,
      userName: req.session.userName || '',
      userRole: req.session.userRole || ''
    }, callback);
  });
};

// Set up locals - comes after CSRF middleware so req.csrfToken exists on protected routes
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session.userId ? {
    id: req.session.userId,
    role: req.session.userRole,
    isSuperAdmin: () => req.session.userRole === 'super_admin',
    isBusinessAdmin: () => req.session.userRole === 'business_admin',
    isAuthenticated: () => true
  } : { isAuthenticated: () => false };
  
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  };
  
  res.locals.userName = req.session.userName || '';
  res.locals.userRole = req.session.userRole || '';
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  
  next();
});

app.use('/', routes);

// Debug: list all routes (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('\n=== Registered Routes ===');
  routes.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(r.route.stack[0].method.toUpperCase(), r.route.path);
    }
  });
  console.log('=======================\n');
}

app.use((req, res) => {
  res.status(404).send('Not Found');
});

async function initDatabase() {
  let retries = 5;
  while (retries > 0) {
    try {
      // Avoid wiping data on restart; only force-reset when explicitly requested.
      const syncOptions = process.env.DB_SYNC_FORCE === 'true' ? { force: true } : { alter: true };
      await sequelize.sync(syncOptions);
      console.log('Database synchronized');
      
      const { User } = require('./models');
      const userCount = await User.count();
      
      if (userCount === 0) {
        const passwordHash = await User.generatePasswordHash('admin123');
        await User.create({
          username: 'superadmin',
          email: 'superadmin@profittracker.local',
          password_hash: passwordHash,
          role: 'super_admin'
        });
        console.log('Default admin user created (username: superadmin, password: admin123)');
      }
      return;
    } catch (error) {
      console.error(`Database connection attempt failed: ${error.message}`);
      retries--;
      if (retries > 0) {
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  console.warn('Warning: Could not connect to database. Server will start anyway.');
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  await initDatabase();
});

module.exports = app;
