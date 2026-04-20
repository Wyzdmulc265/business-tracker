const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { User, Business, Category } = require('../models');

const TRANSACTION_TYPE_SALE = 'sale';
const TRANSACTION_TYPE_EXPENSE = 'expense';

const ROLE_SUPER_ADMIN = 'super_admin';
const ROLE_BUSINESS_ADMIN = 'business_admin';
const ROLE_ACCOUNTANT = 'accountant';
const ROLE_VIEWER = 'viewer';

const MAX_BAR_HEIGHT = 150;

function roleRequired(roles) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.userRole)) {
      req.flash = req.flash || {};
      req.flash.error = 'You do not have permission to access this page.';
      return res.redirect('/');
    }
    next();
  };
}

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

function isSuperAdmin(req) {
  return req.session.userRole === ROLE_SUPER_ADMIN;
}

function isBusinessAdmin(req) {
  return req.session.userRole === ROLE_BUSINESS_ADMIN;
}

router.use((req, res, next) => {
  req.flash = { error: [], success: [] };
  next();
});

router.get('/login', async (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { errors: [], formData: {} });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = await User.findOne({ where: { username } });
  
  if (user && await user.checkPassword(password)) {
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.businessId = user.business_id;
    req.session.userName = user.username;
    req.flash.success = 'Logged in successfully!';
    const next = req.query.next || '/';
    return res.redirect(next);
  }
  
  res.render('login', { errors: ['Invalid username or password'], formData: { username } });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  req.flash = { success: ['Logged out successfully!'] };
  res.redirect('/login');
});

router.get('/register', async (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('register', { errors: [], formData: {} });
});

router.post('/register', async (req, res) => {
  const { username, email, business_name, password, confirm_password } = req.body;
  const errors = [];
  
  const existingUser = await User.findOne({ where: { username } });
  if (existingUser) errors.push('Username already exists');
  
  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) errors.push('Email already exists');
  
  const existingBusiness = await Business.findOne({ where: { name: business_name } });
  if (existingBusiness) errors.push('Business name already registered. Please choose a different name.');
  
  if (password !== confirm_password) errors.push('Passwords do not match');
  if (password.length < 6) errors.push('Password must be at least 6 characters');
  
  if (errors.length > 0) {
    return res.render('register', { errors, formData: { username, email, business_name } });
  }
  
  const business = await Business.create({ name: business_name });
  
  const saleCategories = ['Product Sales', 'Services', 'Digital Products', 'Other Income'];
  const expenseCategories = ['Inventory/Stock', 'Rent', 'Utilities', 'Transport', 'Marketing', 'Supplies', 'Salaries', 'Other Expense'];
  
  for (const name of saleCategories) {
    await Category.create({ name, type: 'sale', business_id: business.id });
  }
  for (const name of expenseCategories) {
    await Category.create({ name, type: 'expense', business_id: business.id });
  }
  
  const passwordHash = await User.generatePasswordHash(password);
  await User.create({
    username,
    email,
    password_hash: passwordHash,
    role: ROLE_BUSINESS_ADMIN,
    business_id: business.id
  });
  
  req.flash.success = 'Registration successful! Your business has been created. Please log in.';
  res.redirect('/login');
});

router.get('/', isAuthenticated, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const businessId = isSuperAdmin(req) ? null : req.session.businessId;
  
  const { getSumByTypeAndDate, getSumByTypeAndDateRange, Transaction } = require('../models');
  
  const todaySales = await getSumByTypeAndDate(TRANSACTION_TYPE_SALE, today, businessId);
  const todayExpenses = await getSumByTypeAndDate(TRANSACTION_TYPE_EXPENSE, today, businessId);
  const todayProfit = todaySales - todayExpenses;
  
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSales = await getSumByTypeAndDateRange(TRANSACTION_TYPE_SALE, monthStart, today, businessId);
  const monthExpenses = await getSumByTypeAndDateRange(TRANSACTION_TYPE_EXPENSE, monthStart, today, businessId);
  const monthProfit = monthSales - monthExpenses;
  
  let query = Transaction.findAll({
    where: { approval_status: 'approved' },
    order: [['date', 'DESC'], ['created_at', 'DESC']],
    limit: 5,
    include: [
      { model: require('../models').Category, as: 'category' },
      { model: require('../models').User, as: 'creator' }
    ]
  });
  
  if (businessId) {
    query = Transaction.findAll({
      where: { approval_status: 'approved', business_id: businessId },
      order: [['date', 'DESC'], ['created_at', 'DESC']],
      limit: 5,
      include: [
        { model: require('../models').Category, as: 'category' },
        { model: require('../models').User, as: 'creator' }
      ]
    });
  }
  
  const recentTransactions = await query;
  
  res.render('index', {
    todaySales,
    todayExpenses,
    todayProfit,
    monthSales,
    monthExpenses,
    monthProfit,
    recentTransactions,
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.get('/add', isAuthenticated, async (req, res) => {
  const { Category } = require('../models');
  let categories;
  
  if (isSuperAdmin(req)) {
    categories = await Category.findAll();
  } else {
    categories = await Category.findAll({ where: { business_id: req.session.businessId } });
  }
  
  const today = new Date().toISOString().split('T')[0];
  res.render('add_transaction', { categories, today, currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) } });
});

router.post('/add', isAuthenticated, async (req, res) => {
  const { type, amount, category_id, description, date: transDate } = req.body;
  const errors = [];
  
  if (!type || !['sale', 'expense'].includes(type)) {
    errors.push('Invalid transaction type');
  }
  
  let amountVal = parseFloat(amount);
  if (isNaN(amountVal) || amountVal <= 0) {
    errors.push('Amount must be greater than zero');
  }
  
  let categoryIdVal = parseInt(category_id);
  const { Category } = require('../models');
  const category = await Category.findByPk(categoryIdVal);
  if (!category) {
    errors.push('Invalid category selected');
  }
  
  let transDateVal;
  if (transDate) {
    transDateVal = new Date(transDate);
    if (isNaN(transDateVal.getTime())) {
      errors.push('Invalid date format, should be YYYY-MM-DD');
    }
  } else {
    transDateVal = new Date();
  }
  
  if (!isSuperAdmin(req) && category && category.business_id !== req.session.businessId) {
    errors.push('Invalid category for your business');
  }
  
  if (errors.length > 0) {
    let categories;
    if (isSuperAdmin(req)) {
      categories = await Category.findAll();
    } else {
      categories = await Category.findAll({ where: { business_id: req.session.businessId } });
    }
    const today = new Date().toISOString().split('T')[0];
    return res.render('add_transaction', { categories, today, errors, currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) } });
  }
  
  const requiresApproval = req.session.userRole === ROLE_ACCOUNTANT;
  const approvalStatus = requiresApproval ? 'pending' : 'approved';
  
  const { Transaction } = require('../models');
  await Transaction.create({
    type,
    amount: amountVal,
    category_id: categoryIdVal,
    business_id: isSuperAdmin(req) ? category.business_id : req.session.businessId,
    created_by: req.session.userId,
    description,
    date: transDateVal,
    requires_approval: requiresApproval,
    approval_status: approvalStatus
  });
  
  if (requiresApproval) {
    req.flash.success = 'Transaction submitted for admin approval.';
  } else {
    req.flash.success = 'Transaction added successfully!';
  }
  res.redirect('/');
});

router.get('/history', isAuthenticated, async (req, res) => {
  const { type, category, start_date, end_date } = req.query;
  const { Transaction, Category: Cat } = require('../models');
  
  let where = {};
  
  if (!isSuperAdmin(req)) {
    where.business_id = req.session.businessId;
  }
  
  if (type) where.type = type;
  if (category) where.category_id = parseInt(category);
  if (start_date) where.date = { ...where.date, [require('sequelize').Op.gte]: new Date(start_date) };
  if (end_date) where.date = { ...where.date, [require('sequelize').Op.lte]: new Date(end_date) };
  
  const transactions = await Transaction.findAll({
    where,
    order: [['date', 'DESC'], ['created_at', 'DESC']],
    include: [
      { model: Cat, as: 'category' },
      { model: require('../models').User, as: 'creator' }
    ]
  });
  
  let categories;
  if (isSuperAdmin(req)) {
    categories = await Cat.findAll();
  } else {
    categories = await Cat.findAll({ where: { business_id: req.session.businessId } });
  }
  
  res.render('history', {
    transactions,
    categories,
    filterType: type || '',
    filterCategory: category || '',
    filterStart: start_date || '',
    filterEnd: end_date || '',
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.get('/delete/:id', isAuthenticated, async (req, res) => {
  const { Transaction } = require('../models');
  const transaction = await Transaction.findByPk(req.params.id);
  
  if (transaction) {
    await transaction.destroy();
    req.flash.success = 'Transaction deleted successfully!';
  }
  
  res.redirect('/history');
});

router.get('/edit/:id', isAuthenticated, async (req, res) => {
  const { Transaction, Category: Cat } = require('../models');
  const transaction = await Transaction.findByPk(req.params.id);
  
  if (!transaction) {
    return res.redirect('/history');
  }
  
  let categories;
  if (isSuperAdmin(req)) {
    categories = await Cat.findAll();
  } else {
    categories = await Cat.findAll({ where: { business_id: req.session.businessId } });
  }
  
  res.render('edit_transaction', {
    transaction,
    categories,
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.post('/edit/:id', isAuthenticated, async (req, res) => {
  const { type, amount, category_id, description, date: transDate } = req.body;
  const { Transaction, Category: Cat } = require('../models');
  const transaction = await Transaction.findByPk(req.params.id);
  
  if (!transaction) {
    return res.redirect('/history');
  }
  
  const errors = [];
  
  if (!type || !['sale', 'expense'].includes(type)) {
    errors.push('Invalid transaction type');
  }
  
  let amountVal = parseFloat(amount);
  if (isNaN(amountVal) || amountVal <= 0) {
    errors.push('Amount must be greater than zero');
  }
  
  let categoryIdVal = parseInt(category_id);
  const category = await Cat.findByPk(categoryIdVal);
  if (!category) {
    errors.push('Invalid category selected');
  }
  
  let transDateVal;
  if (transDate) {
    transDateVal = new Date(transDate);
    if (isNaN(transDateVal.getTime())) {
      errors.push('Invalid date format, should be YYYY-MM-DD');
    }
  } else {
    transDateVal = new Date();
  }
  
  if (errors.length > 0) {
    let categories;
    if (isSuperAdmin(req)) {
      categories = await Cat.findAll();
    } else {
      categories = await Cat.findAll({ where: { business_id: req.session.businessId } });
    }
    return res.render('edit_transaction', { transaction, categories, errors, currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) } });
  }
  
  transaction.type = type;
  transaction.amount = amountVal;
  transaction.category_id = categoryIdVal;
  transaction.description = description;
  transaction.date = transDateVal;
  
  if (req.session.userRole === ROLE_ACCOUNTANT) {
    transaction.approval_status = 'pending';
    req.flash.success = 'Transaction updated and submitted for re-approval.';
  } else {
    req.flash.success = 'Transaction updated successfully!';
  }
  
  await transaction.save();
  res.redirect('/history');
});

router.get('/profile', isAuthenticated, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  
  if (!user) {
    req.flash.error = ['User not found'];
    return res.redirect('/');
  }
  
  res.render('profile', { user });
});

router.post('/profile/update', isAuthenticated, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  const { username, email } = req.body;
  const errors = [];
  
  if (username !== user.username) {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) errors.push('Username already exists');
  }
  
  if (email !== user.email) {
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) errors.push('Email already exists');
  }
  
  if (errors.length > 0) {
    req.flash.error = errors;
    return res.redirect('/profile');
  }
  
  user.username = username;
  user.email = email;
  await user.save();
  
  req.session.userName = username;
  req.flash.success = 'Profile updated successfully!';
  res.redirect('/profile');
});

router.post('/profile/password', isAuthenticated, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  const { current_password, new_password, confirm_password } = req.body;
  
  if (!(await user.checkPassword(current_password))) {
    req.flash.error = ['Current password is incorrect'];
    return res.redirect('/profile');
  }
  
  if (new_password !== confirm_password) {
    req.flash.error = ['New passwords do not match'];
    return res.redirect('/profile');
  }
  
  if (new_password.length < 6) {
    req.flash.error = ['Password must be at least 6 characters'];
    return res.redirect('/profile');
  }
  
  user.password_hash = await User.generatePasswordHash(new_password);
  await user.save();
  
  req.flash.success = 'Password changed successfully!';
  res.redirect('/profile');
});

router.get('/pending-approvals', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const { Transaction } = require('../models');
  
  let where = { approval_status: 'pending' };
  if (!isSuperAdmin(req)) {
    where.business_id = req.session.businessId;
  }
  
  const transactions = await Transaction.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [
      { model: require('../models').Category, as: 'category' },
      { model: require('../models').User, as: 'creator' },
      { model: require('../models').Business, as: 'business' }
    ]
  });
  
  res.render('pending_approvals', {
    transactions,
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.get('/approve/:transaction_id', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const { Transaction } = require('../models');
  const transaction = await Transaction.findByPk(req.params.transaction_id);
  
  if (!transaction) {
    req.flash.error = 'Transaction not found.';
    return res.redirect('/pending-approvals');
  }
  
  if (!isSuperAdmin(req) && transaction.business_id !== req.session.businessId) {
    req.flash.error = 'You do not have permission to approve this transaction.';
    return res.redirect('/');
  }
  
  transaction.approval_status = 'approved';
  await transaction.save();
  req.flash.success = 'Transaction approved successfully!';
  res.redirect('/pending-approvals');
});

router.get('/reject/:transaction_id', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const { Transaction } = require('../models');
  const transaction = await Transaction.findByPk(req.params.transaction_id);
  
  if (!transaction) {
    req.flash.error = 'Transaction not found.';
    return res.redirect('/pending-approvals');
  }
  
  if (!isSuperAdmin(req) && transaction.business_id !== req.session.businessId) {
    req.flash.error = 'You do not have permission to reject this transaction.';
    return res.redirect('/');
  }
  
  transaction.approval_status = 'rejected';
  await transaction.save();
  req.flash.success = 'Transaction rejected.';
  res.redirect('/pending-approvals');
});

router.get('/reports', isAuthenticated, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const businessId = isSuperAdmin(req) ? null : req.session.businessId;
  
  const { getSumByTypeAndDate, getSumByTypeAndDateRange } = require('../models');
  
  const dailySummary = [];
  let dailyMax = 1;
  
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - i));
    day.setHours(0, 0, 0, 0);
    
    const daySales = await getSumByTypeAndDate(TRANSACTION_TYPE_SALE, day, businessId);
    const dayExpenses = await getSumByTypeAndDate(TRANSACTION_TYPE_EXPENSE, day, businessId);
    
    const profit = daySales - dayExpenses;
    dailySummary.push({
      date: day,
      sales: daySales,
      expenses: dayExpenses,
      profit
    });
    if (Math.abs(profit) > dailyMax) {
      dailyMax = Math.abs(profit);
    }
  }
  
  if (dailyMax > 0) {
    dailySummary.forEach(item => {
      item.bar_height = (Math.abs(item.profit) / dailyMax) * MAX_BAR_HEIGHT;
    });
  } else {
    dailySummary.forEach(item => {
      item.bar_height = 0;
    });
  }
  
  const monthlyTotals = [];
  let monthlyMax = 1;
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    
    const monthSales = await getSumByTypeAndDateRange(TRANSACTION_TYPE_SALE, monthDate, nextMonth, businessId);
    const monthExpenses = await getSumByTypeAndDateRange(TRANSACTION_TYPE_EXPENSE, monthDate, nextMonth, businessId);
    
    const profit = monthSales - monthExpenses;
    monthlyTotals.push({
      month: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      sales: monthSales,
      expenses: monthExpenses,
      profit
    });
    if (Math.abs(profit) > monthlyMax) {
      monthlyMax = Math.abs(profit);
    }
  }
  
  if (monthlyMax > 0) {
    monthlyTotals.forEach(item => {
      item.bar_height = (Math.abs(item.profit) / monthlyMax) * MAX_BAR_HEIGHT;
    });
  } else {
    monthlyTotals.forEach(item => {
      item.bar_height = 0;
    });
  }
  
  const totalSales = await getSumByTypeAndDateRange(TRANSACTION_TYPE_SALE, new Date(2000, 0, 1), today, businessId);
  const totalExpenses = await getSumByTypeAndDateRange(TRANSACTION_TYPE_EXPENSE, new Date(2000, 0, 1), today, businessId);
  
  res.render('reports', {
    dailySummary,
    monthlyTotals,
    totalSales,
    totalExpenses,
    totalProfit: totalSales - totalExpenses,
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.get('/users', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  let where = {};
  if (!isSuperAdmin(req)) {
    where.business_id = req.session.businessId;
  }
  
  const users = await User.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [{ model: require('../models').Business, as: 'business' }]
  });
  
  res.render('users', {
    users,
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.get('/user/edit/:user_id', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const user = await User.findByPk(req.params.user_id);
  
  if (!user) {
    return res.redirect('/users');
  }
  
  if (!isSuperAdmin(req) && user.business_id !== req.session.businessId) {
    req.flash.error = 'You do not have permission to edit this user.';
    return res.redirect('/users');
  }
  
  res.render('edit_user', {
    user,
    roles: [ROLE_VIEWER, ROLE_ACCOUNTANT, ROLE_BUSINESS_ADMIN],
    currentUser: { id: req.session.userId, role: req.session.userRole, isSuperAdmin: isSuperAdmin(req), isBusinessAdmin: isBusinessAdmin(req) }
  });
});

router.post('/user/edit/:user_id', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const user = await User.findByPk(req.params.user_id);
  
  if (!user) {
    return res.redirect('/users');
  }
  
  if (!isSuperAdmin(req) && user.business_id !== req.session.businessId) {
    req.flash.error = 'You do not have permission to edit this user.';
    return res.redirect('/users');
  }
  
  const { username, email, role, is_active } = req.body;
  
  user.username = username;
  user.email = email;
  user.role = role;
  user.is_active = is_active === '1';
  
  await user.save();
  req.flash.success = 'User updated successfully!';
  res.redirect('/users');
});

router.get('/user/delete/:user_id', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const user = await User.findByPk(req.params.user_id);
  
  if (!user) {
    return res.redirect('/users');
  }
  
  if (user.id === req.session.userId) {
    req.flash.error = 'You cannot delete your own account!';
    return res.redirect('/users');
  }
  
  if (!isSuperAdmin(req) && user.business_id !== req.session.businessId) {
    req.flash.error = 'You do not have permission to delete this user.';
    return res.redirect('/users');
  }
  
  await user.destroy();
  req.flash.success = 'User deleted successfully!';
  res.redirect('/users');
});

router.post('/user/add', isAuthenticated, roleRequired([ROLE_BUSINESS_ADMIN, ROLE_SUPER_ADMIN]), async (req, res) => {
  const { username, email, password, role } = req.body;
  const errors = [];
  
  const existingUser = await User.findOne({ where: { username } });
  if (existingUser) errors.push('Username already exists');
  
  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) errors.push('Email already exists');
  
  if (password.length < 6) errors.push('Password must be at least 6 characters');
  
  if (errors.length > 0) {
    req.flash.error = errors;
    return res.redirect('/users');
  }
  
  const passwordHash = await User.generatePasswordHash(password);
  await User.create({
    username,
    email,
    password_hash: passwordHash,
    role,
    business_id: req.session.businessId
  });
  
  req.flash.success = 'User added successfully!';
  res.redirect('/users');
});

module.exports = router;
