const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dzqeobfty',      // Замени на своё
  api_key: '379582711791356',
  api_secret: 'nIrNbr8zSIlbXbYAX-KVakwz8f4',
  secure: true,
});

module.exports = cloudinary;
