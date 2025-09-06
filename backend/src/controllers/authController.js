const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { createSendToken } = require('../middleware/auth');

const signup = catchAsync(async (req, res, next) => {
  const { email, password, firstName, lastName, phoneNumber, dateOfBirth } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  const newUser = await User.create({
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    dateOfBirth
  });

  // Generate email verification token
  const verificationToken = newUser.generateEmailVerificationToken();
  await newUser.save({ validate: false });

  // TODO: Send verification email
  console.log('Email verification token:', verificationToken);

  createSendToken(newUser, 201, res);
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ where: { email } });

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) Check if user is active
  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated', 401));
  }

  // 4) Update login statistics
  user.lastLoginAt = new Date();
  user.loginCount += 1;
  await user.save({ validate: false });

  // 5) If everything ok, send token to client
  createSendToken(user, 200, res);
});

const logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

const verifyEmail = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    where: {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { [require('sequelize').Op.gt]: Date.now() }
    }
  });

  // 2) If token has not expired, and there is user, verify email
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validate: false });

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully!'
  });
});

const refreshToken = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('No token provided', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findByPk(decoded.id);
  if (!currentUser) {
    return next(new AppError('User no longer exists', 401));
  }

  // 4) Generate new token
  createSendToken(currentUser, 200, res);
});

module.exports = {
  signup,
  login,
  logout,
  verifyEmail,
  refreshToken
};
