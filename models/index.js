const { DataTypes, Op } = require('sequelize');
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
  },
  inventory_item_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'inventory_item',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  unit_cost: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  }
}, {
  tableName: 'transaction',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

const InventoryItem = sequelize.define('InventoryItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  business_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'business',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: 'inventory_business_sku_unique'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  unit_cost: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  quantity_on_hand: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  low_stock_threshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_stocked_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'inventory_item',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const InventoryMovement = sequelize.define('InventoryMovement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  inventory_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'inventory_item',
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
  transaction_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'transaction',
      key: 'id'
    }
  },
  movement_type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  unit_cost: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  total_cost: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'user',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'inventory_movement',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Business.hasMany(User, { foreignKey: 'business_id', as: 'users' });
Business.hasMany(Category, { foreignKey: 'business_id', as: 'categories' });
Business.hasMany(Transaction, { foreignKey: 'business_id', as: 'transactions' });
Business.hasMany(InventoryItem, { foreignKey: 'business_id', as: 'inventoryItems' });
Business.hasMany(InventoryMovement, { foreignKey: 'business_id', as: 'inventoryMovements' });

User.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
Category.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
Transaction.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
InventoryItem.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });
InventoryMovement.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

Category.hasMany(Transaction, { foreignKey: 'category_id', as: 'transactions' });
Transaction.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

User.hasMany(Transaction, { foreignKey: 'created_by', as: 'createdTransactions' });
Transaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

InventoryItem.hasMany(Transaction, { foreignKey: 'inventory_item_id', as: 'transactions' });
Transaction.belongsTo(InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });

InventoryItem.hasMany(InventoryMovement, { foreignKey: 'inventory_item_id', as: 'movements' });
InventoryMovement.belongsTo(InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });

Transaction.hasMany(InventoryMovement, { foreignKey: 'transaction_id', as: 'inventoryMovements' });
InventoryMovement.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

User.hasMany(InventoryMovement, { foreignKey: 'created_by', as: 'inventoryMovements' });
InventoryMovement.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

async function getSumByTypeAndDate(transType, targetDate, businessId = null) {
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

async function getSumOfSales(targetDate, businessId = null) {
   const where = {
     type: 'sale',
     date: targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate,
     approval_status: 'approved'
   };
   
   if (businessId) {
     where.business_id = businessId;
   }
   
   const result = await Transaction.sum('amount', { where });
   return result || 0;
}

async function getSumOfPurchases(targetDate, businessId = null) {
   const where = {
     type: 'expense',
     date: targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate,
     approval_status: 'approved',
     inventory_item_id: {
       [Op.ne]: null
     }
   };
   
   if (businessId) {
     where.business_id = businessId;
   }
   
   const result = await Transaction.sum('amount', { where });
   return result || 0;
}

async function getSumOfOtherExpenses(targetDate, businessId = null) {
   const where = {
     type: 'expense',
     date: targetDate instanceof Date ? targetDate.toISOString().split('T')[0] : targetDate,
     approval_status: 'approved',
     inventory_item_id: null
   };
   
   if (businessId) {
     where.business_id = businessId;
   }
   
   const result = await Transaction.sum('amount', { where });
   return result || 0;
}

async function getSumByTypeAndDateRange(transType, startDate, endDate, businessId = null) {
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

async function getSumOfSalesRange(startDate, endDate, businessId = null) {
   const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
   const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
   
   const where = {
     type: 'sale',
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

async function getSumOfPurchasesRange(startDate, endDate, businessId = null) {
   const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
   const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
   
   const where = {
     type: 'expense',
     date: {
       [Op.gte]: start,
       [Op.lte]: end
     },
     approval_status: 'approved',
     inventory_item_id: {
       [Op.ne]: null
     }
   };
   
   if (businessId) {
     where.business_id = businessId;
   }
   
   const result = await Transaction.sum('amount', { where });
   return result || 0;
}

async function getSumOfOtherExpensesRange(startDate, endDate, businessId = null) {
   const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
   const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
   
   const where = {
     type: 'expense',
     date: {
       [Op.gte]: start,
       [Op.lte]: end
     },
     approval_status: 'approved',
     inventory_item_id: null
   };
   
   if (businessId) {
     where.business_id = businessId;
   }
   
   const result = await Transaction.sum('amount', { where });
   return result || 0;
}

async function getLowStockItems(businessId = null) {
  const where = {};
  if (businessId) {
    where.business_id = businessId;
  }

  const items = await InventoryItem.findAll({
    where,
    order: [['name', 'ASC']]
  });

  return items.filter(item => {
    const threshold = Number(item.low_stock_threshold || 0);
    const quantity = Number(item.quantity_on_hand || 0);
    return threshold > 0 && quantity <= threshold;
  });
}

async function getInventoryValuation(businessId = null) {
  const where = {};
  if (businessId) {
    where.business_id = businessId;
  }

  const items = await InventoryItem.findAll({
    where,
    attributes: ['quantity_on_hand', 'unit_cost']
  });

  return items.reduce((total, item) => {
    const quantity = Number(item.quantity_on_hand || 0);
    const unitCost = Number(item.unit_cost || 0);
    return total + (quantity * unitCost);
  }, 0);
}

async function getInventorySummary(businessId = null) {
  const [lowStockItems, valuation, items] = await Promise.all([
    getLowStockItems(businessId),
    getInventoryValuation(businessId),
    InventoryItem.findAll({
      where: businessId ? { business_id: businessId } : {},
      order: [['name', 'ASC']]
    })
  ]);

  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity_on_hand || 0), 0);

  return {
    items,
    lowStockItems,
    lowStockCount: lowStockItems.length,
    valuation,
    totalValue: valuation,
    totalQuantity,
    totalItems: items.length
  };
}

async function applyInventoryTransactionImpact(transaction, options = {}) {
  if (!transaction || !transaction.inventory_item_id) {
    return null;
  }

  const item = await InventoryItem.findByPk(transaction.inventory_item_id);
  if (!item) {
    return null;
  }

  const quantity = Math.abs(Number(transaction.quantity || 0));
  if (!quantity) {
    return null;
  }

  const reverse = Boolean(options.reverse);
  const actorId = options.actorId || transaction.created_by || null;
  const note = options.note || null;

  let delta = 0;
  if (transaction.type === 'sale') {
    delta = -quantity;
  } else if (transaction.type === 'expense') {
    delta = quantity;
  } else {
    return null;
  }

  if (reverse) {
    delta *= -1;
  }

  const currentQty = Number(item.quantity_on_hand || 0);
  const currentUnitCost = Number(item.unit_cost || 0);
  const movementUnitCost = Number(transaction.unit_cost || currentUnitCost || 0);

  if (delta > 0) {
    const totalCurrentValue = currentQty * currentUnitCost;
    const totalIncomingValue = delta * movementUnitCost;
    const nextQty = currentQty + delta;

    item.quantity_on_hand = nextQty;
    if (movementUnitCost > 0) {
      item.unit_cost = nextQty > 0 ? (totalCurrentValue + totalIncomingValue) / nextQty : movementUnitCost;
    }
    item.last_stocked_at = new Date();
  } else {
    item.quantity_on_hand = Math.max(0, currentQty + delta);
  }

  await item.save();

  await InventoryMovement.create({
    inventory_item_id: item.id,
    business_id: item.business_id,
    transaction_id: transaction.id || null,
    movement_type: reverse ? 'reversal' : (delta > 0 ? 'purchase' : 'sale'),
    quantity: delta,
    unit_cost: movementUnitCost,
    total_cost: Math.abs(delta) * movementUnitCost,
    created_by: actorId,
    notes: note || (reverse ? 'Inventory movement reversed' : null)
  });

  return item;
}

module.exports = {
   sequelize,
   Business,
   Category,
   User,
   Transaction,
   InventoryItem,
   InventoryMovement,
   getSumByTypeAndDate,
   getSumByTypeAndDateRange,
   getSumOfSales,
   getSumOfPurchases,
   getSumOfOtherExpenses,
   getSumOfSalesRange,
   getSumOfPurchasesRange,
   getSumOfOtherExpensesRange,
   getLowStockItems,
   getInventoryValuation,
   getInventorySummary,
   applyInventoryTransactionImpact
};
