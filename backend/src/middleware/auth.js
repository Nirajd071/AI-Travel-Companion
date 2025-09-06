const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findByPk(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

const forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ where: { email: req.body.email } });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save({ validate: false });

  // 3) Send it to user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/auth/reset-password/${resetToken}`;

    // TODO: Implement email service
    console.log('Password reset URL:', resetURL);

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validate: false });

    return next(
      new AppError('There was an error sending the email. Try again later.'),
      500
    );
  }
});

const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
    }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // 3) Log the user in, send JWT
  createSendToken(user, 200, res);
});

const updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findByPk(req.user.id);

  // 2) Check if POSTed current password is correct
  if (!(await user.comparePassword(req.body.passwordCurrent))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

module.exports = {
  signToken,
  createSendToken,
  protect,
  restrictTo,
  forgotPassword,
  resetPassword,
  updatePassword
};
