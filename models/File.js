const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  mimetype: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalExtension: {
    type: DataTypes.STRING,
    allowNull: true
  },
  formatSize: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = File;