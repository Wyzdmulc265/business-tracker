const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = require('../config/database');

const Business = sequelize.define('Business', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  }
}, {
  tableName: 'business',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  business_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'business',
      key: 'id'
    }
  }
}, {
  tableName: 'category',
  timestamps: false
});

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'viewer'
  },
  business_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'business',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: '$'
  },
  date_format: {
    type: DataTypes.STRING(20),
    defaultValue: '%b %d, %Y'
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'UTC'
  },
  theme: {
    type: DataTypes.STRING(20),
    defaultValue: 'default'
  }
}, {
  tableName: 'user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

User.prototype.getId = function() {
  return String(this.id);
};

User.prototype.isAuthenticated = function() {
  return true;
};

User.prototype.isSuperAdmin = function() {
  return this.role === 'super_admin';
};

User.prototype.isBusinessAdmin = function() {
  return this.role === 'business_admin';
};

User.prototype.isAccountant = function() {
  return this.role === 'business_admin' || this.role === 'accountant';
};

User.prototype.checkPassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

User.generatePasswordHash = async function(password) {
  return bcrypt.hash(password, 10);
};

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'category',
      key: 'id'
    }
  },
  business_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'business',
      key: 'id'
    }
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user',
      key: 'id'
    }
  },
  description: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  is_pending: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  requires_approval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  approval_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'approved'
  }
}, {
  tableName: 'transaction',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Business.hasMany(User, { foreignKey: 'business_id', as: 'users' });
Business.hasMany(Category, { foreignKey: 'business_id', as: 'categories' });
Business.hasMany(Transaction, { foreignKey: 'business_id', as: 'transactions' });

User.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
Category.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
Transaction.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

Category.hasMany(Transaction, { foreignKey: 'category_id', as: 'transactions' });
Transaction.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

User.hasMany(Transaction, { foreignKey: 'created_by', as: 'createdTransactions' });
Transaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

async function getSumByTypeAndDate(transType, targetDate, businessId = null) {
  const { Op } = require('sequelize');
  const where = {
    type: transType,
    date: targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate,
    approval_status: 'approved'
  };
  
  if (businessId) {
    where.business_id = businessId;
  }
  
  const result = await Transaction.sum('amount', { where });
  return result || 0;
}

async function getSumByTypeAndDateRange(transType, startDate, endDate, businessId = null) {
  const { Op } = require('sequelize');
  const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
  const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
  
  const where = {
    type: transType,
    date: {
      [Op.gte]: start,
      [Op.lte]: end
    },
    approval_status: 'approved'
  };
  
  if (businessId) {
    where.business_id = businessId;
  }
  
  const result = await Transaction.sum('amount', { where });
  return result || 0;
}

module.exports = {
  sequelize,
  Business,
  Category,
  User,
  Transaction,
  getSumByTypeAndDate,
  getSumByTypeAndDateRange
};