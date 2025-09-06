const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { validationResult } = require('express-validator');
const catchAsync = require('../utils/catchAsync');

const signup = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await User.create({
    email,
    password_hash: hashedPassword,
    first_name: firstName,
    last_name: lastName
  });

  // Generate JWT token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    token,
    data: {
      id: newUser.id,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name
    }
  });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password!' });
  }

  // Check if user exists && password is correct
  const user = await User.findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    data: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }
  });
});

module.exports = {
  signup,
  login
};
