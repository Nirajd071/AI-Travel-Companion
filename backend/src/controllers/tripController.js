const Trip = require('../models/Trip');
const Activity = require('../models/Activity');
const Recommendation = require('../models/Recommendation');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { Op } = require('sequelize');

const getAllTrips = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status, destination } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { userId: req.user.id };
  if (status) whereClause.status = status;
  if (destination) whereClause.destination = { [Op.iLike]: `%${destination}%` };

  const trips = await Trip.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: Activity,
        as: 'activities',
        attributes: ['id', 'title', 'category', 'scheduledDate']
      }
    ]
  });

  res.status(200).json({
    status: 'success',
    results: trips.count,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: trips.count,
      pages: Math.ceil(trips.count / limit)
    },
    data: {
      trips: trips.rows
    }
  });
});

const getTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id
    },
    include: [
      {
        model: Activity,
        as: 'activities',
        order: [['scheduledDate', 'ASC']]
      },
      {
        model: Recommendation,
        as: 'recommendations',
        where: { userFeedback: { [Op.ne]: 'ignored' } },
        required: false
      }
    ]
  });

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      trip
    }
  });
});

const createTrip = catchAsync(async (req, res, next) => {
  const tripData = {
    ...req.body,
    userId: req.user.id
  };

  // Generate coordinates if destination is provided
  if (req.body.destination && !req.body.destinationCoordinates) {
    // TODO: Integrate with geocoding service
    console.log('Geocoding destination:', req.body.destination);
  }

  const newTrip = await Trip.create(tripData);

  res.status(201).json({
    status: 'success',
    data: {
      trip: newTrip
    }
  });
});

const updateTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  await trip.update(req.body);

  res.status(200).json({
    status: 'success',
    data: {
      trip
    }
  });
});

const deleteTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  await trip.destroy();

  res.status(204).json({
    status: 'success',
    data: null
  });
});

const shareTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  trip.isPublic = true;
  await trip.save();

  const shareUrl = `${req.protocol}://${req.get('host')}/shared/trips/${trip.shareCode}`;

  res.status(200).json({
    status: 'success',
    data: {
      shareUrl,
      shareCode: trip.shareCode
    }
  });
});

const getTripAnalytics = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const analytics = await Trip.findAll({
    where: { userId },
    attributes: [
      'status',
      [require('sequelize').fn('COUNT', '*'), 'count'],
      [require('sequelize').fn('AVG', require('sequelize').col('budget')), 'avgBudget'],
      [require('sequelize').fn('SUM', require('sequelize').col('budget')), 'totalBudget']
    ],
    group: ['status'],
    raw: true
  });

  const totalTrips = await Trip.count({ where: { userId } });
  const completedTrips = await Trip.count({ 
    where: { userId, status: 'completed' } 
  });

  res.status(200).json({
    status: 'success',
    data: {
      totalTrips,
      completedTrips,
      completionRate: totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0,
      statusBreakdown: analytics
    }
  });
});

module.exports = {
  getAllTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  getTripAnalytics
};
