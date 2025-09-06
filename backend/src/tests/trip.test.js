const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Trip = require('../models/Trip');
const { sequelize } = require('../config/database');

describe('Trip Management', () => {
  let user, token;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await Trip.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    
    user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    });
    token = user.generateJWT();
  });

  describe('POST /api/trips', () => {
    it('should create a new trip', async () => {
      const tripData = {
        title: 'Paris Adventure',
        destination: 'Paris, France',
        startDate: '2024-06-01',
        endDate: '2024-06-07',
        budget: 2000,
        description: 'A romantic getaway to Paris'
      };

      const res = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send(tripData)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.trip.title).toBe(tripData.title);
      expect(res.body.data.trip.userId).toBe(user.id);
    });

    it('should not create trip without authentication', async () => {
      const tripData = {
        title: 'Paris Adventure',
        destination: 'Paris, France',
        startDate: '2024-06-01',
        endDate: '2024-06-07'
      };

      await request(app)
        .post('/api/trips')
        .send(tripData)
        .expect(401);
    });
  });

  describe('GET /api/trips', () => {
    beforeEach(async () => {
      await Trip.bulkCreate([
        {
          title: 'Trip 1',
          destination: 'London',
          startDate: '2024-06-01',
          endDate: '2024-06-07',
          userId: user.id
        },
        {
          title: 'Trip 2',
          destination: 'Tokyo',
          startDate: '2024-07-01',
          endDate: '2024-07-10',
          userId: user.id
        }
      ]);
    });

    it('should get all user trips', async () => {
      const res = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.results).toBe(2);
      expect(res.body.data.trips).toHaveLength(2);
    });

    it('should filter trips by destination', async () => {
      const res = await request(app)
        .get('/api/trips?destination=London')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.results).toBe(1);
      expect(res.body.data.trips[0].destination).toBe('London');
    });
  });

  describe('GET /api/trips/:id', () => {
    let trip;

    beforeEach(async () => {
      trip = await Trip.create({
        title: 'Test Trip',
        destination: 'Barcelona',
        startDate: '2024-08-01',
        endDate: '2024-08-07',
        userId: user.id
      });
    });

    it('should get trip by id', async () => {
      const res = await request(app)
        .get(`/api/trips/${trip.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.trip.id).toBe(trip.id);
      expect(res.body.data.trip.title).toBe('Test Trip');
    });

    it('should not get trip of another user', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe'
      });

      await request(app)
        .get(`/api/trips/${trip.id}`)
        .set('Authorization', `Bearer ${otherUser.generateJWT()}`)
        .expect(404);
    });
  });

  describe('PUT /api/trips/:id', () => {
    let trip;

    beforeEach(async () => {
      trip = await Trip.create({
        title: 'Original Title',
        destination: 'Barcelona',
        startDate: '2024-08-01',
        endDate: '2024-08-07',
        userId: user.id
      });
    });

    it('should update trip', async () => {
      const updateData = {
        title: 'Updated Title',
        budget: 1500
      };

      const res = await request(app)
        .put(`/api/trips/${trip.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.data.trip.title).toBe('Updated Title');
      expect(res.body.data.trip.budget).toBe(1500);
    });
  });

  describe('DELETE /api/trips/:id', () => {
    let trip;

    beforeEach(async () => {
      trip = await Trip.create({
        title: 'To Delete',
        destination: 'Barcelona',
        startDate: '2024-08-01',
        endDate: '2024-08-07',
        userId: user.id
      });
    });

    it('should delete trip', async () => {
      await request(app)
        .delete(`/api/trips/${trip.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const deletedTrip = await Trip.findByPk(trip.id);
      expect(deletedTrip).toBeNull();
    });
  });
});
