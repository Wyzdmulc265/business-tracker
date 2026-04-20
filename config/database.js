const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL || 'sqlite::memory:';

const sequelize = new Sequelize(databaseUrl, {
  dialect: databaseUrl.includes('postgres') ? 'postgres' : 'sqlite',
  logging: false,
  dialectOptions: databaseUrl.includes('postgres') ? {
    ssl: process.env.NODE_ENV === 'production' ? true : {
      rejectUnauthorized: false
    }
  } : {},
  pool: databaseUrl.includes('postgres') ? {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  } : undefined
});

module.exports = sequelize;