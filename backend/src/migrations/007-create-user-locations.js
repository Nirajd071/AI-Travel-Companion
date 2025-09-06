'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_locations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      location: {
        type: Sequelize.GEOMETRY('POINT', 4326),
        allowNull: false
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
      },
      accuracy: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
        comment: 'Location accuracy in meters'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true
      },
      location_type: {
        type: Sequelize.ENUM('current', 'home', 'work', 'favorite', 'visited'),
        defaultValue: 'current'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      recorded_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add spatial index
    await queryInterface.addIndex('user_locations', {
      fields: ['location'],
      using: 'GIST'
    });

    // Add regular indexes
    await queryInterface.addIndex('user_locations', ['user_id']);
    await queryInterface.addIndex('user_locations', ['location_type']);
    await queryInterface.addIndex('user_locations', ['recorded_at']);
    await queryInterface.addIndex('user_locations', ['is_active']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_locations');
  }
};
