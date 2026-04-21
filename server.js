require('dotenv').config();
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const flash = require('connect-flash');
const path = require('path');
const { Pool } = require('pg');
const { sequelize } = require('./models');
const routes = require('./routes/index');
const pgSession = connectPgSimple(session);

const app = express();
const PORT = process.env.PORT || 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

let sessionStore;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres') && process.env.NODE_ENV === 'production') {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  sessionStore = new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  });
}

const sessionConfig = {
  secret: process.env.SECRET_KEY || 'profit-tracker-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production
    sameSite: 'lax'
  }
};

if (sessionStore) {
  sessionConfig.store = sessionStore;
}

app.use(session(sessionConfig));

app.use(flash());

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
      // Use alter: true in production, force: true in development
      const syncOptions = process.env.NODE_ENV === 'production' ? { alter: true } : { force: true };
      await sequelize.sync(syncOptions);
      console.log('Database synchronized');
      
      const { User } = require('./models');
      const userCount = await User.count();
      
      if (userCount === 0) {
        const { User } = require('./models');
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
