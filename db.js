// db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('files_storage', 'postgres', 'root', {
  host: 'localhost',
  dialect: 'postgres',
  define: {
    timestamps: false // отключаем автоматические поля createdAt и updatedAt
  },
  logging: false // отключаем логирование SQL-запросов
});

module.exports = sequelize;